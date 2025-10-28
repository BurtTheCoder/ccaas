import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Activity, Clock, DollarSign, Search, Filter, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Executions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);

  const { data: executions, isLoading, refetch } = trpc.executions.list.useQuery({ 
    limit,
  });

  const filteredExecutions = executions?.filter(exec => {
    const matchesSearch = searchQuery === "" || 
      exec.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exec.executionId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || exec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Executions</h1>
            <p className="text-muted-foreground mt-2">
              Single-agent Claude Code execution history
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
                    placeholder="Search by prompt or execution ID..."
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
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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

        {/* Executions List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Execution History
            </CardTitle>
            <CardDescription>
              {filteredExecutions?.length || 0} execution{filteredExecutions?.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredExecutions && filteredExecutions.length > 0 ? (
              <div className="space-y-3">
                {filteredExecutions.map((exec) => (
                  <Link key={exec.executionId} href={`/executions/${exec.executionId}`}>
                    <a className="block p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              exec.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                              exec.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                              exec.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                              exec.status === 'timeout' ? 'bg-gray-500/10 text-gray-500' :
                              'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {exec.status}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {exec.executionId}
                            </span>
                            {exec.source && (
                              <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                {exec.source}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium mb-2 line-clamp-2">
                            {exec.prompt}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {exec.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(exec.duration / 1000).toFixed(1)}s
                              </span>
                            )}
                            {exec.cost && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${(exec.cost / 100).toFixed(2)}
                              </span>
                            )}
                            <span>
                              {exec.startedAt ? new Date(exec.startedAt).toLocaleString() : 'Not started'}
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
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No executions found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Start your first execution from a project"}
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

