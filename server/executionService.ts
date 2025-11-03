import { randomBytes } from 'crypto';
import * as db from './db';
import * as docker from './docker';
import { getEmailService } from './emailService';
import * as emailTemplates from './emailTemplates';
import * as metricsService from './metricsService';

export interface ExecuteOptions {
  projectId: number;
  userId: number;
  prompt: string;
  source?: string;
  sourceMetadata?: Record<string, any>;
}

export interface ExecutionStatus {
  executionId: string;
  projectId: number;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  cost?: number;
  source?: string;
  containerId?: string;
}

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(): string {
  return `exec_${randomBytes(12).toString('hex')}`;
}

/**
 * Execute a single-agent Claude Code task
 */
export async function execute(options: ExecuteOptions): Promise<ExecutionStatus> {
  const executionId = generateExecutionId();
  
  console.log(`[Execution] Starting execution ${executionId}`);
  console.log(`[Execution] Project ID: ${options.projectId}, User ID: ${options.userId}`);
  console.log(`[Execution] Prompt: ${options.prompt.substring(0, 100)}...`);

  // Create execution record
  const execution = await db.createExecution({
    executionId,
    projectId: options.projectId,
    userId: options.userId,
    prompt: options.prompt,
    status: 'pending',
    source: options.source,
    sourceMetadata: options.sourceMetadata,
  });

  // Log the start
  await db.createLog({
    executionId,
    level: 'info',
    message: 'Execution started',
    metadata: { source: options.source },
  });

  try {
    // Get project details
    const project = await db.getProjectById(options.projectId);
    if (!project) {
      throw new Error(`Project ${options.projectId} not found`);
    }

    // Load default container configuration for single-agent executions
    const containerConfig: docker.ContainerConfig = {
      image: 'claude-code:latest',
      resources: {
        memory: 2048,
        cpus: 2,
        timeout: 600,
      },
    };

    // Update status to running
    await db.updateExecution(executionId, {
      status: 'running',
      startedAt: new Date(),
    });

    await db.createLog({
      executionId,
      level: 'info',
      message: 'Spawning Docker container',
      metadata: { image: containerConfig.image },
    });

    // Spawn container
    const containerId = await docker.spawnContainer(containerConfig);
    
    await db.updateExecution(executionId, {
      containerId,
    });

    await db.createLog({
      executionId,
      level: 'info',
      message: `Container spawned: ${containerId}`,
      metadata: { containerId },
    });

    // Clone GitHub repo if specified
    if (containerConfig.githubRepo) {
      await db.createLog({
        executionId,
        level: 'info',
        message: `Cloning repository: ${containerConfig.githubRepo}`,
      });

      try {
        await docker.cloneGitHubRepo(
          containerId,
          containerConfig.githubRepo,
          containerConfig.workingDir || '/workspace'
        );
        
        await db.createLog({
          executionId,
          level: 'info',
          message: 'Repository cloned successfully',
        });
      } catch (error) {
        await db.createLog({
          executionId,
          level: 'error',
          message: `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
        });
        throw error;
      }
    }

    // Execute Claude Code in container
    const result = await docker.executeInContainer(
      containerId,
      options.prompt,
      containerConfig,
      (logMessage) => {
        // Stream logs to database
        db.createLog({
          executionId,
          level: 'info',
          message: logMessage,
        }).catch(console.error);
      }
    );

    // Clean up container
    await docker.stopContainer(containerId).catch(console.error);

    // Calculate cost (mock calculation)
    const cost = calculateCost(result.duration, containerConfig);

    // Update execution with result
    await db.updateExecution(executionId, {
      status: result.exitCode === 0 ? 'completed' : 'failed',
      result: result.output,
      error: result.error,
      containerId: result.containerId,
      completedAt: new Date(),
      duration: result.duration,
      cost,
    });

    await db.createLog({
      executionId,
      level: result.exitCode === 0 ? 'info' : 'error',
      message: result.exitCode === 0 ? 'Execution completed successfully' : 'Execution failed',
      metadata: { exitCode: result.exitCode, duration: result.duration, cost },
    });

    // Update budget tracking
    const today = new Date().toISOString().split('T')[0];
    await db.updateBudgetTracking(options.userId, today, cost, true, false);

    // Record metrics for analytics
    await metricsService.recordMetric(
      options.userId,
      'execution_duration',
      result.duration,
      { status: result.exitCode === 0 ? 'completed' : 'failed', projectId: options.projectId },
      executionId
    );
    await metricsService.recordMetric(
      options.userId,
      'execution_cost',
      cost,
      { status: result.exitCode === 0 ? 'completed' : 'failed', projectId: options.projectId },
      executionId
    );

    // Update daily metrics summary
    await metricsService.updateDailyMetricsSummary(options.userId, today, {
      totalExecutions: 1,
      successCount: result.exitCode === 0 ? 1 : 0,
      failureCount: result.exitCode === 0 ? 0 : 1,
      totalDuration: result.duration,
      totalCost: cost,
    });

    // Send email notification for execution completion or failure
    try {
      const emailService = getEmailService();
      if (emailService.isConfigured()) {
        const emailType = result.exitCode === 0 ? 'execution_completed' : 'execution_failed';
        const recipients = await db.getEmailRecipientsForUser(options.userId, emailType, options.projectId);

        if (recipients.length > 0) {
          const project = await db.getProjectById(options.projectId);

          if (result.exitCode === 0) {
            const emailHtml = emailTemplates.executionCompletedTemplate({
              executionId,
              projectName: project?.name,
              prompt: options.prompt,
              duration: result.duration,
              cost,
              result: result.output,
            });
            await emailService.queueEmail({
              to: recipients,
              subject: `Execution Completed${project ? `: ${project.name}` : ''}`,
              html: emailHtml,
            });
          } else {
            const emailHtml = emailTemplates.executionFailedTemplate({
              executionId,
              projectName: project?.name,
              prompt: options.prompt,
              error: result.error,
              duration: result.duration,
              cost,
            });
            await emailService.queueEmail({
              to: recipients,
              subject: `Execution Failed${project ? `: ${project.name}` : ''}`,
              html: emailHtml,
            });
          }
        }
      }
    } catch (error) {
      console.error('[Execution] Failed to send execution email:', error);
    }

    return {
      executionId,
      projectId: options.projectId,
      prompt: options.prompt,
      status: result.exitCode === 0 ? 'completed' : 'failed',
      result: result.output,
      error: result.error,
      startedAt: execution.startedAt || undefined,
      completedAt: new Date(),
      duration: result.duration,
      cost,
      source: options.source,
      containerId: result.containerId,
    };

  } catch (error) {
    console.error(`[Execution] Error in execution ${executionId}:`, error);

    await db.updateExecution(executionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    });

    await db.createLog({
      executionId,
      level: 'error',
      message: 'Execution failed with error',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });

    return {
      executionId,
      projectId: options.projectId,
      prompt: options.prompt,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      source: options.source,
    };
  }
}

/**
 * Get execution status
 */
export async function getStatus(executionId: string): Promise<ExecutionStatus | null> {
  const execution = await db.getExecutionById(executionId);
  if (!execution) {
    return null;
  }

  return {
    executionId: execution.executionId,
    projectId: execution.projectId,
    prompt: execution.prompt,
    status: execution.status,
    result: execution.result || undefined,
    error: execution.error || undefined,
    startedAt: execution.startedAt || undefined,
    completedAt: execution.completedAt || undefined,
    duration: execution.duration || undefined,
    cost: execution.cost || undefined,
    source: execution.source || undefined,
    containerId: execution.containerId || undefined,
  };
}

/**
 * Get execution logs
 */
export async function getLogs(executionId: string): Promise<Array<{
  level: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}>> {
  const logs = await db.getLogsByExecutionId(executionId);
  return logs.map(log => ({
    level: log.level,
    message: log.message,
    timestamp: log.timestamp,
    metadata: log.metadata as Record<string, any> | undefined,
  }));
}

/**
 * List recent executions for a user
 */
export async function listExecutions(userId: number, limit: number = 50) {
  const executions = await db.listExecutionsByUser(userId, limit);
  return executions.map(exec => ({
    executionId: exec.executionId,
    projectId: exec.projectId,
    prompt: exec.prompt.substring(0, 100) + (exec.prompt.length > 100 ? '...' : ''),
    status: exec.status,
    startedAt: exec.startedAt || undefined,
    completedAt: exec.completedAt || undefined,
    duration: exec.duration || undefined,
    cost: exec.cost || undefined,
    source: exec.source || undefined,
  }));
}

/**
 * Calculate execution cost based on duration and resources
 * This is a mock calculation - in production, use actual Claude API pricing
 */
function calculateCost(durationMs: number, containerConfig: docker.ContainerConfig): number {
  // Base cost: $0.01 per second
  const baseCost = (durationMs / 1000) * 1; // cents

  // Memory multiplier
  let memoryMultiplier = 1;
  if (containerConfig.resources?.memory) {
    const memoryMb = containerConfig.resources.memory;
    const memoryGb = memoryMb / 1024;
    memoryMultiplier = 1 + (memoryGb / 4); // +25% per GB over 4GB
  }

  // Tool multiplier
  const toolsUsed = containerConfig.mcpServers?.length || 0;
  const toolMultiplier = 1 + (toolsUsed / 20); // +5% per tool

  const totalCost = Math.round(baseCost * memoryMultiplier * toolMultiplier);
  
  return Math.max(totalCost, 5); // Minimum 5 cents
}

