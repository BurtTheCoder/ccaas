import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { GitBranch, Clock, DollarSign, Search, Filter, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Workflows() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);

  const { data: workflows, isLoading, refetch } = trpc.workflows.list.useQuery({ limit });

  const filteredWorkflows = workflows?.filter(workflow => {
    const matchesSearch = searchQuery === "" || 
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.workflowId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || workflow.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
            <p className="text-muted-foreground mt-2">
              Multi-agent workflow execution history
            </p>
          </div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or workflow ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 items</SelectItem>
                  <SelectItem value="50">50 items</SelectItem>
                  <SelectItem value="100">100 items</SelectItem>
                  <SelectItem value="200">200 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Workflows List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Workflow History
            </CardTitle>
            <CardDescription>
              {filteredWorkflows?.length || 0} workflow{filteredWorkflows?.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredWorkflows && filteredWorkflows.length > 0 ? (
              <div className="space-y-3">
                {filteredWorkflows.map((workflow) => (
                  <Link key={workflow.workflowId} href={`/workflows/${workflow.workflowId}`}>
                    <a className="block p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              workflow.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                              workflow.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                              workflow.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                              workflow.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
                              'bg-gray-500/10 text-gray-500'
                            }`}>
                              {workflow.status}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {workflow.workflowId}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-2">
                            {workflow.name}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">

                            {workflow.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(workflow.duration / 1000).toFixed(1)}s
                              </span>
                            )}
                            {workflow.totalCost && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${(workflow.totalCost / 100).toFixed(2)}
                              </span>
                            )}
                            <span>
                              {workflow.startedAt ? new Date(workflow.startedAt).toLocaleString() : 'Not started'}
                            </span>
                          </div>

                        </div>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No workflows found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Start your first workflow from a project"}
                </p>
                <Link href="/projects">
                  <Button>View Projects</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

