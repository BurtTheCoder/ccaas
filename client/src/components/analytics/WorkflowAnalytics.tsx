import { ChartContainer } from "./ChartContainer";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface WorkflowAnalyticsProps {
  stats: {
    totalWorkflows: number;
    successRate: number;
    avgDuration: number;
    avgCost: number;
    avgAgentsPerWorkflow: number;
    statusBreakdown: Record<string, number>;
    agentPerformance: Array<{
      agentName: string;
      avgDuration: number;
      successRate: number;
      totalRuns: number;
    }>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  failed: "#ef4444",
  running: "#3b82f6",
  paused: "#f59e0b",
  pending: "#6b7280",
  cancelled: "#9ca3af",
};

export function WorkflowAnalytics({ stats }: WorkflowAnalyticsProps) {
  // Prepare status breakdown for pie chart
  const statusData = Object.entries(stats.statusBreakdown).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

  // Sort agent performance by total runs
  const agentData = [...stats.agentPerformance]
    .sort((a, b) => b.totalRuns - a.totalRuns)
    .slice(0, 10) // Top 10 agents
    .map(a => ({
      name: a.agentName.length > 20 ? a.agentName.slice(0, 20) + '...' : a.agentName,
      duration: a.avgDuration / 1000, // Convert to seconds
      successRate: a.successRate,
      runs: a.totalRuns,
    }));

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Workflows</p>
          <p className="text-2xl font-bold mt-2">{stats.totalWorkflows}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Success Rate</p>
          <p className="text-2xl font-bold mt-2">{stats.successRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg Duration</p>
          <p className="text-2xl font-bold mt-2">{(stats.avgDuration / 1000).toFixed(1)}s</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg Cost</p>
          <p className="text-2xl font-bold mt-2">${(stats.avgCost / 100).toFixed(3)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg Agents</p>
          <p className="text-2xl font-bold mt-2">{stats.avgAgentsPerWorkflow.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Breakdown */}
        <ChartContainer title="Status Distribution" description="Workflow status breakdown">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name.toLowerCase()] || "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No workflow data available
            </div>
          )}
        </ChartContainer>

        {/* Agent Success Rates */}
        <ChartContainer title="Agent Success Rates" description="Top performing agents">
          {agentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="successRate" fill="#10b981" name="Success Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No agent performance data
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Agent Duration Comparison */}
      <ChartContainer title="Agent Performance" description="Average duration by agent (top 10)">
        {agentData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={agentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="duration" fill="#3b82f6" name="Avg Duration (s)" />
              <Bar dataKey="runs" fill="#8b5cf6" name="Total Runs" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No agent duration data
          </div>
        )}
      </ChartContainer>
    </div>
  );
}
