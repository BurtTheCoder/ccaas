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

// Force regeneration
