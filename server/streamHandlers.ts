import { Request, Response } from 'express';
import { workflowEmitter, WorkflowEvent } from './workflowEmitter';
import * as db from './db';

/**
 * SSE event format
 */
interface SSEMessage {
  event?: string;
  data: any;
  id?: string;
  retry?: number;
}

/**
 * Format an SSE message according to the spec
 */
function formatSSE(message: SSEMessage): string {
  let formatted = '';

  if (message.id) {
    formatted += `id: ${message.id}\n`;
  }

  if (message.event) {
    formatted += `event: ${message.event}\n`;
  }

  if (message.retry) {
    formatted += `retry: ${message.retry}\n`;
  }

  const data = typeof message.data === 'string'
    ? message.data
    : JSON.stringify(message.data);

  formatted += `data: ${data}\n\n`;

  return formatted;
}

/**
 * Send an SSE comment (for heartbeat/keep-alive)
 */
function sendComment(res: Response, comment: string): void {
  res.write(`: ${comment}\n\n`);
}

/**
 * Send an SSE event
 */
function sendEvent(res: Response, event: string, data: any, id?: string): void {
  res.write(formatSSE({ event, data, id }));
}

/**
 * Handle SSE stream for workflow progress
 * GET /api/workflows/:id/stream
 */
export async function handleWorkflowStream(req: Request, res: Response): Promise<void> {
  const workflowId = req.params.id;

  if (!workflowId) {
    res.status(400).json({ error: 'Workflow ID is required' });
    return;
  }

  // Verify workflow exists
  const workflow = await db.getWorkflowById(workflowId);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  sendComment(res, `Connected to workflow ${workflowId}`);

  // Send current workflow state
  const currentState = {
    workflowId: workflow.workflowId,
    name: workflow.name,
    status: workflow.status,
    currentAgent: workflow.currentAgent,
    currentStep: workflow.currentStep,
    totalSteps: workflow.totalSteps,
    iterations: workflow.iterations,
    totalCost: workflow.totalCost,
    duration: workflow.duration,
    startedAt: workflow.startedAt,
    completedAt: workflow.completedAt,
    error: workflow.error,
  };

  sendEvent(res, 'workflow:state', currentState);

  // Send recent logs (last 50)
  const logs = await db.getLogsByWorkflowId(workflowId);
  const recentLogs = logs.slice(-50);

  for (const log of recentLogs) {
    sendEvent(res, 'log:created', {
      level: log.level,
      message: log.message,
      timestamp: log.timestamp,
      metadata: log.metadata,
    });
  }

  // Send agent executions
  const agents = await db.listAgentExecutionsByWorkflow(workflowId);
  for (const agent of agents) {
    sendEvent(res, 'agent:state', {
      agentName: agent.agentName,
      agentRole: agent.agentRole,
      stepNumber: agent.stepNumber,
      status: agent.status,
      duration: agent.duration,
      cost: agent.cost,
      startedAt: agent.startedAt,
      completedAt: agent.completedAt,
    });
  }

  // Set up event listener for real-time updates
  const unsubscribe = workflowEmitter.subscribe(workflowId, (event: WorkflowEvent) => {
    try {
      // Send event to client
      sendEvent(res, event.type, event.data, event.timestamp.getTime().toString());
    } catch (error) {
      console.error(`[SSE] Error sending event for workflow ${workflowId}:`, error);
    }
  });

  // Set up heartbeat to keep connection alive
  let heartbeatCount = 0;
  const heartbeatInterval = setInterval(() => {
    heartbeatCount++;
    try {
      sendComment(res, `heartbeat ${heartbeatCount}`);
    } catch (error) {
      // Connection likely closed
      clearInterval(heartbeatInterval);
    }
  }, 15000); // Every 15 seconds

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected from workflow ${workflowId}`);
    clearInterval(heartbeatInterval);
    unsubscribe();
  });

  // Handle errors
  req.on('error', (error) => {
    console.error(`[SSE] Connection error for workflow ${workflowId}:`, error);
    clearInterval(heartbeatInterval);
    unsubscribe();
  });

  // Auto-close stream after workflow completes (with delay for final events)
  if (workflow.status === 'completed' || workflow.status === 'failed' || workflow.status === 'cancelled') {
    setTimeout(() => {
      sendComment(res, 'Workflow completed, closing stream');
      clearInterval(heartbeatInterval);
      unsubscribe();
      res.end();
    }, 2000); // Wait 2 seconds for any final events
  }
}

/**
 * Throttle function to limit event frequency
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limitMs: number
): T {
  let lastRun = 0;
  let timeout: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;

    if (timeSinceLastRun >= limitMs) {
      // Run immediately if enough time has passed
      func(...args);
      lastRun = now;
    } else {
      // Schedule for later
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func(...args);
        lastRun = Date.now();
        timeout = null;
      }, limitMs - timeSinceLastRun);
    }
  }) as T;
}
