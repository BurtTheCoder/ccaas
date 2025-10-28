import { EventEmitter } from 'events';

/**
 * Event types emitted during workflow execution
 */
export type WorkflowEventType =
  | 'workflow:started'
  | 'workflow:running'
  | 'agent:started'
  | 'agent:progress'
  | 'agent:completed'
  | 'agent:failed'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'budget:warning'
  | 'budget:exceeded'
  | 'log:created';

/**
 * Base event structure
 */
export interface WorkflowEvent {
  workflowId: string;
  timestamp: Date;
  type: WorkflowEventType;
  data: any;
}

/**
 * Event data types for each event
 */
export interface WorkflowStartedEvent {
  name: string;
  totalSteps: number;
  maxIterations?: number;
  budgetLimit?: number;
}

export interface WorkflowRunningEvent {
  currentAgent?: string;
  currentStep?: number;
  iterations?: number;
  totalCost?: number;
}

export interface AgentStartedEvent {
  agentName: string;
  agentRole: string;
  stepNumber: number;
  prompt: string;
}

export interface AgentProgressEvent {
  agentName: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface AgentCompletedEvent {
  agentName: string;
  stepNumber: number;
  duration: number;
  cost: number;
  output?: string;
}

export interface AgentFailedEvent {
  agentName: string;
  stepNumber: number;
  error: string;
}

export interface WorkflowCompletedEvent {
  duration: number;
  totalCost: number;
  iterations: number;
  currentStep?: number;
}

export interface WorkflowFailedEvent {
  error: string;
  duration: number;
  totalCost: number;
  currentAgent?: string;
  currentStep?: number;
}

export interface BudgetWarningEvent {
  currentCost: number;
  budgetLimit: number;
  percentageUsed: number;
}

export interface BudgetExceededEvent {
  currentCost: number;
  budgetLimit: number;
}

export interface LogCreatedEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
}

/**
 * Manages workflow event subscriptions and emissions
 * Uses a singleton pattern to maintain subscriptions across the application
 */
class WorkflowEventEmitterManager {
  private emitters: Map<string, EventEmitter> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get or create an event emitter for a workflow
   */
  getEmitter(workflowId: string): EventEmitter {
    if (!this.emitters.has(workflowId)) {
      const emitter = new EventEmitter();
      emitter.setMaxListeners(100); // Allow many concurrent listeners
      this.emitters.set(workflowId, emitter);
    }
    return this.emitters.get(workflowId)!;
  }

  /**
   * Emit an event for a workflow
   */
  emit(workflowId: string, type: WorkflowEventType, data: any): void {
    const emitter = this.getEmitter(workflowId);
    const event: WorkflowEvent = {
      workflowId,
      timestamp: new Date(),
      type,
      data,
    };
    emitter.emit('event', event);
    emitter.emit(type, event);
  }

  /**
   * Subscribe to all events for a workflow
   */
  subscribe(
    workflowId: string,
    listener: (event: WorkflowEvent) => void
  ): () => void {
    const emitter = this.getEmitter(workflowId);
    emitter.on('event', listener);

    // Return unsubscribe function
    return () => {
      emitter.off('event', listener);
      this.cleanup(workflowId);
    };
  }

  /**
   * Subscribe to a specific event type
   */
  subscribeToType(
    workflowId: string,
    type: WorkflowEventType,
    listener: (event: WorkflowEvent) => void
  ): () => void {
    const emitter = this.getEmitter(workflowId);
    emitter.on(type, listener);

    return () => {
      emitter.off(type, listener);
      this.cleanup(workflowId);
    };
  }

  /**
   * Start heartbeat for a workflow stream
   */
  startHeartbeat(
    workflowId: string,
    callback: () => void,
    intervalMs: number = 15000
  ): void {
    if (this.heartbeatIntervals.has(workflowId)) {
      return; // Already running
    }

    const interval = setInterval(callback, intervalMs);
    this.heartbeatIntervals.set(workflowId, interval);
  }

  /**
   * Stop heartbeat for a workflow stream
   */
  stopHeartbeat(workflowId: string): void {
    const interval = this.heartbeatIntervals.get(workflowId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(workflowId);
    }
  }

  /**
   * Clean up emitter if no listeners remain
   */
  private cleanup(workflowId: string): void {
    const emitter = this.emitters.get(workflowId);
    if (emitter && emitter.listenerCount('event') === 0) {
      // Remove emitter if no listeners
      this.emitters.delete(workflowId);
      this.stopHeartbeat(workflowId);
    }
  }

  /**
   * Remove emitter for a workflow (called when workflow completes/fails)
   */
  removeEmitter(workflowId: string): void {
    const emitter = this.emitters.get(workflowId);
    if (emitter) {
      emitter.removeAllListeners();
      this.emitters.delete(workflowId);
      this.stopHeartbeat(workflowId);
    }
  }

  /**
   * Get active workflows with listeners
   */
  getActiveWorkflows(): string[] {
    return Array.from(this.emitters.keys());
  }

  /**
   * Get listener count for a workflow
   */
  getListenerCount(workflowId: string): number {
    const emitter = this.emitters.get(workflowId);
    return emitter ? emitter.listenerCount('event') : 0;
  }
}

// Export singleton instance
export const workflowEmitter = new WorkflowEventEmitterManager();
