# Analytics Dashboard Guide

## Overview

The Analytics Dashboard provides comprehensive metrics and insights for your Claude Code Service executions and workflows. This guide explains how to use the analytics features, understand the metrics, and leverage the data for optimization.

## Accessing Analytics

Navigate to `/analytics` in the dashboard or click **Analytics** in the sidebar menu.

## Features

### 1. Overview Analytics

The Overview tab provides a high-level summary of your system activity:

#### Key Metrics Cards
- **Total Executions**: Number of single-agent execution runs
- **Total Cost**: Aggregate spending across executions and workflows
- **Success Rate**: Percentage of successful completions
- **Total Workflows**: Number of multi-agent workflow runs

Each metric card includes trend indicators showing percentage change compared to the previous period.

#### Charts
- **Activity Trends**: Line chart showing executions and workflows over time
- **Cost Trends**: Daily spending visualization

### 2. Execution Analytics

Detailed analysis of single-agent execution performance:

#### Metrics
- **Total Executions**: Count of all execution runs
- **Success Rate**: Percentage of completed executions
- **Average Duration**: Mean execution time in seconds
- **Average Cost**: Mean cost per execution in dollars

#### Visualizations
- **Status Breakdown**: Pie chart showing distribution of execution statuses (completed, failed, running, pending, timeout)
- **Cost Distribution**: Bar chart grouping executions by cost ranges ($0-$0.10, $0.10-$0.50, $0.50-$1.00, $1.00+)
- **Duration Trend**: Line chart showing average execution duration over time

### 3. Workflow Analytics

Multi-agent workflow performance metrics:

#### Metrics
- **Total Workflows**: Count of all workflow runs
- **Success Rate**: Percentage of completed workflows
- **Average Duration**: Mean workflow completion time
- **Average Cost**: Mean cost per workflow
- **Average Agents**: Average number of agents per workflow

#### Visualizations
- **Status Distribution**: Pie chart of workflow statuses
- **Agent Success Rates**: Bar chart showing top-performing agents by success rate
- **Agent Performance**: Comparison of average duration and total runs by agent

### 4. Cost Analytics

Financial analysis and forecasting:

#### Metrics
- **Total Cost**: Aggregate spending for the selected period
- **Average Daily Cost**: Historical average daily spending
- **Recent Average (7d)**: Rolling 7-day average with trend indicator
- **7-Day Forecast**: Projected spending for next 7 days

#### Visualizations
- **Cost Over Time**: Area chart showing daily spending trends
- **Activity vs Cost**: Correlation between operations count and spending
- **Cost Efficiency**: Average cost per operation over time

### 5. Usage Analytics

Tool and integration usage breakdown:

#### Metrics
- **Total Tools Used**: Count of unique tools accessed
- **Total Tool Invocations**: Aggregate tool usage count
- **Denied Requests**: Number of blocked tool access attempts
- **Integration Sources**: Count of active integration sources

#### Visualizations
- **Tool Usage Distribution**: Pie chart of most frequently used tools
- **Activity by Source**: Bar chart showing operations per integration (Slack, GitHub, direct API)
- **Tool Usage Details**: Table with usage counts, denied requests, user counts, and risk levels
- **Integration Performance**: Success rates by source

## Date Range Selection

Use the date range selector at the top of the analytics page to filter data:

### Presets
- **Last 7 days**: Quick view of recent activity
- **Last 30 days**: Monthly overview (default)
- **Last 90 days**: Quarterly analysis

### Custom Range
Click the date picker to select a custom start and end date. The calendar allows you to choose any date range up to 2 months.

## Data Export

Export analytics data for external analysis:

1. **CSV Export**: Click **Export CSV** to download a spreadsheet-compatible file
2. **JSON Export**: Click **Export JSON** for programmatic data processing

### Export Format

CSV exports include the following columns:
- Date
- Executions
- Workflows
- Cost
- Success Count
- Failure Count
- Average Duration

JSON exports provide the full daily metrics objects with all metadata.

## Real-Time Updates

The analytics dashboard automatically refreshes data. You can also manually refresh using the **Refresh** button in the top-right corner.

## Understanding Metrics

### Cost Calculation

Costs are calculated based on:
- Execution duration
- Container resource usage
- Model API calls (if applicable)

Costs are stored in cents and displayed in dollars for readability.

### Duration Measurement

Duration is measured in milliseconds from execution/workflow start to completion. It includes:
- Container startup time
- Agent processing time
- Tool execution time
- Container cleanup time

### Success Rate Calculation

Success rate is calculated as:
```
Success Rate = (Completed Count / Total Count) × 100
```

Where:
- **Completed**: Status = 'completed'
- **Total**: All executions/workflows regardless of status

## Database Schema

### Metrics Table

Stores granular metric events:

```typescript
{
  id: number;
  executionId?: string;
  workflowId?: string;
  agentExecutionId?: string;
  userId: number;
  metricType: string; // 'execution_duration', 'execution_cost', etc.
  value: number;
  labels: Record<string, any>; // Additional metadata
  timestamp: Date;
}
```

### Daily Metrics Summary Table

Stores pre-aggregated daily statistics:

```typescript
{
  id: number;
  userId: number;
  date: string; // YYYY-MM-DD
  totalExecutions: number;
  totalWorkflows: number;
  totalCost: number; // in cents
  successCount: number;
  failureCount: number;
  avgDuration: number; // in milliseconds
  totalDuration: number;
  metadata: Record<string, any>;
}
```

## API Endpoints

The analytics feature exposes the following tRPC endpoints:

### `analytics.overview`
Returns overview metrics including daily metrics, execution stats, workflow stats, and cost trends.

**Input:**
```typescript
{
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}
```

### `analytics.executions`
Returns detailed execution statistics.

**Input:**
```typescript
{
  startDate: string;
  endDate: string;
}
```

### `analytics.workflows`
Returns workflow performance metrics.

**Input:**
```typescript
{
  startDate: string;
  endDate: string;
}
```

### `analytics.costs`
Returns cost trend data.

**Input:**
```typescript
{
  startDate: string;
  endDate: string;
}
```

### `analytics.usage`
Returns tool and integration usage metrics.

**Input:**
```typescript
{
  startDate: string;
  endDate: string;
}
```

### `analytics.agentPerformance`
Returns agent performance for a specific workflow.

**Input:**
```typescript
{
  workflowId: string;
}
```

### `analytics.export`
Exports analytics data in CSV or JSON format.

**Input:**
```typescript
{
  startDate: string;
  endDate: string;
  format: 'json' | 'csv';
}
```

## Performance Optimization

The analytics system uses several optimization techniques:

1. **Pre-aggregated Summaries**: Daily metrics are pre-calculated and stored in the `dailyMetricsSummary` table
2. **Indexed Queries**: Database indexes on `userId`, `date`, and timestamp fields
3. **Lazy Loading**: Data is only fetched for the active tab
4. **Efficient Aggregations**: SQL aggregations reduce data transfer

## Troubleshooting

### No Data Displayed

If no data appears in the analytics dashboard:

1. Verify that executions or workflows have been run during the selected date range
2. Check that metric recording is enabled in `executionService.ts` and `workflowService.ts`
3. Ensure the database tables `metrics` and `dailyMetricsSummary` exist
4. Check browser console for API errors

### Slow Loading

If analytics pages load slowly:

1. Reduce the date range to limit data volume
2. Check database query performance with `EXPLAIN` statements
3. Ensure proper indexes exist on metrics tables
4. Consider implementing caching for frequently accessed date ranges

### Incorrect Metrics

If metrics appear incorrect:

1. Verify the date range selection matches your expectations
2. Check that timezone conversions are handled correctly
3. Ensure cost calculations in `executionService.ts` are accurate
4. Review metric recording logic for edge cases

## Best Practices

1. **Regular Monitoring**: Check analytics weekly to identify trends and anomalies
2. **Cost Optimization**: Use cost analytics to identify expensive operations and optimize them
3. **Performance Tuning**: Monitor duration trends to catch performance degradation early
4. **Tool Auditing**: Review tool usage regularly to ensure appropriate access controls
5. **Export Data**: Periodically export data for long-term archival and deeper analysis

## Future Enhancements

Planned analytics features:

- Real-time streaming metrics (30-second auto-refresh)
- Custom metric dashboards with drag-and-drop widgets
- Alerting for anomalies and budget thresholds
- Comparative analysis (compare two time periods side-by-side)
- MCP server performance analytics
- Docker container metrics and efficiency analysis
- User activity breakdown and team collaboration metrics
- Machine learning-based cost forecasting

## Support

For questions or issues with analytics:

1. Check this guide for answers
2. Review the implementation in `/server/metricsService.ts`
3. Examine the React components in `/client/src/components/analytics/`
4. Open an issue on GitHub with reproduction steps
