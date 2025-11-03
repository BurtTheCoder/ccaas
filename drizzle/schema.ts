import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects - represents codebases/repos that can be executed
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  path: text("path").notNull(),
  description: text("description"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Executions - single-agent execution records
 */
export const executions = mysqlTable("executions", {
  id: int("id").autoincrement().primaryKey(),
  executionId: varchar("executionId", { length: 64 }).notNull().unique(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  prompt: text("prompt").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "timeout"]).default("pending").notNull(),
  result: text("result"),
  error: text("error"),
  containerId: varchar("containerId", { length: 255 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  cost: int("cost"),
  source: varchar("source", { length: 64 }),
  sourceMetadata: json("sourceMetadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Execution = typeof executions.$inferSelect;
export type InsertExecution = typeof executions.$inferInsert;

/**
 * Workflows - multi-agent workflow execution records
 */
export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: varchar("workflowId", { length: 64 }).notNull().unique(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "running", "paused", "completed", "failed", "cancelled"]).default("pending").notNull(),
  currentAgent: varchar("currentAgent", { length: 255 }),
  currentStep: int("currentStep").default(0),
  totalSteps: int("totalSteps"),
  iterations: int("iterations").default(0),
  maxIterations: int("maxIterations"),
  consecutiveFailures: int("consecutiveFailures").default(0),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  totalCost: int("totalCost").default(0),
  budgetLimit: int("budgetLimit"),
  config: json("config").$type<Record<string, any>>(),
  context: json("context").$type<Record<string, any>>(),
  state: json("state").$type<Record<string, any>>(),
  error: text("error"),
  source: varchar("source", { length: 64 }),
  sourceMetadata: json("sourceMetadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

/**
 * Agent Executions - individual agent runs within workflows
 */
export const agentExecutions = mysqlTable("agentExecutions", {
  id: int("id").autoincrement().primaryKey(),
  agentExecutionId: varchar("agentExecutionId", { length: 64 }).notNull().unique(),
  workflowId: varchar("workflowId", { length: 64 }).notNull(),
  agentName: varchar("agentName", { length: 255 }).notNull(),
  agentRole: text("agentRole"),
  stepNumber: int("stepNumber").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).default("pending").notNull(),
  prompt: text("prompt").notNull(),
  output: text("output"),
  outputVariable: varchar("outputVariable", { length: 255 }),
  error: text("error"),
  containerId: varchar("containerId", { length: 255 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  cost: int("cost"),
  containerConfig: json("containerConfig").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentExecution = typeof agentExecutions.$inferSelect;
export type InsertAgentExecution = typeof agentExecutions.$inferInsert;

/**
 * Logs - execution and workflow logs
 */
export const logs = mysqlTable("logs", {
  id: int("id").autoincrement().primaryKey(),
  executionId: varchar("executionId", { length: 64 }),
  workflowId: varchar("workflowId", { length: 64 }),
  agentExecutionId: varchar("agentExecutionId", { length: 64 }),
  level: mysqlEnum("level", ["debug", "info", "warn", "error"]).default("info").notNull(),
  message: text("message").notNull(),
  metadata: json("metadata").$type<Record<string, any>>(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type Log = typeof logs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;

/**
 * API Keys - for webhook authentication
 */
export const apiKeys = mysqlTable("apiKeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  permissions: json("permissions").$type<string[]>(),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * Notifications - workflow notifications and alerts
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workflowId: varchar("workflowId", { length: 64 }),
  executionId: varchar("executionId", { length: 64 }),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "error", "critical"]).default("info").notNull(),
  read: boolean("read").default(false).notNull(),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Budget Tracking - daily/monthly cost tracking
 */
export const budgetTracking = mysqlTable("budgetTracking", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  dailyCost: int("dailyCost").default(0).notNull(),
  executionCount: int("executionCount").default(0).notNull(),
  workflowCount: int("workflowCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BudgetTracking = typeof budgetTracking.$inferSelect;
export type InsertBudgetTracking = typeof budgetTracking.$inferInsert;

/**
 * Tool Access Audit - logs all tool access requests and validations
 */
export const toolAccessAudit = mysqlTable("toolAccessAudit", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: varchar("workflowId", { length: 64 }),
  agentExecutionId: varchar("agentExecutionId", { length: 64 }),
  agentName: varchar("agentName", { length: 255 }),
  userId: int("userId").notNull(),
  requestedTools: json("requestedTools").$type<string[]>().notNull(),
  allowedTools: json("allowedTools").$type<string[]>().notNull(),
  deniedTools: json("deniedTools").$type<string[]>().notNull(),
  validationErrors: json("validationErrors").$type<string[]>(),
  riskLevels: json("riskLevels").$type<Record<string, string>>(),
  accessGranted: boolean("accessGranted").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type ToolAccessAudit = typeof toolAccessAudit.$inferSelect;
export type InsertToolAccessAudit = typeof toolAccessAudit.$inferInsert;

/**
 * Container Image Cache - tracks pre-built Docker images
 */
export const containerImageCache = mysqlTable("containerImageCache", {
  id: int("id").autoincrement().primaryKey(),
  imageId: varchar("imageId", { length: 64 }).notNull().unique(),
  tag: varchar("tag", { length: 255 }).notNull(),
  baseImage: varchar("baseImage", { length: 255 }).notNull(),
  dependenciesHash: varchar("dependenciesHash", { length: 64 }).notNull().unique(),
  size: int("size").notNull(),
  digestHash: varchar("digestHash", { length: 128 }),
  buildStatus: mysqlEnum("buildStatus", ["pending", "building", "completed", "failed"]).default("pending").notNull(),
  buildLog: text("buildLog"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  cacheHits: int("cacheHits").default(0).notNull(),
});

export type ContainerImageCache = typeof containerImageCache.$inferSelect;
export type InsertContainerImageCache = typeof containerImageCache.$inferInsert;

/**
 * Image Dependencies - tracks dependencies for each cached image
 */
export const imageDependencies = mysqlTable("imageDependencies", {
  id: int("id").autoincrement().primaryKey(),
  imageId: varchar("imageId", { length: 64 }).notNull(),
  dependencyType: mysqlEnum("dependencyType", ["npm", "pip", "apt", "system"]).notNull(),
  packageName: varchar("packageName", { length: 255 }).notNull(),
  version: varchar("version", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImageDependency = typeof imageDependencies.$inferSelect;
export type InsertImageDependency = typeof imageDependencies.$inferInsert;

/**
 * Metrics - granular metric tracking for analytics
 */
export const metrics = mysqlTable("metrics", {
  id: int("id").autoincrement().primaryKey(),
  executionId: varchar("executionId", { length: 64 }),
  workflowId: varchar("workflowId", { length: 64 }),
  agentExecutionId: varchar("agentExecutionId", { length: 64 }),
  userId: int("userId").notNull(),
  metricType: varchar("metricType", { length: 64 }).notNull(),
  value: int("value").notNull(),
  labels: json("labels").$type<Record<string, any>>(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = typeof metrics.$inferInsert;

/**
 * Daily Metrics Summary - pre-aggregated daily statistics
 */
export const dailyMetricsSummary = mysqlTable("dailyMetricsSummary", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  totalExecutions: int("totalExecutions").default(0).notNull(),
  totalWorkflows: int("totalWorkflows").default(0).notNull(),
  totalCost: int("totalCost").default(0).notNull(),
  successCount: int("successCount").default(0).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  avgDuration: int("avgDuration").default(0).notNull(),
  totalDuration: int("totalDuration").default(0).notNull(),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyMetricsSummary = typeof dailyMetricsSummary.$inferSelect;
export type InsertDailyMetricsSummary = typeof dailyMetricsSummary.$inferInsert;

/**
 * Workflow Templates - pre-built workflow configurations
 */
export const workflowTemplates = mysqlTable("workflowTemplates", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("templateId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).default("intermediate").notNull(),
  estimatedTime: varchar("estimatedTime", { length: 64 }),
  version: varchar("version", { length: 32 }).default("1.0.0").notNull(),
  authorId: int("authorId"),
  isPublic: boolean("isPublic").default(true).notNull(),
  isBuiltIn: boolean("isBuiltIn").default(false).notNull(),
  workflowConfig: json("workflowConfig").$type<Record<string, any>>().notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  averageRating: int("averageRating").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;

/**
 * Template Variables - customizable variables in templates
 */
export const templateVariables = mysqlTable("templateVariables", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("templateId", { length: 64 }).notNull(),
  variableName: varchar("variableName", { length: 255 }).notNull(),
  description: text("description").notNull(),
  type: mysqlEnum("type", ["string", "number", "boolean", "array", "object"]).default("string").notNull(),
  defaultValue: text("defaultValue"),
  required: boolean("required").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TemplateVariable = typeof templateVariables.$inferSelect;
export type InsertTemplateVariable = typeof templateVariables.$inferInsert;

/**
 * Template Usage - tracks when templates are deployed
 */
export const templateUsage = mysqlTable("templateUsage", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("templateId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  usedAt: timestamp("usedAt").defaultNow().notNull(),
  createdWorkflowId: varchar("createdWorkflowId", { length: 64 }),
});

export type TemplateUsage = typeof templateUsage.$inferSelect;
export type InsertTemplateUsage = typeof templateUsage.$inferInsert;

/**
 * Template Ratings - user ratings and reviews
 */
export const templateRatings = mysqlTable("templateRatings", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("templateId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TemplateRating = typeof templateRatings.$inferSelect;
export type InsertTemplateRating = typeof templateRatings.$inferInsert;

/**
 * Email Queue - queued emails for reliable delivery
 */
export const emailQueue = mysqlTable("emailQueue", {
  id: int("id").autoincrement().primaryKey(),
  to: text("to").notNull(),
  from: text("from").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  nextRetryAt: timestamp("nextRetryAt"),
  sentAt: timestamp("sentAt"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = typeof emailQueue.$inferInsert;

/**
 * Email Preferences - user/project email notification settings
 */
export const emailPreferences = mysqlTable("emailPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  emailType: varchar("emailType", { length: 64 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  recipients: json("recipients").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailPreference = typeof emailPreferences.$inferSelect;
export type InsertEmailPreference = typeof emailPreferences.$inferInsert;

/**
 * Linear Webhook Events - stores incoming Linear webhook events
 */
export const linearWebhookEvents = mysqlTable("linearWebhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  webhookId: varchar("webhookId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  issueId: varchar("issueId", { length: 255 }),
  issueIdentifier: varchar("issueIdentifier", { length: 64 }),
  organizationId: varchar("organizationId", { length: 255 }),
  workflowId: varchar("workflowId", { length: 64 }),
  executionId: varchar("executionId", { length: 64 }),
  payload: json("payload").$type<Record<string, any>>().notNull(),
  processed: boolean("processed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LinearWebhookEvent = typeof linearWebhookEvents.$inferSelect;
export type InsertLinearWebhookEvent = typeof linearWebhookEvents.$inferInsert;

/**
 * Linear Integration Config - stores Linear integration configuration per project/team
 */
export const linearIntegrationConfig = mysqlTable("linearIntegrationConfig", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  linearTeamId: varchar("linearTeamId", { length: 255 }).notNull(),
  linearTeamName: varchar("linearTeamName", { length: 255 }),
  linearProjectId: varchar("linearProjectId", { length: 255 }),
  linearProjectName: varchar("linearProjectName", { length: 255 }),
  eventTypes: json("eventTypes").$type<string[]>().notNull(),
  webhookUrl: text("webhookUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LinearIntegrationConfig = typeof linearIntegrationConfig.$inferSelect;
export type InsertLinearIntegrationConfig = typeof linearIntegrationConfig.$inferInsert;

/**
 * Project Environment Variables - stores environment variables per project
 */
export const projectEnvironmentVariables = mysqlTable("projectEnvironmentVariables", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  isSecret: boolean("isSecret").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectEnvironmentVariable = typeof projectEnvironmentVariables.$inferSelect;
export type InsertProjectEnvironmentVariable = typeof projectEnvironmentVariables.$inferInsert;

/**
 * Project Webhooks - stores webhook configurations per project
 */
export const projectWebhooks = mysqlTable("projectWebhooks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  events: json("events").$type<string[]>().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectWebhook = typeof projectWebhooks.$inferSelect;
export type InsertProjectWebhook = typeof projectWebhooks.$inferInsert;

// Force regeneration
