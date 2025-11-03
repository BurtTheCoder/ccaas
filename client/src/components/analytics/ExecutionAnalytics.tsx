import { ChartContainer } from "./ChartContainer";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";

interface ExecutionAnalyticsProps {
  stats: {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    avgCost: number;
    statusBreakdown: Record<string, number>;
    costDistribution: Array<{ range: string; count: number }>;
    durationTrend: Array<{ date: string; avgDuration: number }>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  failed: "#ef4444",
  running: "#3b82f6",
  pending: "#6b7280",
  timeout: "#f59e0b",
};

export function ExecutionAnalytics({ stats }: ExecutionAnalyticsProps) {
  // Prepare status breakdown for pie chart
  const statusData = Object.entries(stats.statusBreakdown).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

  // Prepare duration trend data
  const durationData = stats.durationTrend.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    duration: d.avgDuration / 1000, // Convert to seconds
  }));

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Executions</p>
          <p className="text-2xl font-bold mt-2">{stats.totalExecutions}</p>
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Breakdown */}
        <ChartContainer title="Status Breakdown" description="Execution status distribution">
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
              No execution data available
            </div>
          )}
        </ChartContainer>

        {/* Cost Distribution */}
        <ChartContainer title="Cost Distribution" description="Execution cost ranges">
          {stats.costDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.costDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#10b981" name="Executions" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No cost distribution data
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Duration Trend */}
      <ChartContainer title="Duration Trend" description="Average execution duration over time">
        {durationData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={durationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)}s`} />
              <Legend />
              <Line type="monotone" dataKey="duration" stroke="#3b82f6" name="Avg Duration (s)" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No duration trend data
          </div>
        )}
      </ChartContainer>
    </div>
  );
}
