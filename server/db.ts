import { eq, desc, and, sql, or, like, lte } from "drizzle-orm";
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
  toolAccessAudit, InsertToolAccessAudit, ToolAccessAudit,
  containerImageCache, InsertContainerImageCache, ContainerImageCache,
  imageDependencies, InsertImageDependency, ImageDependency,
  metrics, InsertMetric, Metric,
  dailyMetricsSummary, InsertDailyMetricsSummary, DailyMetricsSummary,
  workflowTemplates, InsertWorkflowTemplate, WorkflowTemplate,
  templateVariables, InsertTemplateVariable, TemplateVariable,
  templateUsage, InsertTemplateUsage, TemplateUsage,
  templateRatings, InsertTemplateRating, TemplateRating,
  emailQueue, InsertEmailQueue, EmailQueue,
  emailPreferences, InsertEmailPreference, EmailPreference,
  linearWebhookEvents, InsertLinearWebhookEvent, LinearWebhookEvent,
  linearIntegrationConfig, InsertLinearIntegrationConfig, LinearIntegrationConfig,
  projectEnvironmentVariables, InsertProjectEnvironmentVariable, ProjectEnvironmentVariable,
  projectWebhooks, InsertProjectWebhook, ProjectWebhook
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

// ============ Container Image Cache ============

export async function createContainerImageCache(image: InsertContainerImageCache): Promise<ContainerImageCache> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(containerImageCache).values(image);
  const inserted = await db.select().from(containerImageCache).where(eq(containerImageCache.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getContainerImageCacheByHash(dependenciesHash: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(containerImageCache)
    .where(and(
      eq(containerImageCache.dependenciesHash, dependenciesHash),
      eq(containerImageCache.buildStatus, "completed")
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getContainerImageCacheById(imageId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(containerImageCache).where(eq(containerImageCache.imageId, imageId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateContainerImageCache(imageId: string, updates: Partial<InsertContainerImageCache>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(containerImageCache).set(updates).where(eq(containerImageCache.imageId, imageId));
  return await getContainerImageCacheById(imageId);
}

export async function recordImageCacheHit(imageId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(containerImageCache)
    .set({
      lastUsedAt: new Date(),
      cacheHits: sql`${containerImageCache.cacheHits} + 1`
    })
    .where(eq(containerImageCache.imageId, imageId));
}

export async function listContainerImageCache(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(containerImageCache)
    .orderBy(desc(containerImageCache.createdAt))
    .limit(limit);
}

export async function invalidateImageCacheByBaseImage(baseImage: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(containerImageCache).where(eq(containerImageCache.baseImage, baseImage));
}

export async function deleteContainerImageCache(imageId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(containerImageCache).where(eq(containerImageCache.imageId, imageId));
  await db.delete(imageDependencies).where(eq(imageDependencies.imageId, imageId));
}

// ============ Image Dependencies ============

export async function createImageDependency(dependency: InsertImageDependency): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(imageDependencies).values(dependency);
}

export async function listImageDependencies(imageId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(imageDependencies)
    .where(eq(imageDependencies.imageId, imageId))
    .orderBy(imageDependencies.dependencyType);
}

export async function getImageCacheStats() {
  const db = await getDb();
  if (!db) return {
    totalImages: 0,
    totalSize: 0,
    totalHits: 0,
    averageHits: 0
  };

  const result = await db.select({
    totalImages: sql<number>`COUNT(*)`,
    totalSize: sql<number>`SUM(${containerImageCache.size})`,
    totalHits: sql<number>`SUM(${containerImageCache.cacheHits})`,
  }).from(containerImageCache);

  const stats = result[0];
  return {
    totalImages: Number(stats.totalImages),
    totalSize: Number(stats.totalSize || 0),
    totalHits: Number(stats.totalHits || 0),
    averageHits: stats.totalImages > 0 ? Number(stats.totalHits) / Number(stats.totalImages) : 0
  };
}

// ============ Workflow Templates ============

export async function createTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(workflowTemplates).values(template);
  const inserted = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getTemplateById(templateId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(workflowTemplates).where(eq(workflowTemplates.templateId, templateId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listTemplates(filters?: {
  category?: string;
  difficulty?: string;
  tags?: string[];
  search?: string;
  isBuiltIn?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(workflowTemplates);
  const conditions: any[] = [eq(workflowTemplates.isPublic, true)];

  if (filters?.category) {
    conditions.push(eq(workflowTemplates.category, filters.category));
  }

  if (filters?.difficulty) {
    conditions.push(eq(workflowTemplates.difficulty, filters.difficulty as any));
  }

  if (filters?.isBuiltIn !== undefined) {
    conditions.push(eq(workflowTemplates.isBuiltIn, filters.isBuiltIn));
  }

  if (filters?.tags && filters.tags.length > 0) {
    // Check if any of the tags match
    filters.tags.forEach(tag => {
      conditions.push(sql`JSON_CONTAINS(${workflowTemplates.tags}, ${JSON.stringify([tag])})`);
    });
  }

  if (filters?.search) {
    conditions.push(
      or(
        like(workflowTemplates.name, `%${filters.search}%`),
        like(workflowTemplates.description, `%${filters.search}%`)
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await (query as any).orderBy(desc(workflowTemplates.usageCount), desc(workflowTemplates.createdAt));
}

export async function searchTemplates(search: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.isPublic, true),
        or(
          like(workflowTemplates.name, `%${search}%`),
          like(workflowTemplates.description, `%${search}%`)
        )
      )
    )
    .orderBy(desc(workflowTemplates.usageCount));
}

export async function updateTemplate(templateId: string, updates: Partial<InsertWorkflowTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(workflowTemplates).set(updates).where(eq(workflowTemplates.templateId, templateId));
  return await getTemplateById(templateId);
}

export async function deleteTemplate(templateId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(workflowTemplates).where(eq(workflowTemplates.templateId, templateId));
}

export async function incrementTemplateUsageCount(templateId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(workflowTemplates)
    .set({ usageCount: sql`${workflowTemplates.usageCount} + 1` })
    .where(eq(workflowTemplates.templateId, templateId));
}

// ============ Template Variables ============

export async function createTemplateVariable(variable: InsertTemplateVariable): Promise<TemplateVariable> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(templateVariables).values(variable);
  const inserted = await db.select().from(templateVariables).where(eq(templateVariables.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getTemplateVariables(templateId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(templateVariables).where(eq(templateVariables.templateId, templateId));
}

export async function deleteTemplateVariables(templateId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(templateVariables).where(eq(templateVariables.templateId, templateId));
}

// ============ Template Usage ============

export async function recordTemplateUsage(templateId: string, userId: number, workflowId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(templateUsage).values({
    templateId,
    userId,
    createdWorkflowId: workflowId,
  });
}

export async function getTemplateUsageCount(templateId: string, since?: Date) {
  const db = await getDb();
  if (!db) return 0;

  const conditions = [eq(templateUsage.templateId, templateId)];
  if (since) {
    conditions.push(sql`${templateUsage.usedAt} >= ${since}`);
  }

  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(templateUsage)
    .where(and(...conditions));

  return Number(result[0].count);
}

export async function getTemplateUsageByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(templateUsage)
    .where(eq(templateUsage.userId, userId))
    .orderBy(desc(templateUsage.usedAt))
    .limit(limit);
}

// ============ Template Ratings ============

export async function createTemplateRating(rating: InsertTemplateRating): Promise<TemplateRating> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user already rated this template
  const existing = await db.select().from(templateRatings)
    .where(and(
      eq(templateRatings.templateId, rating.templateId),
      eq(templateRatings.userId, rating.userId)
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update existing rating
    await db.update(templateRatings)
      .set({ rating: rating.rating, review: rating.review })
      .where(eq(templateRatings.id, existing[0].id));
    const updated = await db.select().from(templateRatings).where(eq(templateRatings.id, existing[0].id)).limit(1);
    return updated[0];
  }

  const result = await db.insert(templateRatings).values(rating);
  const inserted = await db.select().from(templateRatings).where(eq(templateRatings.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getTemplateRatings(templateId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(templateRatings)
    .where(eq(templateRatings.templateId, templateId))
    .orderBy(desc(templateRatings.createdAt));
}

export async function updateTemplateAverageRating(templateId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select({ avg: sql<number>`AVG(${templateRatings.rating})` })
    .from(templateRatings)
    .where(eq(templateRatings.templateId, templateId));

  const avgRating = result[0].avg ? Math.round(Number(result[0].avg) * 10) : 0;

  await db.update(workflowTemplates)
    .set({ averageRating: avgRating })
    .where(eq(workflowTemplates.templateId, templateId));
}

export async function seedBuiltInTemplates(templates: InsertWorkflowTemplate[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if built-in templates already exist
  const existing = await db.select().from(workflowTemplates).where(eq(workflowTemplates.isBuiltIn, true)).limit(1);
  if (existing.length > 0) {
    console.log("[DB] Built-in templates already seeded");
    return;
  }

  console.log(`[DB] Seeding ${templates.length} built-in templates...`);
  for (const template of templates) {
    await db.insert(workflowTemplates).values(template);
  }
  console.log("[DB] Built-in templates seeded successfully");
}

// ============ Email Queue Management ============

export async function createEmailQueue(email: InsertEmailQueue): Promise<EmailQueue> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(emailQueue).values(email);
  const id = Number(result[0].insertId);
  const created = await db.select().from(emailQueue).where(eq(emailQueue.id, id)).limit(1);
  return created[0];
}

export async function getEmailQueueById(id: number): Promise<EmailQueue | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(emailQueue).where(eq(emailQueue.id, id)).limit(1);
  return result[0];
}

export async function getPendingEmailQueue(limit: number = 50): Promise<EmailQueue[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  return await db.select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, 'pending'),
        lte(emailQueue.nextRetryAt, now)
      )
    )
    .orderBy(emailQueue.createdAt)
    .limit(limit);
}

export async function updateEmailQueue(id: number, updates: Partial<InsertEmailQueue>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(emailQueue).set(updates).where(eq(emailQueue.id, id));
}

export async function listEmailQueueByStatus(status: 'pending' | 'sent' | 'failed', limit: number = 100): Promise<EmailQueue[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(emailQueue)
    .where(eq(emailQueue.status, status))
    .orderBy(desc(emailQueue.createdAt))
    .limit(limit);
}

// ============ Email Preferences Management ============

export async function createEmailPreference(preference: InsertEmailPreference): Promise<EmailPreference> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(emailPreferences).values(preference);
  const id = Number(result[0].insertId);
  const created = await db.select().from(emailPreferences).where(eq(emailPreferences.id, id)).limit(1);
  return created[0];
}

export async function getEmailPreference(userId: number, emailType: string, projectId?: number): Promise<EmailPreference | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const conditions = [
    eq(emailPreferences.userId, userId),
    eq(emailPreferences.emailType, emailType),
  ];

  if (projectId !== undefined) {
    conditions.push(eq(emailPreferences.projectId, projectId));
  }

  const result = await db.select()
    .from(emailPreferences)
    .where(and(...conditions))
    .limit(1);

  return result[0];
}

export async function listEmailPreferencesByUser(userId: number): Promise<EmailPreference[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, userId))
    .orderBy(emailPreferences.emailType);
}

export async function updateEmailPreference(id: number, updates: Partial<InsertEmailPreference>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(emailPreferences).set(updates).where(eq(emailPreferences.id, id));
}

export async function upsertEmailPreference(preference: InsertEmailPreference): Promise<EmailPreference> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Try to find existing preference
  const existing = await getEmailPreference(
    preference.userId,
    preference.emailType,
    preference.projectId ?? undefined
  );

  if (existing) {
    // Update existing
    await updateEmailPreference(existing.id, preference);
    const updated = await db.select()
      .from(emailPreferences)
      .where(eq(emailPreferences.id, existing.id))
      .limit(1);
    return updated[0];
  } else {
    // Create new
    return await createEmailPreference(preference);
  }
}

export async function deleteEmailPreference(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(emailPreferences).where(eq(emailPreferences.id, id));
}

/**
 * Get email recipients for a user based on their preferences
 */
export async function getEmailRecipientsForUser(
  userId: number,
  emailType: string,
  projectId?: number
): Promise<string[]> {
  const preference = await getEmailPreference(userId, emailType, projectId);

  if (!preference || !preference.enabled) {
    return [];
  }

  // If custom recipients are specified, use those
  if (preference.recipients && preference.recipients.length > 0) {
    return preference.recipients;
  }

  // Otherwise, use user's email
  const user = await getUserById(userId);
  if (user && user.email) {
    return [user.email];
  }

  return [];
}

// ============ Linear Webhook Events ============

export async function createLinearWebhookEvent(event: InsertLinearWebhookEvent): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create Linear webhook event: database not available");
    return;
  }

  try {
    await db.insert(linearWebhookEvents).values(event);
  } catch (error) {
    console.error("[Database] Failed to create Linear webhook event:", error);
  }
}

export async function getLinearWebhookEventById(webhookId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(linearWebhookEvents)
    .where(eq(linearWebhookEvents.webhookId, webhookId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLinearWebhookEvent(webhookId: string, updates: Partial<InsertLinearWebhookEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(linearWebhookEvents).set(updates).where(eq(linearWebhookEvents.webhookId, webhookId));
  return await getLinearWebhookEventById(webhookId);
}

export async function listLinearWebhookEvents(limit: number = 100, processed?: boolean) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (processed !== undefined) {
    conditions.push(eq(linearWebhookEvents.processed, processed));
  }

  let query = db.select().from(linearWebhookEvents);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await (query as any)
    .orderBy(desc(linearWebhookEvents.createdAt))
    .limit(limit);
}

export async function getLinearWebhookEventsByIssue(issueId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(linearWebhookEvents)
    .where(eq(linearWebhookEvents.issueId, issueId))
    .orderBy(desc(linearWebhookEvents.createdAt));
}

// ============ Linear Integration Config ============

export async function createLinearIntegrationConfig(config: InsertLinearIntegrationConfig): Promise<LinearIntegrationConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(linearIntegrationConfig).values(config);
  const inserted = await db.select().from(linearIntegrationConfig)
    .where(eq(linearIntegrationConfig.id, Number(result[0].insertId)))
    .limit(1);
  return inserted[0];
}

export async function getLinearIntegrationConfig(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(linearIntegrationConfig)
    .where(eq(linearIntegrationConfig.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLinearIntegrationConfigByProject(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(linearIntegrationConfig)
    .where(eq(linearIntegrationConfig.projectId, projectId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLinearIntegrationConfigByTeam(linearTeamId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(linearIntegrationConfig)
    .where(and(
      eq(linearIntegrationConfig.linearTeamId, linearTeamId),
      eq(linearIntegrationConfig.isActive, true)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listLinearIntegrationConfigs() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(linearIntegrationConfig)
    .orderBy(desc(linearIntegrationConfig.createdAt));
}

export async function updateLinearIntegrationConfig(id: number, updates: Partial<InsertLinearIntegrationConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(linearIntegrationConfig).set(updates).where(eq(linearIntegrationConfig.id, id));
  return await getLinearIntegrationConfig(id);
}

export async function deleteLinearIntegrationConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(linearIntegrationConfig).where(eq(linearIntegrationConfig.id, id));
}

// ============ Project Environment Variables ============

export async function getProjectEnvironmentVariables(projectId: number): Promise<ProjectEnvironmentVariable[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(projectEnvironmentVariables).where(eq(projectEnvironmentVariables.projectId, projectId));
}

export async function createProjectEnvironmentVariable(variable: InsertProjectEnvironmentVariable): Promise<ProjectEnvironmentVariable> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projectEnvironmentVariables).values(variable);
  const inserted = await db.select().from(projectEnvironmentVariables).where(eq(projectEnvironmentVariables.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function updateProjectEnvironmentVariable(id: number, updates: Partial<InsertProjectEnvironmentVariable>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projectEnvironmentVariables).set(updates).where(eq(projectEnvironmentVariables.id, id));
}

export async function deleteProjectEnvironmentVariable(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(projectEnvironmentVariables).where(eq(projectEnvironmentVariables.id, id));
}

// ============ Project Webhooks ============

export async function getProjectWebhooks(projectId: number): Promise<ProjectWebhook[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(projectWebhooks).where(eq(projectWebhooks.projectId, projectId));
}

export async function createProjectWebhook(webhook: InsertProjectWebhook): Promise<ProjectWebhook> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projectWebhooks).values(webhook);
  const inserted = await db.select().from(projectWebhooks).where(eq(projectWebhooks.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function updateProjectWebhook(id: number, updates: Partial<InsertProjectWebhook>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projectWebhooks).set(updates).where(eq(projectWebhooks.id, id));
}

export async function deleteProjectWebhook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(projectWebhooks).where(eq(projectWebhooks.id, id));
}

