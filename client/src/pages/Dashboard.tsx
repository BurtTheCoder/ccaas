import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, GitBranch, DollarSign, Clock, TrendingUp, AlertCircle, Key } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: executions, isLoading: executionsLoading } = trpc.executions.list.useQuery({ limit: 5 });
  const { data: workflows, isLoading: workflowsLoading } = trpc.workflows.list.useQuery({ limit: 5 });
  const { data: budget } = trpc.budget.today.useQuery();
  const { data: notifications } = trpc.notifications.list.useQuery({ unreadOnly: true });

  const stats = [
    {
      title: "Total Executions",
      value: executions?.length || 0,
      icon: Activity,
      description: "Single-agent runs",
      href: "/executions",
    },
    {
      title: "Active Workflows",
      value: workflows?.filter(w => w.status === 'running' || w.status === 'pending').length || 0,
      icon: GitBranch,
      description: "Multi-agent workflows",
      href: "/workflows",
    },
    {
      title: "Today's Cost",
      value: budget ? `$${(budget.dailyCost / 100).toFixed(2)}` : "$0.00",
      icon: DollarSign,
      description: "Execution costs",
      href: "/budget",
    },
    {
      title: "Notifications",
      value: notifications?.length || 0,
      icon: AlertCircle,
      description: "Unread alerts",
      href: "/notifications",
    },
  ];

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back, {user?.name || 'User'}! Here's what's happening with your Claude Code Service.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {stat.title}
                      </CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
              </Link>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent Executions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Executions
              </CardTitle>
              <CardDescription>Latest single-agent runs</CardDescription>
            </CardHeader>
            <CardContent>
              {executionsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : executions && executions.length > 0 ? (
                <div className="space-y-3">
                  {executions.map((exec) => (
                    <Link key={exec.executionId} href={`/executions/${exec.executionId}`}>
                      <a className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{exec.prompt}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                exec.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                exec.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                exec.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                                'bg-gray-500/10 text-gray-500'
                              }`}>
                                {exec.status}
                              </span>
                              {exec.duration && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {(exec.duration / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                          </div>
                          {exec.cost && (
                            <span className="text-sm font-medium text-muted-foreground ml-2">
                              ${(exec.cost / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </a>
                    </Link>
                  ))}
                  <Link href="/executions">
                    <a className="block text-sm text-primary hover:underline text-center py-2">
                      View all executions →
                    </a>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No executions yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Workflows */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Recent Workflows
              </CardTitle>
              <CardDescription>Latest multi-agent workflows</CardDescription>
            </CardHeader>
            <CardContent>
              {workflowsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : workflows && workflows.length > 0 ? (
                <div className="space-y-3">
                  {workflows.map((workflow) => (
                    <Link key={workflow.workflowId} href={`/workflows/${workflow.workflowId}`}>
                      <a className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{workflow.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                workflow.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                workflow.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                workflow.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                                workflow.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
                                'bg-gray-500/10 text-gray-500'
                              }`}>
                                {workflow.status}
                              </span>
                              {workflow.duration && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {(workflow.duration / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                          </div>
                          {workflow.totalCost && (
                            <span className="text-sm font-medium text-muted-foreground ml-2">
                              ${(workflow.totalCost / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </a>
                    </Link>
                  ))}
                  <Link href="/workflows">
                    <a className="block text-sm text-primary hover:underline text-center py-2">
                      View all workflows →
                    </a>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No workflows yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/projects">
                <a className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">New Execution</p>
                    <p className="text-xs text-muted-foreground">Run single-agent task</p>
                  </div>
                </a>
              </Link>
              
              <Link href="/projects">
                <a className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">New Workflow</p>
                    <p className="text-xs text-muted-foreground">Start multi-agent workflow</p>
                  </div>
                </a>
              </Link>
              
              <Link href="/api-keys">
                <a className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">API Keys</p>
                    <p className="text-xs text-muted-foreground">Manage access keys</p>
                  </div>
                </a>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

