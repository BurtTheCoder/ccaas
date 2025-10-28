import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { GitBranch, ArrowLeft, Clock, DollarSign, Calendar, Users, Activity, Pause, Play, XCircle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import { useWorkflowStream } from "@/hooks/useWorkflowStream";
import { useMemo } from "react";

export default function WorkflowDetail() {
  const [, params] = useRoute("/workflows/:id");
  const workflowId = params?.id || "";

  // Use SSE streaming for real-time updates
  const {
    workflow: streamedWorkflow,
    agents: streamedAgents,
    logs: streamedLogs,
    isConnected,
    isStreaming,
    error: streamError,
    reconnect,
  } = useWorkflowStream(workflowId, {
    enabled: !!workflowId,
    onEvent: (type, data) => {
      // Show toasts for important events
      if (type === 'workflow:completed') {
        toast.success('Workflow completed successfully!');
      } else if (type === 'workflow:failed') {
        toast.error(`Workflow failed: ${data.error}`);
      } else if (type === 'budget:warning') {
        toast.warning(`Budget warning: ${data.percentageUsed.toFixed(0)}% used`);
      } else if (type === 'budget:exceeded') {
        toast.error('Budget limit exceeded!');
      }
    },
    onError: (error) => {
      console.error('[WorkflowDetail] Stream error:', error);
    },
    fallbackToPolling: true,
  });

  // Fallback to tRPC polling if SSE is not available or fails
  const { data: polledWorkflow, isLoading } = trpc.workflows.status.useQuery(
    { workflowId },
    {
      enabled: !!workflowId && !isStreaming,
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.status === 'running' || data?.status === 'pending' ? 2000 : false;
      }
    }
  );

  const { data: polledAgents } = trpc.workflows.agentExecutions.useQuery(
    { workflowId },
    { enabled: !!workflowId && !isStreaming }
  );

  const { data: polledLogs } = trpc.workflows.logs.useQuery(
    { workflowId },
    { enabled: !!workflowId && !isStreaming }
  );

  // Use streamed data if available, otherwise use polled data
  const workflow = streamedWorkflow || polledWorkflow;
  const agents = useMemo(() => {
    if (isStreaming && streamedAgents.size > 0) {
      return Array.from(streamedAgents.values());
    }
    return polledAgents || [];
  }, [isStreaming, streamedAgents, polledAgents]);

  const logs = isStreaming && streamedLogs.length > 0 ? streamedLogs : polledLogs || [];

  const utils = trpc.useUtils();

  const pauseMutation = trpc.workflows.pause.useMutation({
    onSuccess: () => {
      toast.success('Workflow paused');
      utils.workflows.status.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to pause: ${error.message}`);
    },
  });

  const resumeMutation = trpc.workflows.resume.useMutation({
    onSuccess: () => {
      toast.success('Workflow resumed');
      utils.workflows.status.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to resume: ${error.message}`);
    },
  });

  const cancelMutation = trpc.workflows.cancel.useMutation({
    onSuccess: () => {
      toast.success('Workflow cancelled');
      utils.workflows.status.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!workflow) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Workflow not found</p>
              <Link href="/workflows">
                <Button>Back to Workflows</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/workflows">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{workflow.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">{workflowId}</p>
              {isStreaming && (
                <div className="flex items-center gap-1 text-xs">
                  {isConnected ? (
                    <>
                      <Wifi className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-orange-500" />
                      <span className="text-orange-500">Connecting...</span>
                    </>
                  )}
                </div>
              )}
              {streamError && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reconnect}
                  className="h-6 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reconnect
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              workflow.status === 'completed' ? 'bg-green-500/10 text-green-500' :
              workflow.status === 'failed' ? 'bg-red-500/10 text-red-500' :
              workflow.status === 'running' ? 'bg-blue-500/10 text-blue-500 animate-pulse' :
              workflow.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
              'bg-gray-500/10 text-gray-500'
            }`}>
              {workflow.status}
            </span>
            
            {/* Control Buttons */}
            {workflow.status === 'running' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pauseMutation.mutate({ workflowId })}
                  disabled={pauseMutation.isPending}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this workflow?')) {
                      cancelMutation.mutate({ workflowId });
                    }
                  }}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
            
            {workflow.status === 'paused' && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => resumeMutation.mutate({ workflowId })}
                  disabled={resumeMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this workflow?')) {
                      cancelMutation.mutate({ workflowId });
                    }
                  }}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {workflow.duration ? `${(workflow.duration / 1000).toFixed(1)}s` : '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {workflow.totalCost ? `$${(workflow.totalCost / 100).toFixed(2)}` : '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Started</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {workflow.startedAt ? new Date(workflow.startedAt).toLocaleString() : 'Not started'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {workflow.completedAt ? new Date(workflow.completedAt).toLocaleString() : 'In progress'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Executions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Agent Executions
            </CardTitle>
            <CardDescription>Individual agent runs in this workflow</CardDescription>
          </CardHeader>
          <CardContent>
            {agents && agents.length > 0 ? (
              <div className="space-y-3">
                {agents.map((agent, index) => {
                  // Handle both polled and streamed agent data
                  const agentKey = 'id' in agent ? agent.id : `${agent.agentName}-${agent.stepNumber}`;
                  const prompt = 'prompt' in agent ? agent.prompt : undefined;

                  return (
                    <div key={agentKey} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium">Agent #{index + 1}: {agent.agentName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              agent.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                              agent.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                              agent.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                              'bg-gray-500/10 text-gray-500'
                            }`}>
                              {agent.status}
                            </span>
                          </div>
                          {prompt && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {prompt}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {agent.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(agent.duration / 1000).toFixed(1)}s
                              </span>
                            )}
                            {agent.cost && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${(agent.cost / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No agent executions yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Workflow Logs
            </CardTitle>
            <CardDescription>Real-time output from the workflow</CardDescription>
          </CardHeader>
          <CardContent>
            {logs && logs.length > 0 ? (
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                {logs.map((log, index) => {
                  const timestamp = log.timestamp instanceof Date
                    ? log.timestamp
                    : new Date(log.timestamp);
                  return (
                    <div key={index} className="mb-1">
                      <span className="text-gray-500">[{timestamp.toLocaleTimeString()}]</span>{' '}
                      <span className={
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warn' ? 'text-yellow-400' :
                        'text-green-400'
                      }>
                        {log.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No logs available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

