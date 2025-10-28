import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Event types from SSE stream
 */
export type WorkflowEventType =
  | 'workflow:state'
  | 'workflow:started'
  | 'workflow:running'
  | 'agent:state'
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
 * Workflow state
 */
export interface WorkflowState {
  workflowId: string;
  name: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentAgent?: string;
  currentStep?: number;
  totalSteps?: number;
  iterations?: number;
  totalCost?: number;
  duration?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Agent execution state
 */
export interface AgentState {
  agentName: string;
  agentRole: string;
  stepNumber: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  cost?: number;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Log entry
 */
export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  metadata?: any;
}

/**
 * Hook options
 */
export interface UseWorkflowStreamOptions {
  enabled?: boolean;
  onEvent?: (type: WorkflowEventType, data: any) => void;
  onError?: (error: Error) => void;
  fallbackToPolling?: boolean;
  pollingInterval?: number;
}

/**
 * Hook return value
 */
export interface UseWorkflowStreamResult {
  workflow: WorkflowState | null;
  agents: Map<string, AgentState>;
  logs: LogEntry[];
  isConnected: boolean;
  isStreaming: boolean;
  error: Error | null;
  reconnect: () => void;
}

/**
 * Custom hook to stream workflow progress via SSE
 *
 * @param workflowId - The workflow ID to stream
 * @param options - Configuration options
 * @returns Workflow state and streaming status
 */
export function useWorkflowStream(
  workflowId: string | undefined,
  options: UseWorkflowStreamOptions = {}
): UseWorkflowStreamResult {
  const {
    enabled = true,
    onEvent,
    onError,
    fallbackToPolling = false,
    pollingInterval = 2000,
  } = options;

  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  /**
   * Handle SSE event
   */
  const handleEvent = useCallback((type: WorkflowEventType, data: any) => {
    // Call custom event handler
    onEvent?.(type, data);

    // Update state based on event type
    switch (type) {
      case 'workflow:state':
        setWorkflow({
          ...data,
          startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        });
        break;

      case 'workflow:started':
        setWorkflow((prev) => ({
          ...prev!,
          status: 'pending',
          totalSteps: data.totalSteps,
        }));
        break;

      case 'workflow:running':
        setWorkflow((prev) => ({
          ...prev!,
          status: 'running',
          currentAgent: data.currentAgent,
          currentStep: data.currentStep,
          iterations: data.iterations,
          totalCost: data.totalCost,
        }));
        break;

      case 'workflow:completed':
        setWorkflow((prev) => ({
          ...prev!,
          status: 'completed',
          duration: data.duration,
          totalCost: data.totalCost,
          completedAt: new Date(),
        }));
        break;

      case 'workflow:failed':
        setWorkflow((prev) => ({
          ...prev!,
          status: 'failed',
          error: data.error,
          duration: data.duration,
          totalCost: data.totalCost,
          completedAt: new Date(),
        }));
        break;

      case 'agent:state':
        setAgents((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.agentName, {
            ...data,
            startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
            completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
          });
          return newMap;
        });
        break;

      case 'agent:started':
        setAgents((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.agentName, {
            agentName: data.agentName,
            agentRole: data.agentRole,
            stepNumber: data.stepNumber,
            status: 'running',
            startedAt: new Date(),
          });
          return newMap;
        });
        break;

      case 'agent:completed':
        setAgents((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.agentName);
          newMap.set(data.agentName, {
            ...existing!,
            status: 'completed',
            duration: data.duration,
            cost: data.cost,
            completedAt: new Date(),
          });
          return newMap;
        });
        break;

      case 'agent:failed':
        setAgents((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.agentName);
          newMap.set(data.agentName, {
            ...existing!,
            status: 'failed',
            completedAt: new Date(),
          });
          return newMap;
        });
        break;

      case 'log:created':
        setLogs((prev) => {
          // Limit logs to last 200 entries
          const newLogs = [
            ...prev,
            {
              ...data,
              timestamp: new Date(data.timestamp),
            },
          ];
          return newLogs.slice(-200);
        });
        break;

      case 'budget:warning':
        // Could show a toast notification
        console.warn('[Workflow] Budget warning:', data);
        break;

      case 'budget:exceeded':
        // Could show an error notification
        console.error('[Workflow] Budget exceeded:', data);
        break;
    }
  }, [onEvent]);

  /**
   * Connect to SSE stream
   */
  const connect = useCallback(() => {
    if (!workflowId || !enabled || eventSourceRef.current) {
      return;
    }

    console.log('[SSE] Connecting to workflow stream:', workflowId);
    setIsStreaming(true);

    try {
      const eventSource = new EventSource(`/api/workflows/${workflowId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connection established');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      // Listen to all event types
      const eventTypes: WorkflowEventType[] = [
        'workflow:state',
        'workflow:started',
        'workflow:running',
        'agent:state',
        'agent:started',
        'agent:progress',
        'agent:completed',
        'agent:failed',
        'workflow:completed',
        'workflow:failed',
        'budget:warning',
        'budget:exceeded',
        'log:created',
      ];

      eventTypes.forEach((type) => {
        eventSource.addEventListener(type, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            handleEvent(type, data);
          } catch (err) {
            console.error(`[SSE] Failed to parse event ${type}:`, err);
          }
        });
      });

      eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        setIsConnected(false);

        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection with exponential backoff
        reconnectAttemptsRef.current++;
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);

        if (reconnectAttemptsRef.current <= 5) {
          console.log(`[SSE] Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current}/5)`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffMs);
        } else {
          const connectionError = new Error('Failed to establish SSE connection after 5 attempts');
          setError(connectionError);
          setIsStreaming(false);
          onError?.(connectionError);

          // Fallback to polling if enabled
          if (fallbackToPolling) {
            console.log('[SSE] Falling back to polling');
            // Note: Polling would need to be implemented separately
          }
        }
      };
    } catch (err) {
      const connectionError = err instanceof Error ? err : new Error('Failed to create EventSource');
      console.error('[SSE] Failed to create EventSource:', err);
      setError(connectionError);
      setIsStreaming(false);
      onError?.(connectionError);
    }
  }, [workflowId, enabled, handleEvent, onError, fallbackToPolling]);

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting from workflow stream');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  /**
   * Manual reconnect function
   */
  const reconnect = useCallback(() => {
    console.log('[SSE] Manual reconnect triggered');
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  /**
   * Connect on mount, disconnect on unmount
   */
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    workflow,
    agents,
    logs,
    isConnected,
    isStreaming,
    error,
    reconnect,
  };
}
