import { ChartContainer } from "./ChartContainer";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

interface CostAnalyticsProps {
  trends: Array<{
    date: string;
    cost: number;
    executionCount: number;
    workflowCount: number;
  }>;
}

export function CostAnalytics({ trends }: CostAnalyticsProps) {
  // Prepare data
  const chartData = trends.map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: t.cost / 100, // Convert cents to dollars
    executions: t.executionCount,
    workflows: t.workflowCount,
    total: t.executionCount + t.workflowCount,
  }));

  // Calculate totals and forecasts
  const totalCost = trends.reduce((sum, t) => sum + t.cost, 0) / 100;
  const avgDailyCost = trends.length > 0 ? totalCost / trends.length : 0;
  const recentCosts = trends.slice(-7).map(t => t.cost / 100);
  const recentAvg = recentCosts.reduce((sum, c) => sum + c, 0) / recentCosts.length;

  // Simple linear forecast for next 7 days
  const forecastDays = 7;
  const forecast = avgDailyCost * forecastDays;

  // Calculate trend
  const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
  const secondHalf = trends.slice(Math.floor(trends.length / 2));
  const firstAvg = firstHalf.reduce((sum, t) => sum + t.cost, 0) / firstHalf.length / 100;
  const secondAvg = secondHalf.reduce((sum, t) => sum + t.cost, 0) / secondHalf.length / 100;
  const trendPercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="text-2xl font-bold mt-2">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Period total</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg Daily Cost</p>
          <p className="text-2xl font-bold mt-2">${avgDailyCost.toFixed(3)}</p>
          <p className="text-xs text-muted-foreground mt-1">Historical average</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Recent Avg (7d)</p>
          <p className="text-2xl font-bold mt-2">${recentAvg.toFixed(3)}</p>
          <p className={`text-xs mt-1 ${trendPercent >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {trendPercent >= 0 ? '+' : ''}{trendPercent.toFixed(1)}% trend
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">7-Day Forecast</p>
          <p className="text-2xl font-bold mt-2">${forecast.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Projected</p>
        </div>
      </div>

      {/* Cost Over Time */}
      <ChartContainer title="Cost Over Time" description="Daily spending trends">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toFixed(3)}`} />
              <Legend />
              <Area type="monotone" dataKey="cost" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Cost ($)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No cost data available
          </div>
        )}
      </ChartContainer>

      {/* Activity and Cost Correlation */}
      <ChartContainer title="Activity vs Cost" description="Relationship between activity and spending">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="total" stroke="#3b82f6" name="Total Operations" />
              <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#10b981" name="Cost ($)" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No activity data available
          </div>
        )}
      </ChartContainer>

      {/* Cost per Operation Trend */}
      <ChartContainer title="Cost Efficiency" description="Average cost per operation over time">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.map(d => ({ ...d, costPerOp: d.total > 0 ? d.cost / d.total : 0 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
              <Legend />
              <Line type="monotone" dataKey="costPerOp" stroke="#8b5cf6" name="Cost per Operation ($)" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No efficiency data available
          </div>
        )}
      </ChartContainer>
    </div>
  );
}
