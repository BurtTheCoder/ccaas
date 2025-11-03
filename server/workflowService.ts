import { randomBytes } from 'crypto';
import * as db from './db';
import * as docker from './docker';
import { ConfigService, WorkflowConfig, WorkflowAgent } from './configService';
import { ActionService } from './actionService';
import { interpolateVariables, evaluateCondition, parseCost, formatCost, convertToContainerConfig } from './workflowUtils';
import { getSlackClient } from './slackClient';
import * as formatter from './slackFormatter';
import { getEmailService } from './emailService';
import * as emailTemplates from './emailTemplates';
import { workflowEmitter } from './workflowEmitter';
import { throttle } from './streamHandlers';
import { ToolValidator, validateToolConfiguration } from './toolValidator';
import * as metricsService from './metricsService';

export interface WorkflowExecuteOptions {
  projectId: number;
  userId: number;
  workflowName?: string;
  source?: string;
  sourceMetadata?: Record<string, any>;
  context?: Record<string, any>;
}

export interface WorkflowStatus {
  workflowId: string;
  name: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentAgent?: string;
  currentStep?: number;
  totalSteps?: number;
  iterations?: number;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  totalCost?: number;
  error?: string;
}

/**
 * Generate a unique workflow ID
 */
export function generateWorkflowId(): string {
  return `wf_${randomBytes(12).toString('hex')}`;
}

/**
 * Generate a unique agent execution ID
 */
export function generateAgentExecutionId(): string {
  return `agent_${randomBytes(12).toString('hex')}`;
}

/**
 * Execute a multi-agent workflow
 */
export async function executeWorkflow(
  configService: ConfigService,
  actionService: ActionService,
  options: WorkflowExecuteOptions
): Promise<WorkflowStatus> {
  const workflowId = generateWorkflowId();
  
  console.log(`[Workflow] Starting workflow ${workflowId}`);
  console.log(`[Workflow] Project ID: ${options.projectId}, User ID: ${options.userId}`);

  // Get project details
  const project = await db.getProjectById(options.projectId);
  if (!project) {
    throw new Error(`Project ${options.projectId} not found`);
  }

  // Load workflow configuration
  const workflowConfig = await configService.getWorkflowConfig(project.path);
  if (!workflowConfig) {
    throw new Error(`No workflow configuration found for project ${project.name}`);
  }

  // Create workflow record
  const workflow = await db.createWorkflow({
    workflowId,
    projectId: options.projectId,
    userId: options.userId,
    name: workflowConfig.name,
    description: workflowConfig.description,
    status: 'pending',
    totalSteps: workflowConfig.agents.length,
    maxIterations: workflowConfig.workflow.max_iterations,
    budgetLimit: workflowConfig.workflow.budget?.daily_max_cost
      ? parseCost(workflowConfig.workflow.budget.daily_max_cost)
      : undefined,
    config: workflowConfig as any,
    context: {
      ...workflowConfig.workflow.context,
      ...options.context,
    },
    state: {},
    source: options.source,
    sourceMetadata: options.sourceMetadata,
  });

  // Log the start
  await db.createLog({
    workflowId,
    level: 'info',
    message: `Workflow started: ${workflowConfig.name}`,
    metadata: { agentCount: workflowConfig.agents.length },
  });

  // Emit workflow started event
  workflowEmitter.emit(workflowId, 'workflow:started', {
    name: workflowConfig.name,
    totalSteps: workflowConfig.agents.length,
    maxIterations: workflowConfig.workflow.max_iterations,
    budgetLimit: workflowConfig.workflow.budget?.daily_max_cost
      ? parseCost(workflowConfig.workflow.budget.daily_max_cost)
      : undefined,
  });

  // Send Slack notification for workflow started
  try {
    const slackClient = getSlackClient();
    if (slackClient.isConfigured()) {
      const notification = formatter.formatWorkflowStarted({
        workflowId,
        name: workflowConfig.name,
        description: workflowConfig.description,
        totalSteps: workflowConfig.agents.length,
        budgetLimit: workflowConfig.workflow.budget?.daily_max_cost
          ? parseCost(workflowConfig.workflow.budget.daily_max_cost)
          : undefined,
      });
      await slackClient.sendDefaultNotification(notification.text);
    }
  } catch (error) {
    console.error('[Workflow] Failed to send workflow started notification:', error);
  }

  // Send email notification for workflow started
  try {
    const emailService = getEmailService();
    if (emailService.isConfigured()) {
      const recipients = await db.getEmailRecipientsForUser(options.userId, 'workflow_started', options.projectId);
      if (recipients.length > 0) {
        const emailHtml = emailTemplates.workflowStartedTemplate({
          workflowId,
          name: workflowConfig.name,
          description: workflowConfig.description,
          totalSteps: workflowConfig.agents.length,
          budgetLimit: workflowConfig.workflow.budget?.daily_max_cost
            ? parseCost(workflowConfig.workflow.budget.daily_max_cost)
            : undefined,
        });
        await emailService.queueEmail({
          to: recipients,
          subject: `Workflow Started: ${workflowConfig.name}`,
          html: emailHtml,
        });
      }
    }
  } catch (error) {
    console.error('[Workflow] Failed to send workflow started email:', error);
  }

  // Start workflow execution asynchronously
  executeWorkflowAsync(workflowId, workflowConfig, project.path, actionService).catch(error => {
    console.error(`[Workflow] Async execution error for ${workflowId}:`, error);
  });

  return {
    workflowId,
    name: workflowConfig.name,
    status: 'pending',
    totalSteps: workflowConfig.agents.length,
  };
}

/**
 * Execute workflow asynchronously
 */
async function executeWorkflowAsync(
  workflowId: string,
  workflowConfig: WorkflowConfig,
  projectPath: string,
  actionService: ActionService
): Promise<void> {
  const startTime = Date.now();
  let totalCost = 0;
  let currentAgent: WorkflowAgent | null = workflowConfig.agents[0];
  let stepNumber = 0;
  const workflowState: Record<string, any> = {};
  let consecutiveFailures = 0;
  let iterations = 0;

  try {
    // Update status to running
    await db.updateWorkflow(workflowId, {
      status: 'running',
      startedAt: new Date(),
      currentAgent: currentAgent.name,
      currentStep: stepNumber,
    });

    // Emit workflow running event
    workflowEmitter.emit(workflowId, 'workflow:running', {
      currentAgent: currentAgent.name,
      currentStep: stepNumber,
      iterations: 0,
      totalCost: 0,
    });

    // Execute agents in sequence
    while (currentAgent !== null && iterations < (workflowConfig.workflow.max_iterations || 100)) {
      iterations++;
      stepNumber++;

      console.log(`[Workflow] ${workflowId} - Executing agent: ${currentAgent.name} (step ${stepNumber})`);

      await db.updateWorkflow(workflowId, {
        currentAgent: currentAgent.name,
        currentStep: stepNumber,
        iterations,
      });

      await db.createLog({
        workflowId,
        level: 'info',
        message: `Executing agent: ${currentAgent.name}`,
        metadata: { step: stepNumber, role: currentAgent.role },
      });

      // Emit workflow running event with updated state
      workflowEmitter.emit(workflowId, 'workflow:running', {
        currentAgent: currentAgent.name,
        currentStep: stepNumber,
        iterations,
        totalCost,
      });

      // Execute the agent
      const agentResult = await executeAgent(
        workflowId,
        currentAgent,
        projectPath,
        workflowState,
        stepNumber
      );

      totalCost += agentResult.cost || 0;

      // Update workflow cost
      await db.updateWorkflow(workflowId, {
        totalCost,
      });

      // Check budget limit
      const workflow = await db.getWorkflowById(workflowId);
      if (workflow?.budgetLimit) {
        const percentageUsed = (totalCost / workflow.budgetLimit) * 100;

        // Send warning at 80%
        if (percentageUsed >= 80 && percentageUsed < 100) {
          workflowEmitter.emit(workflowId, 'budget:warning', {
            currentCost: totalCost,
            budgetLimit: workflow.budgetLimit,
            percentageUsed,
          });
        }

        // Check if exceeded
        if (totalCost >= workflow.budgetLimit) {
          // Emit budget exceeded event
          workflowEmitter.emit(workflowId, 'budget:exceeded', {
            currentCost: totalCost,
            budgetLimit: workflow.budgetLimit,
          });

          // Send budget exceeded notification
          try {
            const slackClient = getSlackClient();
            if (slackClient.isConfigured()) {
              const notification = formatter.formatBudgetExceeded({
                userId: workflow.userId,
                dailyCost: totalCost,
                budgetLimit: workflow.budgetLimit,
                workflowId,
                workflowName: workflow.name,
              });
              await slackClient.sendDefaultNotification(notification.text);
            }
          } catch (notificationError) {
            console.error('[Workflow] Failed to send budget exceeded notification:', notificationError);
          }

          // Send budget exceeded email
          try {
            const emailService = getEmailService();
            if (emailService.isConfigured()) {
              const recipients = await db.getEmailRecipientsForUser(workflow.userId, 'budget_exceeded', workflow.projectId);
              if (recipients.length > 0) {
                const emailHtml = emailTemplates.budgetExceededTemplate({
                  currentCost: totalCost,
                  budgetLimit: workflow.budgetLimit,
                  workflowId,
                  workflowName: workflow.name,
                });
                await emailService.queueEmail({
                  to: recipients,
                  subject: `Budget Exceeded: ${workflow.name}`,
                  html: emailHtml,
                });
              }
            }
          } catch (notificationError) {
            console.error('[Workflow] Failed to send budget exceeded email:', notificationError);
          }

          throw new Error(`Budget limit exceeded: ${formatCost(totalCost)} >= ${formatCost(workflow.budgetLimit)}`);
        }
      }

      if (agentResult.status === 'completed') {
        // Store output in workflow state
        if (currentAgent.output && agentResult.output) {
          workflowState[currentAgent.output] = agentResult.output;
        }

        await db.updateWorkflow(workflowId, {
          state: workflowState,
        });

        consecutiveFailures = 0;

        // Determine next agent
        const nextAgent = await determineNextAgent(currentAgent, agentResult, workflowConfig, workflowState, actionService);
        currentAgent = nextAgent;

      } else {
        // Agent failed
        consecutiveFailures++;

        await db.createLog({
          workflowId,
          level: 'error',
          message: `Agent ${currentAgent.name} failed`,
          metadata: { error: agentResult.error },
        });

        // Check consecutive failures
        if (consecutiveFailures >= (workflowConfig.workflow.max_consecutive_failures || 3)) {
          throw new Error(`Max consecutive failures reached: ${consecutiveFailures}`);
        }

        // Handle error
        if (currentAgent.onError) {
          if (currentAgent.onError.action === 'stop' || !currentAgent.onError.next) {
            throw new Error(`Agent ${currentAgent.name} failed: ${agentResult.error}`);
          }
          
          // Continue to error handler agent
          const nextAgentName: string = currentAgent.onError.next;
          currentAgent = workflowConfig.agents.find(a => a.name === nextAgentName) || null;
        } else {
          throw new Error(`Agent ${currentAgent.name} failed: ${agentResult.error}`);
        }
      }
    }

    // Workflow completed
    const duration = Date.now() - startTime;

    await db.updateWorkflow(workflowId, {
      status: 'completed',
      completedAt: new Date(),
      duration,
      totalCost,
    });

    await db.createLog({
      workflowId,
      level: 'info',
      message: 'Workflow completed successfully',
      metadata: { duration, totalCost: formatCost(totalCost), iterations },
    });

    // Record metrics for analytics
    const workflow = await db.getWorkflowById(workflowId);
    if (workflow) {
      const today = new Date().toISOString().split('T')[0];
      await metricsService.recordMetric(
        workflow.userId,
        'workflow_duration',
        duration,
        { status: 'completed', projectId: workflow.projectId },
        undefined,
        workflowId
      );
      await metricsService.recordMetric(
        workflow.userId,
        'workflow_cost',
        totalCost,
        { status: 'completed', projectId: workflow.projectId },
        undefined,
        workflowId
      );

      // Update daily metrics summary
      await metricsService.updateDailyMetricsSummary(workflow.userId, today, {
        totalWorkflows: 1,
        successCount: 1,
        totalDuration: duration,
        totalCost,
      });
    }

    // Emit workflow completed event
    workflowEmitter.emit(workflowId, 'workflow:completed', {
      duration,
      totalCost,
      iterations,
      currentStep: stepNumber,
    });

    // Update budget tracking and send notifications
    if (workflow) {
      // Send Slack notification for workflow completed
      try {
        const slackClient = getSlackClient();
        if (slackClient.isConfigured()) {
          const notification = formatter.formatWorkflowCompleted({
            workflowId,
            name: workflow.name,
            duration,
            totalCost,
            iterations,
            currentStep: workflow.currentStep || undefined,
          });
          await slackClient.sendMessage(
            workflow.name,
            notification.text,
            notification.blocks
          );
        }
      } catch (error) {
        console.error('[Workflow] Failed to send workflow completed notification:', error);
      }

      // Send email notification for workflow completed
      try {
        const emailService = getEmailService();
        if (emailService.isConfigured()) {
          const recipients = await db.getEmailRecipientsForUser(workflow.userId, 'workflow_completed', workflow.projectId);
          if (recipients.length > 0) {
            const emailHtml = emailTemplates.workflowCompletedTemplate({
              workflowId,
              name: workflow.name,
              duration,
              totalCost,
              iterations,
              currentStep: workflow.currentStep || undefined,
            });
            await emailService.queueEmail({
              to: recipients,
              subject: `Workflow Completed: ${workflow.name}`,
              html: emailHtml,
            });
          }
        }
      } catch (error) {
        console.error('[Workflow] Failed to send workflow completed email:', error);
      }

      // Update budget tracking
      const today = new Date().toISOString().split('T')[0];
      await db.updateBudgetTracking(workflow.userId, today, totalCost, false, true);
    }

  } catch (error) {
    console.error(`[Workflow] Error in workflow ${workflowId}:`, error);

    const duration = Date.now() - startTime;

    await db.updateWorkflow(workflowId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
      duration,
      totalCost,
    });

    await db.createLog({
      workflowId,
      level: 'error',
      message: 'Workflow failed',
      metadata: { error: error instanceof Error ? error.message : String(error), duration },
    });

    // Record metrics for analytics
    const workflow = await db.getWorkflowById(workflowId);
    if (workflow) {
      const today = new Date().toISOString().split('T')[0];
      await metricsService.recordMetric(
        workflow.userId,
        'workflow_duration',
        duration,
        { status: 'failed', projectId: workflow.projectId },
        undefined,
        workflowId
      );
      await metricsService.recordMetric(
        workflow.userId,
        'workflow_cost',
        totalCost,
        { status: 'failed', projectId: workflow.projectId },
        undefined,
        workflowId
      );

      // Update daily metrics summary
      await metricsService.updateDailyMetricsSummary(workflow.userId, today, {
        totalWorkflows: 1,
        failureCount: 1,
        totalDuration: duration,
        totalCost,
      });
    }

    // Emit workflow failed event
    workflowEmitter.emit(workflowId, 'workflow:failed', {
      error: error instanceof Error ? error.message : String(error),
      duration,
      totalCost,
      currentAgent: workflow?.currentAgent,
      currentStep: workflow?.currentStep,
    });

    // Send Slack notification for workflow failed
    try {
      const slackClient = getSlackClient();
      if (slackClient.isConfigured()) {
        const workflow = await db.getWorkflowById(workflowId);
        if (workflow) {
          const notification = formatter.formatWorkflowFailed({
            workflowId,
            name: workflow.name,
            error: error instanceof Error ? error.message : String(error),
            duration,
            totalCost,
            currentAgent: workflow.currentAgent || undefined,
            currentStep: workflow.currentStep || undefined,
          });
          await slackClient.sendMessage(
            workflow.name,
            notification.text,
            notification.blocks
          );
        }
      }
    } catch (notificationError) {
      console.error('[Workflow] Failed to send workflow failed notification:', notificationError);
    }

    // Send email notification for workflow failed
    try {
      const emailService = getEmailService();
      if (emailService.isConfigured()) {
        const workflow = await db.getWorkflowById(workflowId);
        if (workflow) {
          const recipients = await db.getEmailRecipientsForUser(workflow.userId, 'workflow_failed', workflow.projectId);
          if (recipients.length > 0) {
            const emailHtml = emailTemplates.workflowFailedTemplate({
              workflowId,
              name: workflow.name,
              error: error instanceof Error ? error.message : String(error),
              duration,
              totalCost,
              currentAgent: workflow.currentAgent || undefined,
              currentStep: workflow.currentStep || undefined,
            });
            await emailService.queueEmail({
              to: recipients,
              subject: `Workflow Failed: ${workflow.name}`,
              html: emailHtml,
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('[Workflow] Failed to send workflow failed email:', notificationError);
    }
  }
}

/**
 * Execute a single agent within a workflow
 */
async function executeAgent(
  workflowId: string,
  agent: WorkflowAgent,
  projectPath: string,
  workflowState: Record<string, any>,
  stepNumber: number
): Promise<{
  status: 'completed' | 'failed';
  output?: string;
  error?: string;
  cost?: number;
}> {
  const agentExecutionId = generateAgentExecutionId();
  
  // Interpolate prompt with workflow state
  const interpolatedPrompt = interpolateVariables(agent.prompt, workflowState);

  // Create agent execution record
  await db.createAgentExecution({
    agentExecutionId,
    workflowId,
    agentName: agent.name,
    agentRole: agent.role,
    stepNumber,
    status: 'running',
    prompt: interpolatedPrompt,
    outputVariable: agent.output,
    containerConfig: agent.container as any,
    startedAt: new Date(),
  });

  // Emit agent started event
  workflowEmitter.emit(workflowId, 'agent:started', {
    agentName: agent.name,
    agentRole: agent.role,
    stepNumber,
    prompt: interpolatedPrompt,
  });

  try {
    // Spawn container
    const containerConfig = convertToContainerConfig(agent.container);
    const containerId = await docker.spawnContainer(containerConfig);

    await db.updateAgentExecution(agentExecutionId, {
      containerId,
    });

    // Validate and log tools before execution
    if (containerConfig.tools && containerConfig.tools.length > 0) {
      const toolValidation = validateToolConfiguration(containerConfig.tools);

      // Log tool validation results
      await db.createLog({
        workflowId,
        level: toolValidation.valid ? 'info' : 'error',
        message: `[${agent.name}] Tool validation: ${toolValidation.valid ? 'PASSED' : 'FAILED'}`,
        metadata: {
          requestedTools: containerConfig.tools,
          allowedTools: toolValidation.normalizedTools,
          errors: toolValidation.errors,
        },
      });

      // Log allowed tools
      if (toolValidation.valid && toolValidation.normalizedTools.length > 0) {
        await db.createLog({
          workflowId,
          level: 'info',
          message: `[${agent.name}] Allowed tools: ${toolValidation.normalizedTools.join(', ')}`,
        });

        // Warn about high-risk tools
        const validator = new ToolValidator(toolValidation.normalizedTools);
        const highRiskTools = validator.getHighRiskTools(toolValidation.normalizedTools);
        if (highRiskTools.length > 0) {
          await db.createLog({
            workflowId,
            level: 'warn',
            message: `[${agent.name}] High-risk tools enabled: ${highRiskTools.join(', ')}`,
            metadata: { highRiskTools },
          });
        }
      }

      // If validation failed, log error and fail early
      if (!toolValidation.valid) {
        await db.createLog({
          workflowId,
          level: 'error',
          message: `[${agent.name}] Tool validation failed: ${toolValidation.errors.join('; ')}`,
        });
        throw new Error(`Tool validation failed: ${toolValidation.errors.join('; ')}`);
      }
    } else {
      // Log when no tools are specified (will use defaults)
      await db.createLog({
        workflowId,
        level: 'info',
        message: `[${agent.name}] No tools specified, using default safe tools`,
      });
    }

    // Log MCP server configuration
    if (containerConfig.mcpServers && containerConfig.mcpServers.length > 0) {
      await db.createLog({
        workflowId,
        level: 'info',
        message: `[${agent.name}] Configured MCP servers: ${containerConfig.mcpServers.map(s => s.name).join(', ')}`,
      });
    }

    // Clone GitHub repo if specified
    if (agent.container.githubRepo) {
      await db.createLog({
        workflowId,
        level: 'info',
        message: `[${agent.name}] Cloning repository: ${agent.container.githubRepo}`,
      });

      try {
        await docker.cloneGitHubRepo(
          containerId,
          agent.container.githubRepo,
          agent.container.workingDir || '/workspace'
        );

        await db.createLog({
          workflowId,
          level: 'info',
          message: `[${agent.name}] Repository cloned successfully`,
        });
      } catch (error) {
        await db.createLog({
          workflowId,
          level: 'error',
          message: `[${agent.name}] Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
        });
        throw error;
      }
    }

    // Create throttled progress emitter (max 1 per second)
    const emitProgress = throttle((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
      workflowEmitter.emit(workflowId, 'agent:progress', {
        agentName: agent.name,
        message,
        level,
      });
    }, 1000);

    // Execute Claude Code in container
    const result = await docker.executeInContainer(
      containerId,
      interpolatedPrompt,
      containerConfig,
      (logMessage) => {
        // Stream logs
        db.createLog({
          workflowId,
          level: 'info',
          message: `[${agent.name}] ${logMessage}`,
        }).catch(console.error);

        // Emit throttled progress event
        emitProgress(logMessage);

        // Also emit log created event
        workflowEmitter.emit(workflowId, 'log:created', {
          level: 'info',
          message: `[${agent.name}] ${logMessage}`,
          timestamp: new Date(),
        });
      }
    );

    // Clean up container
    await docker.stopContainer(containerId).catch(console.error);

    // Calculate cost
    const cost = calculateAgentCost(result.duration, containerConfig);

    // Create tool access audit log
    const workflow = await db.getWorkflowById(workflowId);
    if (workflow && result.toolsUsed) {
      await db.createToolAccessAudit({
        workflowId,
        agentExecutionId,
        agentName: agent.name,
        userId: workflow.userId,
        requestedTools: containerConfig.tools || [],
        allowedTools: result.toolsUsed,
        deniedTools: [],
        validationErrors: result.toolValidation?.errors,
        accessGranted: result.toolValidation?.valid ?? true,
      });
    }

    // Update agent execution
    await db.updateAgentExecution(agentExecutionId, {
      status: result.exitCode === 0 ? 'completed' : 'failed',
      output: result.output,
      error: result.error,
      containerId: result.containerId,
      completedAt: new Date(),
      duration: result.duration,
      cost,
    });

    // Emit agent completed or failed event
    if (result.exitCode === 0) {
      workflowEmitter.emit(workflowId, 'agent:completed', {
        agentName: agent.name,
        stepNumber,
        duration: result.duration,
        cost,
        output: result.output,
      });
    } else {
      workflowEmitter.emit(workflowId, 'agent:failed', {
        agentName: agent.name,
        stepNumber,
        error: result.error || 'Agent execution failed',
      });
    }

    return {
      status: result.exitCode === 0 ? 'completed' : 'failed',
      output: result.output,
      error: result.error,
      cost,
    };

  } catch (error) {
    await db.updateAgentExecution(agentExecutionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    });

    // Emit agent failed event
    workflowEmitter.emit(workflowId, 'agent:failed', {
      agentName: agent.name,
      stepNumber,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Determine the next agent to execute based on conditions
 */
async function determineNextAgent(
  currentAgent: WorkflowAgent,
  agentResult: { status: string; output?: string },
  workflowConfig: WorkflowConfig,
  workflowState: Record<string, any>,
  actionService: ActionService
): Promise<WorkflowAgent | null> {
  // Check conditions first
  if (currentAgent.conditions && currentAgent.conditions.length > 0) {
    for (const condition of currentAgent.conditions) {
      if (condition.if) {
        const conditionMet = evaluateCondition(condition.if, workflowState);
        if (conditionMet) {
          if (condition.then) {
            await actionService.executeActions(condition.then, workflowState);
          }
          if (condition.next) {
            return workflowConfig.agents.find(a => a.name === condition.next) || null;
          }
          return null; // End workflow if condition met but no next agent
        }
      } else { // This is the 'else' case
        if (condition.then) {
            await actionService.executeActions(condition.then, workflowState);
        }
        if (condition.next) {
            return workflowConfig.agents.find(a => a.name === condition.next) || null;
        }
        return null;
      }
    }
  }

  // Use next field if no conditions met
  if (currentAgent.next) {
    const nextName = Array.isArray(currentAgent.next) ? currentAgent.next[0] : currentAgent.next;
    return workflowConfig.agents.find(a => a.name === nextName) || null;
  }

  // No next agent - workflow complete
  return null;
}

/**
 * Get workflow status
 */
export async function getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
  const workflow = await db.getWorkflowById(workflowId);
  if (!workflow) {
    return null;
  }

  return {
    workflowId: workflow.workflowId,
    name: workflow.name,
    status: workflow.status,
    currentAgent: workflow.currentAgent || undefined,
    currentStep: workflow.currentStep || undefined,
    totalSteps: workflow.totalSteps || undefined,
    iterations: workflow.iterations || undefined,
    startedAt: workflow.startedAt || undefined,
    completedAt: workflow.completedAt || undefined,
    duration: workflow.duration || undefined,
    totalCost: workflow.totalCost || undefined,
    error: workflow.error || undefined,
  };
}

/**
 * Pause a running workflow
 */
export async function pauseWorkflow(workflowId: string): Promise<void> {
  await db.updateWorkflow(workflowId, { status: 'paused' });
  await db.createLog({
    workflowId,
    level: 'info',
    message: 'Workflow paused',
  });
}

/**
 * Resume a paused workflow
 */
export async function resumeWorkflow(workflowId: string): Promise<void> {
  await db.updateWorkflow(workflowId, { status: 'running' });
  await db.createLog({
    workflowId,
    level: 'info',
    message: 'Workflow resumed',
  });
}

/**
 * Cancel a workflow
 */
export async function cancelWorkflow(workflowId: string): Promise<void> {
  await db.updateWorkflow(workflowId, { 
    status: 'cancelled',
    completedAt: new Date(),
  });
  await db.createLog({
    workflowId,
    level: 'info',
    message: 'Workflow cancelled',
  });
}

/**
 * List active workflows
 */
export async function listActiveWorkflows() {
  const workflows = await db.listActiveWorkflows();
  return workflows.map(wf => ({
    workflowId: wf.workflowId,
    name: wf.name,
    status: wf.status,
    currentAgent: wf.currentAgent || undefined,
    currentStep: wf.currentStep || undefined,
    totalSteps: wf.totalSteps || undefined,
    startedAt: wf.startedAt || undefined,
    totalCost: wf.totalCost || undefined,
  }));
}

/**
 * List workflows for a user
 */
export async function listWorkflows(userId: number, limit: number = 50) {
  const workflows = await db.listWorkflowsByUser(userId, limit);
  return workflows.map(wf => ({
    workflowId: wf.workflowId,
    name: wf.name,
    status: wf.status,
    startedAt: wf.startedAt || undefined,
    completedAt: wf.completedAt || undefined,
    duration: wf.duration || undefined,
    totalCost: wf.totalCost || undefined,
  }));
}

/**
 * Calculate agent execution cost
 */
function calculateAgentCost(durationMs: number, containerConfig: docker.ContainerConfig): number {
  const baseCost = (durationMs / 1000) * 1;
  let multiplier = 1;

  if (containerConfig.resources?.memory) {
    const memoryMb = containerConfig.resources.memory;
    const memoryGb = memoryMb / 1024;
    multiplier *= 1 + (memoryGb / 4);
  }

  return Math.max(Math.round(baseCost * multiplier), 5);
}