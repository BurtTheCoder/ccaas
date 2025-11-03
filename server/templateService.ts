import { nanoid } from "nanoid";
import yaml from "yaml";
import { workflowConfigSchema, type WorkflowConfig } from "./configService";
import type { WorkflowTemplate, TemplateVariable } from "../drizzle/schema";
import * as db from "./db";

export interface Template {
  templateId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime?: string | null;
  version: string;
  authorId?: number | null;
  isPublic: boolean;
  isBuiltIn: boolean;
  usageCount: number;
  averageRating?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateDetail extends Template {
  workflowConfig: WorkflowConfig;
  variables: TemplateVariable[];
  ratings?: TemplateRating[];
}

export interface TemplateRating {
  id: number;
  templateId: string;
  userId: number;
  rating: number;
  review?: string | null;
  createdAt: Date;
}

export interface TemplateStats {
  templateId: string;
  usageCount: number;
  averageRating: number;
  totalRatings: number;
  ratingDistribution: Record<number, number>;
  recentUsage: number;
}

export interface TemplateFilters {
  category?: string;
  difficulty?: string;
  tags?: string[];
  search?: string;
  isBuiltIn?: boolean;
}

/**
 * List templates with optional filters
 */
export async function listTemplates(filters?: TemplateFilters): Promise<Template[]> {
  return await db.listTemplates(filters);
}

/**
 * Get template detail including config and variables
 */
export async function getTemplate(templateId: string): Promise<TemplateDetail | null> {
  const template = await db.getTemplateById(templateId);
  if (!template) return null;

  const variables = await db.getTemplateVariables(templateId);
  const ratings = await db.getTemplateRatings(templateId);

  return {
    ...template,
    workflowConfig: template.workflowConfig as WorkflowConfig,
    variables,
    ratings,
  };
}

/**
 * Create template from existing workflow
 */
export async function createTemplateFromWorkflow(
  workflowId: string,
  metadata: {
    name: string;
    description: string;
    category: string;
    tags: string[];
    difficulty: "beginner" | "intermediate" | "advanced";
    estimatedTime?: string;
    isPublic?: boolean;
  },
  userId: number
): Promise<Template> {
  const workflow = await db.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const templateId = `tpl-${nanoid(16)}`;

  const template = await db.createTemplate({
    templateId,
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    tags: metadata.tags,
    difficulty: metadata.difficulty,
    estimatedTime: metadata.estimatedTime,
    version: "1.0.0",
    authorId: userId,
    isPublic: metadata.isPublic ?? true,
    isBuiltIn: false,
    workflowConfig: workflow.config || {},
    usageCount: 0,
  });

  return template;
}

/**
 * Deploy template to create a new workflow
 */
export async function deployTemplate(
  templateId: string,
  projectId: number,
  customVariables: Record<string, any>,
  userId: number
): Promise<string> {
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Apply variable substitutions
  let config = JSON.parse(JSON.stringify(template.workflowConfig));
  config = applyVariableSubstitutions(config, customVariables, template.variables);

  // Validate the substituted config
  try {
    workflowConfigSchema.parse(config);
  } catch (error) {
    throw new Error(`Invalid workflow configuration after variable substitution: ${error}`);
  }

  // Create workflow from template
  const workflowId = `wf-${nanoid(16)}`;
  await db.createWorkflow({
    workflowId,
    projectId,
    userId,
    name: config.name,
    description: config.description,
    status: "pending",
    config,
    context: customVariables,
    source: "template",
    sourceMetadata: { templateId, templateName: template.name },
  });

  // Track template usage
  await db.recordTemplateUsage(templateId, userId, workflowId);
  await db.incrementTemplateUsageCount(templateId);

  return workflowId;
}

/**
 * Apply variable substitutions to workflow config
 */
function applyVariableSubstitutions(
  config: any,
  customVariables: Record<string, any>,
  variables: TemplateVariable[]
): any {
  const variableMap: Record<string, any> = {};

  // Build variable map with defaults
  variables.forEach(v => {
    const key = v.variableName;
    if (customVariables[key] !== undefined) {
      variableMap[key] = customVariables[key];
    } else if (v.defaultValue) {
      try {
        variableMap[key] = JSON.parse(v.defaultValue);
      } catch {
        variableMap[key] = v.defaultValue;
      }
    } else if (v.required) {
      throw new Error(`Required variable ${key} is missing`);
    }
  });

  // Recursively substitute variables in config
  return substituteVariables(config, variableMap);
}

/**
 * Recursively substitute {{variable}} placeholders
 */
function substituteVariables(obj: any, variables: Record<string, any>): any {
  if (typeof obj === 'string') {
    // Replace {{variable}} patterns
    return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (variables[key] !== undefined) {
        return String(variables[key]);
      }
      return match;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => substituteVariables(item, variables));
  } else if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteVariables(value, variables);
    }
    return result;
  }
  return obj;
}

/**
 * Search templates by keyword
 */
export async function searchTemplates(query: string): Promise<Template[]> {
  return await db.searchTemplates(query);
}

/**
 * Rate a template
 */
export async function rateTemplate(
  templateId: string,
  userId: number,
  rating: number,
  review?: string
): Promise<void> {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  await db.createTemplateRating({
    templateId,
    userId,
    rating,
    review,
  });

  // Update average rating
  await db.updateTemplateAverageRating(templateId);
}

/**
 * Get template statistics
 */
export async function getTemplateStats(templateId: string): Promise<TemplateStats> {
  const template = await db.getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  const ratings = await db.getTemplateRatings(templateId);
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  ratings.forEach(r => {
    ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentUsage = await db.getTemplateUsageCount(templateId, thirtyDaysAgo);

  return {
    templateId,
    usageCount: template.usageCount,
    averageRating: template.averageRating || 0,
    totalRatings: ratings.length,
    ratingDistribution,
    recentUsage,
  };
}

/**
 * Get template categories
 */
export function getTemplateCategories(): string[] {
  return [
    "Code Review & QA",
    "Bug Fixing & Debugging",
    "Documentation Generation",
    "Testing & Validation",
    "Deployment & Release",
    "Data Processing",
    "Security & Compliance",
    "Performance Optimization",
    "Refactoring",
    "Custom",
  ];
}
