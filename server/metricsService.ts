import { getDb } from "./db";
import {
  metrics,
  dailyMetricsSummary,
  executions,
  workflows,
  agentExecutions,
  toolAccessAudit,
  InsertMetric,
  InsertDailyMetricsSummary
} from "../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";

/**
 * Metric Types
 */
export type MetricType =
  | "execution_duration"
  | "execution_cost"
  | "workflow_duration"
  | "workflow_cost"
  | "agent_duration"
  | "agent_cost"
  | "tool_usage"
  | "container_build"
  | "api_call";

/**
 * Analytics Response Types
 */
export interface DailyMetrics {
  date: string;
  totalExecutions: number;
  totalWorkflows: number;
  totalCost: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
}

export interface ExecutionStats {
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
  statusBreakdown: Record<string, number>;
  costDistribution: Array<{ range: string; count: number }>;
  durationTrend: Array<{ date: string; avgDuration: number }>;
}

export interface WorkflowStats {
  totalWorkflows: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
  avgAgentsPerWorkflow: number;
  statusBreakdown: Record<string, number>;
  agentPerformance: Array<{ agentName: string; avgDuration: number; successRate: number; totalRuns: number }>;
}

export interface CostTrend {
  date: string;
  cost: number;
  executionCount: number;
  workflowCount: number;
}

export interface ToolUsageStats {
  toolName: string;
  usageCount: number;
  deniedCount: number;
  totalUsers: number;
  riskLevel: string;
}

export interface IntegrationMetrics {
  source: string;
  totalExecutions: number;
  totalWorkflows: number;
  successRate: number;
  avgCost: number;
}

export interface AgentStats {
  agentName: string;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
  avgCost: number;
  successRate: number;
}

/**
 * Record a metric for analytics
 */
export async function recordMetric(
  userId: number,
  metricType: MetricType,
  value: number,
  labels?: Record<string, any>,
  executionId?: string,
  workflowId?: string,
  agentExecutionId?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Metrics] Cannot record metric: database not available");
    return;
  }

  try {
    await db.insert(metrics).values({
      userId,
      metricType,
      value,
      labels,
      executionId,
      workflowId,
      agentExecutionId,
    });
  } catch (error) {
    console.error("[Metrics] Failed to record metric:", error);
  }
}

/**
 * Update daily metrics summary
 */
export async function updateDailyMetricsSummary(
  userId: number,
  date: string,
  updates: Partial<InsertDailyMetricsSummary>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(dailyMetricsSummary)
    .where(and(eq(dailyMetricsSummary.userId, userId), eq(dailyMetricsSummary.date, date)))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    const merged: Partial<InsertDailyMetricsSummary> = {
      totalExecutions: (current.totalExecutions || 0) + (updates.totalExecutions || 0),
      totalWorkflows: (current.totalWorkflows || 0) + (updates.totalWorkflows || 0),
      totalCost: (current.totalCost || 0) + (updates.totalCost || 0),
      successCount: (current.successCount || 0) + (updates.successCount || 0),
      failureCount: (current.failureCount || 0) + (updates.failureCount || 0),
      totalDuration: (current.totalDuration || 0) + (updates.totalDuration || 0),
    };

    // Calculate average duration
    const totalOps = merged.totalExecutions! + merged.totalWorkflows!;
    merged.avgDuration = totalOps > 0 ? Math.floor(merged.totalDuration! / totalOps) : 0;

    await db.update(dailyMetricsSummary)
      .set(merged)
      .where(and(eq(dailyMetricsSummary.userId, userId), eq(dailyMetricsSummary.date, date)));
  } else {
    const totalOps = (updates.totalExecutions || 0) + (updates.totalWorkflows || 0);
    const avgDuration = totalOps > 0 ? Math.floor((updates.totalDuration || 0) / totalOps) : 0;

    await db.insert(dailyMetricsSummary).values({
      userId,
      date,
      totalExecutions: updates.totalExecutions || 0,
      totalWorkflows: updates.totalWorkflows || 0,
      totalCost: updates.totalCost || 0,
      successCount: updates.successCount || 0,
      failureCount: updates.failureCount || 0,
      totalDuration: updates.totalDuration || 0,
      avgDuration,
      metadata: updates.metadata,
    });
  }
}

/**
 * Get daily metrics for a date range
 */
export async function getDailyMetrics(
  userId: number,
  startDate: string,
  endDate: string
): Promise<DailyMetrics[]> {
  const db = await getDb();
  if (!db) return [];

  const results = await db.select().from(dailyMetricsSummary)
    .where(and(
      eq(dailyMetricsSummary.userId, userId),
      sql`${dailyMetricsSummary.date} >= ${startDate}`,
      sql`${dailyMetricsSummary.date} <= ${endDate}`
    ))
    .orderBy(dailyMetricsSummary.date);

  return results.map(r => ({
    date: r.date,
    totalExecutions: r.totalExecutions,
    totalWorkflows: r.totalWorkflows,
    totalCost: r.totalCost,
    successCount: r.successCount,
    failureCount: r.failureCount,
    avgDuration: r.avgDuration,
  }));
}

/**
 * Get execution statistics
 */
export async function getExecutionStats(
  userId: number,
  startDate: string,
  endDate: string
): Promise<ExecutionStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalExecutions: 0,
      successRate: 0,
      avgDuration: 0,
      avgCost: 0,
      statusBreakdown: {},
      costDistribution: [],
      durationTrend: [],
    };
  }

  // Get all executions in date range
  const execs = await db.select().from(executions)
    .where(and(
      eq(executions.userId, userId),
      sql`DATE(${executions.createdAt}) >= ${startDate}`,
      sql`DATE(${executions.createdAt}) <= ${endDate}`
    ));

  const totalExecutions = execs.length;
  const completedCount = execs.filter(e => e.status === 'completed').length;
  const successRate = totalExecutions > 0 ? (completedCount / totalExecutions) * 100 : 0;

  // Calculate averages
  const totalDuration = execs.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalCost = execs.reduce((sum, e) => sum + (e.cost || 0), 0);
  const avgDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;
  const avgCost = totalExecutions > 0 ? totalCost / totalExecutions : 0;

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  execs.forEach(e => {
    statusBreakdown[e.status] = (statusBreakdown[e.status] || 0) + 1;
  });

  // Cost distribution (in dollars)
  const costDistribution = [
    { range: "$0-$0.10", count: execs.filter(e => (e.cost || 0) < 10).length },
    { range: "$0.10-$0.50", count: execs.filter(e => (e.cost || 0) >= 10 && (e.cost || 0) < 50).length },
    { range: "$0.50-$1.00", count: execs.filter(e => (e.cost || 0) >= 50 && (e.cost || 0) < 100).length },
    { range: "$1.00+", count: execs.filter(e => (e.cost || 0) >= 100).length },
  ];

  // Duration trend by day
  const durationByDay: Record<string, { total: number; count: number }> = {};
  execs.forEach(e => {
    const date = e.createdAt.toISOString().split('T')[0];
    if (!durationByDay[date]) {
      durationByDay[date] = { total: 0, count: 0 };
    }
    durationByDay[date].total += e.duration || 0;
    durationByDay[date].count += 1;
  });

  const durationTrend = Object.entries(durationByDay).map(([date, data]) => ({
    date,
    avgDuration: data.count > 0 ? data.total / data.count : 0,
  }));

  return {
    totalExecutions,
    successRate,
    avgDuration,
    avgCost,
    statusBreakdown,
    costDistribution,
    durationTrend,
  };
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStats(
  userId: number,
  startDate: string,
  endDate: string
): Promise<WorkflowStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalWorkflows: 0,
      successRate: 0,
      avgDuration: 0,
      avgCost: 0,
      avgAgentsPerWorkflow: 0,
      statusBreakdown: {},
      agentPerformance: [],
    };
  }

  // Get all workflows in date range
  const wfs = await db.select().from(workflows)
    .where(and(
      eq(workflows.userId, userId),
      sql`DATE(${workflows.createdAt}) >= ${startDate}`,
      sql`DATE(${workflows.createdAt}) <= ${endDate}`
    ));

  const totalWorkflows = wfs.length;
  const completedCount = wfs.filter(w => w.status === 'completed').length;
  const successRate = totalWorkflows > 0 ? (completedCount / totalWorkflows) * 100 : 0;

  // Calculate averages
  const totalDuration = wfs.reduce((sum, w) => sum + (w.duration || 0), 0);
  const totalCost = wfs.reduce((sum, w) => sum + (w.totalCost || 0), 0);
  const avgDuration = totalWorkflows > 0 ? totalDuration / totalWorkflows : 0;
  const avgCost = totalWorkflows > 0 ? totalCost / totalWorkflows : 0;

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  wfs.forEach(w => {
    statusBreakdown[w.status] = (statusBreakdown[w.status] || 0) + 1;
  });

  // Get agent executions for these workflows
  const workflowIds = wfs.map(w => w.workflowId);
  const agents = workflowIds.length > 0
    ? await db.select().from(agentExecutions)
        .where(sql`${agentExecutions.workflowId} IN (${sql.join(workflowIds.map(id => sql`${id}`), sql`, `)})`)
    : [];

  const avgAgentsPerWorkflow = totalWorkflows > 0 ? agents.length / totalWorkflows : 0;

  // Agent performance
  const agentMap: Record<string, { total: number; success: number; duration: number; cost: number }> = {};
  agents.forEach(a => {
    if (!agentMap[a.agentName]) {
      agentMap[a.agentName] = { total: 0, success: 0, duration: 0, cost: 0 };
    }
    agentMap[a.agentName].total += 1;
    if (a.status === 'completed') agentMap[a.agentName].success += 1;
    agentMap[a.agentName].duration += a.duration || 0;
    agentMap[a.agentName].cost += a.cost || 0;
  });

  const agentPerformance = Object.entries(agentMap).map(([agentName, data]) => ({
    agentName,
    totalRuns: data.total,
    avgDuration: data.total > 0 ? data.duration / data.total : 0,
    successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
  }));

  return {
    totalWorkflows,
    successRate,
    avgDuration,
    avgCost,
    avgAgentsPerWorkflow,
    statusBreakdown,
    agentPerformance,
  };
}

/**
 * Get cost trends
 */
export async function getCostTrends(
  userId: number,
  startDate: string,
  endDate: string
): Promise<CostTrend[]> {
  const db = await getDb();
  if (!db) return [];

  const results = await db.select().from(dailyMetricsSummary)
    .where(and(
      eq(dailyMetricsSummary.userId, userId),
      sql`${dailyMetricsSummary.date} >= ${startDate}`,
      sql`${dailyMetricsSummary.date} <= ${endDate}`
    ))
    .orderBy(dailyMetricsSummary.date);

  return results.map(r => ({
    date: r.date,
    cost: r.totalCost,
    executionCount: r.totalExecutions,
    workflowCount: r.totalWorkflows,
  }));
}

/**
 * Get tool usage statistics
 */
export async function getToolUsage(
  userId: number,
  startDate: string,
  endDate: string
): Promise<ToolUsageStats[]> {
  const db = await getDb();
  if (!db) return [];

  const audits = await db.select().from(toolAccessAudit)
    .where(and(
      eq(toolAccessAudit.userId, userId),
      sql`DATE(${toolAccessAudit.timestamp}) >= ${startDate}`,
      sql`DATE(${toolAccessAudit.timestamp}) <= ${endDate}`
    ));

  // Aggregate tool usage
  const toolMap: Record<string, { allowed: number; denied: number; users: Set<number>; riskLevel: string }> = {};

  audits.forEach(audit => {
    // Process allowed tools
    (audit.allowedTools || []).forEach(tool => {
      if (!toolMap[tool]) {
        toolMap[tool] = { allowed: 0, denied: 0, users: new Set(), riskLevel: 'low' };
      }
      toolMap[tool].allowed += 1;
      toolMap[tool].users.add(audit.userId);

      // Determine risk level
      if (audit.riskLevels && audit.riskLevels[tool]) {
        toolMap[tool].riskLevel = audit.riskLevels[tool];
      }
    });

    // Process denied tools
    (audit.deniedTools || []).forEach(tool => {
      if (!toolMap[tool]) {
        toolMap[tool] = { allowed: 0, denied: 0, users: new Set(), riskLevel: 'unknown' };
      }
      toolMap[tool].denied += 1;
      toolMap[tool].users.add(audit.userId);
    });
  });

  return Object.entries(toolMap).map(([toolName, data]) => ({
    toolName,
    usageCount: data.allowed,
    deniedCount: data.denied,
    totalUsers: data.users.size,
    riskLevel: data.riskLevel,
  }));
}

/**
 * Get integration metrics (by source)
 */
export async function getIntegrationMetrics(
  userId: number,
  startDate: string,
  endDate: string
): Promise<IntegrationMetrics[]> {
  const db = await getDb();
  if (!db) return [];

  // Get executions by source
  const execs = await db.select().from(executions)
    .where(and(
      eq(executions.userId, userId),
      sql`DATE(${executions.createdAt}) >= ${startDate}`,
      sql`DATE(${executions.createdAt}) <= ${endDate}`
    ));

  // Get workflows by source
  const wfs = await db.select().from(workflows)
    .where(and(
      eq(workflows.userId, userId),
      sql`DATE(${workflows.createdAt}) >= ${startDate}`,
      sql`DATE(${workflows.createdAt}) <= ${endDate}`
    ));

  // Aggregate by source
  const sourceMap: Record<string, { executions: number; workflows: number; successCount: number; totalCost: number }> = {};

  execs.forEach(e => {
    const source = e.source || 'direct';
    if (!sourceMap[source]) {
      sourceMap[source] = { executions: 0, workflows: 0, successCount: 0, totalCost: 0 };
    }
    sourceMap[source].executions += 1;
    if (e.status === 'completed') sourceMap[source].successCount += 1;
    sourceMap[source].totalCost += e.cost || 0;
  });

  wfs.forEach(w => {
    const source = w.source || 'direct';
    if (!sourceMap[source]) {
      sourceMap[source] = { executions: 0, workflows: 0, successCount: 0, totalCost: 0 };
    }
    sourceMap[source].workflows += 1;
    if (w.status === 'completed') sourceMap[source].successCount += 1;
    sourceMap[source].totalCost += w.totalCost || 0;
  });

  return Object.entries(sourceMap).map(([source, data]) => {
    const total = data.executions + data.workflows;
    return {
      source,
      totalExecutions: data.executions,
      totalWorkflows: data.workflows,
      successRate: total > 0 ? (data.successCount / total) * 100 : 0,
      avgCost: total > 0 ? data.totalCost / total : 0,
    };
  });
}

/**
 * Get agent performance for a specific workflow
 */
export async function getAgentPerformance(workflowId: string): Promise<AgentStats[]> {
  const db = await getDb();
  if (!db) return [];

  const agents = await db.select().from(agentExecutions)
    .where(eq(agentExecutions.workflowId, workflowId))
    .orderBy(agentExecutions.stepNumber);

  const agentMap: Record<string, { total: number; success: number; failure: number; duration: number; cost: number }> = {};

  agents.forEach(a => {
    if (!agentMap[a.agentName]) {
      agentMap[a.agentName] = { total: 0, success: 0, failure: 0, duration: 0, cost: 0 };
    }
    agentMap[a.agentName].total += 1;
    if (a.status === 'completed') agentMap[a.agentName].success += 1;
    if (a.status === 'failed') agentMap[a.agentName].failure += 1;
    agentMap[a.agentName].duration += a.duration || 0;
    agentMap[a.agentName].cost += a.cost || 0;
  });

  return Object.entries(agentMap).map(([agentName, data]) => ({
    agentName,
    totalRuns: data.total,
    successCount: data.success,
    failureCount: data.failure,
    avgDuration: data.total > 0 ? data.duration / data.total : 0,
    avgCost: data.total > 0 ? data.cost / data.total : 0,
    successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
  }));
}
