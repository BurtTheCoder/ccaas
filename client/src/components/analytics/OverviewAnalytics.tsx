import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, DollarSign, TrendingDown, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { ChartContainer } from "./ChartContainer";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface OverviewAnalyticsProps {
  dailyMetrics: Array<{
    date: string;
    totalExecutions: number;
    totalWorkflows: number;
    totalCost: number;
    successCount: number;
    failureCount: number;
    avgDuration: number;
  }>;
  execStats: {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    avgCost: number;
  };
  workflowStats: {
    totalWorkflows: number;
    successRate: number;
    avgDuration: number;
    avgCost: number;
  };
}

export function OverviewAnalytics({ dailyMetrics, execStats, workflowStats }: OverviewAnalyticsProps) {
  // Calculate trends
  const recentDays = dailyMetrics.slice(-7);
  const previousDays = dailyMetrics.slice(-14, -7);

  const recentCost = recentDays.reduce((sum, d) => sum + d.totalCost, 0);
  const previousCost = previousDays.reduce((sum, d) => sum + d.totalCost, 0);
  const costTrend = previousCost > 0 ? ((recentCost - previousCost) / previousCost) * 100 : 0;

  const recentExecutions = recentDays.reduce((sum, d) => sum + d.totalExecutions, 0);
  const previousExecutions = previousDays.reduce((sum, d) => sum + d.totalExecutions, 0);
  const executionTrend = previousExecutions > 0 ? ((recentExecutions - previousExecutions) / previousExecutions) * 100 : 0;

  const recentSuccess = recentDays.reduce((sum, d) => sum + d.successCount, 0);
  const recentTotal = recentDays.reduce((sum, d) => sum + d.successCount + d.failureCount, 0);
  const successRate = recentTotal > 0 ? (recentSuccess / recentTotal) * 100 : 0;

  const stats = [
    {
      title: "Total Executions",
      value: execStats.totalExecutions,
      icon: Activity,
      trend: executionTrend,
      color: "text-blue-500",
    },
    {
      title: "Total Cost",
      value: `$${((execStats.avgCost * execStats.totalExecutions + workflowStats.avgCost * workflowStats.totalWorkflows) / 100).toFixed(2)}`,
      icon: DollarSign,
      trend: costTrend,
      color: "text-green-500",
    },
    {
      title: "Success Rate",
      value: `${successRate.toFixed(1)}%`,
      icon: CheckCircle,
      trend: 0,
      color: "text-emerald-500",
    },
    {
      title: "Total Workflows",
      value: workflowStats.totalWorkflows,
      icon: Activity,
      trend: 0,
      color: "text-purple-500",
    },
  ];

  // Prepare chart data
  const chartData = dailyMetrics.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    executions: d.totalExecutions,
    workflows: d.totalWorkflows,
    cost: d.totalCost / 100,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isTrendPositive = stat.trend > 0;
          const TrendIcon = isTrendPositive ? TrendingUp : TrendingDown;

          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.trend !== 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendIcon className={`h-3 w-3 ${isTrendPositive ? 'text-green-500' : 'text-red-500'}`} />
                    <span>{Math.abs(stat.trend).toFixed(1)}% vs last week</span>
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Trend Chart */}
      <ChartContainer title="Activity Trends" description="Executions and workflows over time">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="executions" stroke="#3b82f6" name="Executions" />
            <Line type="monotone" dataKey="workflows" stroke="#8b5cf6" name="Workflows" />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Cost Trend Chart */}
      <ChartContainer title="Cost Trends" description="Daily cost over time">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Legend />
            <Line type="monotone" dataKey="cost" stroke="#10b981" name="Cost ($)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
