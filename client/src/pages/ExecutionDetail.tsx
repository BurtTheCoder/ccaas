import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowLeft, Clock, DollarSign, Calendar, Container, FileText } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function ExecutionDetail() {
  const [, params] = useRoute("/executions/:id");
  const executionId = params?.id || "";

  const { data: execution, isLoading } = trpc.executions.status.useQuery(
    { executionId },
    { 
      enabled: !!executionId, 
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.status === 'running' || data?.status === 'pending' ? 2000 : false;
      }
    }
  );

  const { data: logs } = trpc.executions.logs.useQuery(
    { executionId },
    { enabled: !!executionId }
  );

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

  if (!execution) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Execution not found</p>
              <Link href="/executions">
                <Button>Back to Executions</Button>
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
          <Link href="/executions">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Execution Detail</h1>
            <p className="text-muted-foreground mt-1">{executionId}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            execution.status === 'completed' ? 'bg-green-500/10 text-green-500' :
            execution.status === 'failed' ? 'bg-red-500/10 text-red-500' :
            execution.status === 'running' ? 'bg-blue-500/10 text-blue-500 animate-pulse' :
            execution.status === 'timeout' ? 'bg-gray-500/10 text-gray-500' :
            'bg-yellow-500/10 text-yellow-500'
          }`}>
            {execution.status}
          </span>
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
                  {execution.duration ? `${(execution.duration / 1000).toFixed(1)}s` : '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {execution.cost ? `$${(execution.cost / 100).toFixed(2)}` : '-'}
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
                  {execution.startedAt ? new Date(execution.startedAt).toLocaleString() : 'Not started'}
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
                  {execution.completedAt ? new Date(execution.completedAt).toLocaleString() : 'In progress'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Prompt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm">{execution.prompt}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Container Info */}
        {execution.containerId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Container className="h-5 w-5" />
                Container Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Container ID</dt>
                  <dd className="text-sm font-mono mt-1">{execution.containerId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Source</dt>
                  <dd className="text-sm mt-1">{execution.source || 'Unknown'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Logs</CardTitle>
            <CardDescription>Real-time output from the execution</CardDescription>
          </CardHeader>
          <CardContent>
            {logs && logs.length > 0 ? (
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    <span className={
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-yellow-400' :
                      'text-green-400'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
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

