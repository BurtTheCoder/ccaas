import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { DollarSign, TrendingUp, TrendingDown, Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";

export default function Budget() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: todayBudget, refetch: refetchToday } = trpc.budget.today.useQuery();
  const { data: rangeData, refetch: refetchRange } = trpc.budget.range.useQuery(dateRange);

  const totalCost = rangeData?.reduce((sum, day) => sum + (day.dailyCost || 0), 0) || 0;
  const avgCost = rangeData && rangeData.length > 0 ? totalCost / rangeData.length : 0;
  const totalExecutions = rangeData?.reduce((sum, day) => sum + (day.executionCount || 0), 0) || 0;
  const totalWorkflows = rangeData?.reduce((sum, day) => sum + (day.workflowCount || 0), 0) || 0;

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Budget & Costs</h1>
            <p className="text-muted-foreground mt-2">
              Track execution costs and budget usage
            </p>
          </div>
          <Button onClick={() => {
            refetchToday();
            refetchRange();
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Today's Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  ${todayBudget ? (todayBudget.dailyCost / 100).toFixed(2) : '0.00'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Executions Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayBudget?.executionCount || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Workflows Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayBudget?.workflowCount || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Budget Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                Active
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Last 30 Days Summary
                </CardTitle>
                <CardDescription>
                  {dateRange.startDate} to {dateRange.endDate}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${(totalCost / 100).toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Average Daily Cost</p>
                <p className="text-2xl font-bold">${(avgCost / 100).toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Executions</p>
                <p className="text-2xl font-bold">{totalExecutions}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Workflows</p>
                <p className="text-2xl font-bold">{totalWorkflows}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
            <CardDescription>Cost and usage per day</CardDescription>
          </CardHeader>
          <CardContent>
            {rangeData && rangeData.length > 0 ? (
              <div className="space-y-2">
                {rangeData.slice().reverse().map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-medium w-32">
                        {new Date(day.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span>{day.executionCount || 0} executions</span>
                        <span>{day.workflowCount || 0} workflows</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">
                        ${(day.dailyCost / 100).toFixed(2)}
                      </span>
                      {day.dailyCost > avgCost ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No cost data yet</p>
                <p className="text-sm text-muted-foreground">
                  Start executing tasks to see cost tracking
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

