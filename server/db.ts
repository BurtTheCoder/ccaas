import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  projects, InsertProject, Project,
  executions, InsertExecution, Execution,
  workflows, InsertWorkflow, Workflow,
  agentExecutions, InsertAgentExecution, AgentExecution,
  logs, InsertLog, Log,
  apiKeys, InsertApiKey, ApiKey,
  notifications, InsertNotification, Notification,
  budgetTracking, InsertBudgetTracking, BudgetTracking,
  toolAccessAudit, InsertToolAccessAudit, ToolAccessAudit
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Management ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Project Management ============

export async function createProject(project: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projects).values(project);
  const inserted = await db.select().from(projects).where(eq(projects.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProjectByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(projects).where(eq(projects.userId, userId));
}

export async function updateProject(id: number, updates: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projects).set(updates).where(eq(projects.id, id));
  return await getProjectById(id);
}

// ============ Execution Management ============

export async function createExecution(execution: InsertExecution): Promise<Execution> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(executions).values(execution);
  const inserted = await db.select().from(executions).where(eq(executions.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getExecutionById(executionId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(executions).where(eq(executions.executionId, executionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateExecution(executionId: string, updates: Partial<InsertExecution>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(executions).set(updates).where(eq(executions.executionId, executionId));
  return await getExecutionById(executionId);
}

export async function listExecutionsByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(executions)
    .where(eq(executions.userId, userId))
    .orderBy(desc(executions.createdAt))
    .limit(limit);
}

// ============ Workflow Management ============

export async function createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(workflows).values(workflow);
  const inserted = await db.select().from(workflows).where(eq(workflows.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getWorkflowById(workflowId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(workflows).where(eq(workflows.workflowId, workflowId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWorkflow(workflowId: string, updates: Partial<InsertWorkflow>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(workflows).set(updates).where(eq(workflows.workflowId, workflowId));
  return await getWorkflowById(workflowId);
}

export async function listActiveWorkflows() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(workflows)
    .where(sql`${workflows.status} IN ('pending', 'running', 'paused')`)
    .orderBy(desc(workflows.createdAt));
}

export async function listWorkflowsByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(desc(workflows.createdAt))
    .limit(limit);
}

// ============ Agent Execution Management ============

export async function createAgentExecution(agentExec: InsertAgentExecution): Promise<AgentExecution> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentExecutions).values(agentExec);
  const inserted = await db.select().from(agentExecutions).where(eq(agentExecutions.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getAgentExecutionById(agentExecutionId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(agentExecutions).where(eq(agentExecutions.agentExecutionId, agentExecutionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAgentExecution(agentExecutionId: string, updates: Partial<InsertAgentExecution>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(agentExecutions).set(updates).where(eq(agentExecutions.agentExecutionId, agentExecutionId));
  return await getAgentExecutionById(agentExecutionId);
}

export async function listAgentExecutionsByWorkflow(workflowId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(agentExecutions)
    .where(eq(agentExecutions.workflowId, workflowId))
    .orderBy(agentExecutions.stepNumber);
}

// ============ Logging ============

export async function createLog(log: InsertLog): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create log: database not available");
    return;
  }

  try {
    await db.insert(logs).values(log);
  } catch (error) {
    console.error("[Database] Failed to create log:", error);
  }
}

export async function getLogsByExecutionId(executionId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(logs)
    .where(eq(logs.executionId, executionId))
    .orderBy(logs.timestamp);
}

export async function getLogsByWorkflowId(workflowId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(logs)
    .where(eq(logs.workflowId, workflowId))
    .orderBy(logs.timestamp);
}

// ============ API Key Management ============

export async function createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(apiKeys).values(apiKey);
  const inserted = await db.select().from(apiKeys).where(eq(apiKeys.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getApiKeyByKey(key: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(apiKeys).where(eq(apiKeys.key, key)).limit(1);
  if (result.length === 0) return undefined;

  // Update last used timestamp
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.key, key));

  return result[0];
}

export async function listApiKeysByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
}

// ============ Notifications ============

export async function createNotification(notification: InsertNotification): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create notification: database not available");
    return;
  }

  try {
    await db.insert(notifications).values(notification);
  } catch (error) {
    console.error("[Database] Failed to create notification:", error);
  }
}

export async function listNotificationsByUser(userId: number, unreadOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];

  if (unreadOnly) {
    return await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .orderBy(desc(notifications.createdAt));
  }

  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
}

// ============ Budget Tracking ============

export async function updateBudgetTracking(userId: number, date: string, cost: number, isExecution: boolean, isWorkflow: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(budgetTracking)
    .where(and(eq(budgetTracking.userId, userId), eq(budgetTracking.date, date)))
    .limit(1);

  if (existing.length > 0) {
    const updates: Partial<InsertBudgetTracking> = {
      dailyCost: existing[0].dailyCost + cost,
    };
    if (isExecution) updates.executionCount = existing[0].executionCount + 1;
    if (isWorkflow) updates.workflowCount = existing[0].workflowCount + 1;

    await db.update(budgetTracking).set(updates)
      .where(and(eq(budgetTracking.userId, userId), eq(budgetTracking.date, date)));
  } else {
    await db.insert(budgetTracking).values({
      userId,
      date,
      dailyCost: cost,
      executionCount: isExecution ? 1 : 0,
      workflowCount: isWorkflow ? 1 : 0,
    });
  }
}

export async function getBudgetTrackingByDate(userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    return {
      id: 0,
      userId,
      date,
      dailyCost: 0,
      executionCount: 0,
      workflowCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const result = await db.select().from(budgetTracking)
    .where(and(eq(budgetTracking.userId, userId), eq(budgetTracking.date, date)))
    .limit(1);

  return result.length > 0 ? result[0] : {
    id: 0,
    userId,
    date,
    dailyCost: 0,
    executionCount: 0,
    workflowCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getBudgetTrackingByDateRange(userId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(budgetTracking)
    .where(and(
      eq(budgetTracking.userId, userId),
      sql`${budgetTracking.date} >= ${startDate}`,
      sql`${budgetTracking.date} <= ${endDate}`
    ))
    .orderBy(budgetTracking.date);
}



export async function deleteApiKey(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
}



export async function deleteProject(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.delete(projects).where(eq(projects.id, projectId));
}

// ============ Tool Access Audit ============

export async function createToolAccessAudit(audit: InsertToolAccessAudit): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create tool access audit: database not available");
    return;
  }

  try {
    await db.insert(toolAccessAudit).values(audit);
  } catch (error) {
    console.error("[Database] Failed to create tool access audit:", error);
  }
}

export async function getToolAccessAuditByWorkflow(workflowId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(toolAccessAudit)
    .where(eq(toolAccessAudit.workflowId, workflowId))
    .orderBy(desc(toolAccessAudit.timestamp));
}

export async function getToolAccessAuditByAgent(agentExecutionId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(toolAccessAudit)
    .where(eq(toolAccessAudit.agentExecutionId, agentExecutionId))
    .orderBy(desc(toolAccessAudit.timestamp));
}

export async function getToolAccessAuditByUser(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(toolAccessAudit)
    .where(eq(toolAccessAudit.userId, userId))
    .orderBy(desc(toolAccessAudit.timestamp))
    .limit(limit);
}

export async function getDeniedToolAccessAttempts(userId?: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  const conditions = userId
    ? and(eq(toolAccessAudit.accessGranted, false), eq(toolAccessAudit.userId, userId))
    : eq(toolAccessAudit.accessGranted, false);

  return await db.select().from(toolAccessAudit)
    .where(conditions)
    .orderBy(desc(toolAccessAudit.timestamp))
    .limit(limit);
}

export async function getHighRiskToolUsage(userId?: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  // Query for tool access where Bash or other high-risk tools were used
  if (userId) {
    return await db.select().from(toolAccessAudit)
      .where(and(
        sql`JSON_CONTAINS(${toolAccessAudit.allowedTools}, '"Bash"')`,
        eq(toolAccessAudit.userId, userId)
      ))
      .orderBy(desc(toolAccessAudit.timestamp))
      .limit(limit);
  }

  return await db.select().from(toolAccessAudit)
    .where(sql`JSON_CONTAINS(${toolAccessAudit.allowedTools}, '"Bash"')`)
    .orderBy(desc(toolAccessAudit.timestamp))
    .limit(limit);
}

