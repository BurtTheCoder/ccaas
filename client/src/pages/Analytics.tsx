import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Download, RefreshCw, BarChart3 } from "lucide-react";
import { useState } from "react";
import { DateRange, DateRangeSelector } from "@/components/analytics/DateRangeSelector";
import { OverviewAnalytics } from "@/components/analytics/OverviewAnalytics";
import { ExecutionAnalytics } from "@/components/analytics/ExecutionAnalytics";
import { WorkflowAnalytics } from "@/components/analytics/WorkflowAnalytics";
import { CostAnalytics } from "@/components/analytics/CostAnalytics";
import { UsageAnalytics } from "@/components/analytics/UsageAnalytics";
import { toast } from "sonner";

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  const [activeTab, setActiveTab] = useState("overview");

  // Format dates for API
  const startDate = dateRange.from.toISOString().split('T')[0];
  const endDate = dateRange.to.toISOString().split('T')[0];

  // Fetch data based on active tab
  const { data: overviewData, isLoading: overviewLoading, refetch: refetchOverview } = trpc.analytics.overview.useQuery(
    { startDate, endDate },
    { enabled: activeTab === "overview" }
  );

  const { data: executionData, isLoading: executionLoading, refetch: refetchExecution } = trpc.analytics.executions.useQuery(
    { startDate, endDate },
    { enabled: activeTab === "executions" }
  );

  const { data: workflowData, isLoading: workflowLoading, refetch: refetchWorkflow } = trpc.analytics.workflows.useQuery(
    { startDate, endDate },
    { enabled: activeTab === "workflows" }
  );

  const { data: costData, isLoading: costLoading, refetch: refetchCost } = trpc.analytics.costs.useQuery(
    { startDate, endDate },
    { enabled: activeTab === "costs" }
  );

  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = trpc.analytics.usage.useQuery(
    { startDate, endDate },
    { enabled: activeTab === "usage" }
  );

  const handleRefresh = () => {
    switch (activeTab) {
      case "overview":
        refetchOverview();
        break;
      case "executions":
        refetchExecution();
        break;
      case "workflows":
        refetchWorkflow();
        break;
      case "costs":
        refetchCost();
        break;
      case "usage":
        refetchUsage();
        break;
    }
    toast.success("Analytics data refreshed");
  };

  const exportMutation = trpc.analytics.export.useQuery(
    { startDate, endDate, format: 'json' },
    { enabled: false }
  );

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      // Manually fetch the data
      const response = await fetch(`/api/trpc/analytics.export?input=${encodeURIComponent(JSON.stringify({ startDate, endDate, format }))}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const result = await response.json();
      const data = result.result?.data;

      if (!data) {
        throw new Error('No data received');
      }

      // Create download link
      const blob = new Blob([data.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${startDate}-to-${endDate}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export analytics");
      console.error(error);
    }
  };

  const isLoading = overviewLoading || executionLoading || workflowLoading || costLoading || usageLoading;

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Analytics Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive metrics and insights for your executions and workflows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center justify-between border-b pb-4">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          <p className="text-sm text-muted-foreground">
            Showing data from {dateRange.from.toLocaleDateString()} to {dateRange.to.toLocaleDateString()}
          </p>
        </div>

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {overviewLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : overviewData ? (
              <OverviewAnalytics
                dailyMetrics={overviewData.dailyMetrics}
                execStats={overviewData.execStats}
                workflowStats={overviewData.workflowStats}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No overview data available for the selected date range
              </div>
            )}
          </TabsContent>

          <TabsContent value="executions" className="space-y-4">
            {executionLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : executionData ? (
              <ExecutionAnalytics stats={executionData} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No execution data available for the selected date range
              </div>
            )}
          </TabsContent>

          <TabsContent value="workflows" className="space-y-4">
            {workflowLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : workflowData ? (
              <WorkflowAnalytics stats={workflowData} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No workflow data available for the selected date range
              </div>
            )}
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            {costLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : costData ? (
              <CostAnalytics trends={costData} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No cost data available for the selected date range
              </div>
            )}
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            {usageLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : usageData ? (
              <UsageAnalytics
                toolUsage={usageData.toolUsage}
                integrationMetrics={usageData.integrationMetrics}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No usage data available for the selected date range
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
