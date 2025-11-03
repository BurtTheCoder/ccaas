import { ChartContainer } from "./ChartContainer";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";

interface UsageAnalyticsProps {
  toolUsage: Array<{
    toolName: string;
    usageCount: number;
    deniedCount: number;
    totalUsers: number;
    riskLevel: string;
  }>;
  integrationMetrics: Array<{
    source: string;
    totalExecutions: number;
    totalWorkflows: number;
    successRate: number;
    avgCost: number;
  }>;
}

const RISK_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
  unknown: "#6b7280",
};

export function UsageAnalytics({ toolUsage, integrationMetrics }: UsageAnalyticsProps) {
  // Sort tools by usage
  const topTools = [...toolUsage]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 15);

  // Prepare integration data
  const integrationData = integrationMetrics.map(i => ({
    name: i.source.charAt(0).toUpperCase() + i.source.slice(1),
    executions: i.totalExecutions,
    workflows: i.totalWorkflows,
    total: i.totalExecutions + i.totalWorkflows,
    successRate: i.successRate,
    avgCost: i.avgCost / 100,
  }));

  // Tool usage pie chart
  const toolPieData = topTools.slice(0, 8).map(t => ({
    name: t.toolName,
    value: t.usageCount,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Tools Used</p>
          <p className="text-2xl font-bold mt-2">{toolUsage.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Tool Invocations</p>
          <p className="text-2xl font-bold mt-2">
            {toolUsage.reduce((sum, t) => sum + t.usageCount, 0)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Denied Requests</p>
          <p className="text-2xl font-bold mt-2">
            {toolUsage.reduce((sum, t) => sum + t.deniedCount, 0)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Integration Sources</p>
          <p className="text-2xl font-bold mt-2">{integrationMetrics.length}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tool Usage Distribution */}
        <ChartContainer title="Tool Usage Distribution" description="Most frequently used tools">
          {toolPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={toolPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {toolPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${(index * 360) / toolPieData.length}, 70%, 50%)`} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No tool usage data
            </div>
          )}
        </ChartContainer>

        {/* Integration Activity */}
        <ChartContainer title="Activity by Source" description="Operations per integration">
          {integrationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={integrationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="executions" stackId="a" fill="#3b82f6" name="Executions" />
                <Bar dataKey="workflows" stackId="a" fill="#8b5cf6" name="Workflows" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No integration data
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Tool Usage Table */}
      <ChartContainer title="Tool Usage Details" description="Detailed tool usage statistics">
        {topTools.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Tool</th>
                  <th className="text-right p-2 font-medium">Usage</th>
                  <th className="text-right p-2 font-medium">Denied</th>
                  <th className="text-right p-2 font-medium">Users</th>
                  <th className="text-center p-2 font-medium">Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {topTools.map((tool, index) => (
                  <tr key={index} className="border-b hover:bg-accent/50">
                    <td className="p-2 font-medium">{tool.toolName}</td>
                    <td className="p-2 text-right">{tool.usageCount}</td>
                    <td className="p-2 text-right">
                      {tool.deniedCount > 0 ? (
                        <span className="text-red-500">{tool.deniedCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="p-2 text-right">{tool.totalUsers}</td>
                    <td className="p-2 text-center">
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: RISK_COLORS[tool.riskLevel] + '20',
                          color: RISK_COLORS[tool.riskLevel],
                          borderColor: RISK_COLORS[tool.riskLevel],
                        }}
                      >
                        {tool.riskLevel}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            No tool usage data available
          </div>
        )}
      </ChartContainer>

      {/* Integration Success Rates */}
      {integrationData.length > 0 && (
        <ChartContainer title="Integration Performance" description="Success rates by source">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={integrationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="successRate" fill="#10b981" name="Success Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}
