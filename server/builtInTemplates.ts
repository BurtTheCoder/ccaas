import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { nanoid } from "nanoid";
import type { InsertWorkflowTemplate } from "../drizzle/schema";
import { workflowConfigSchema } from "./configService";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

interface TemplateMetadata {
  templateId: string;
  filename: string;
  category: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: string;
}

const TEMPLATE_METADATA: TemplateMetadata[] = [
  {
    templateId: "tpl-code-review",
    filename: "code-review-workflow.yaml",
    category: "Code Review & QA",
    tags: ["code-quality", "security", "testing", "review"],
    difficulty: "intermediate",
    estimatedTime: "30-45 minutes",
  },
  {
    templateId: "tpl-bug-fix",
    filename: "bug-fix-workflow.yaml",
    category: "Bug Fixing & Debugging",
    tags: ["debugging", "testing", "pull-request", "automation"],
    difficulty: "intermediate",
    estimatedTime: "60-90 minutes",
  },
  {
    templateId: "tpl-documentation",
    filename: "documentation-workflow.yaml",
    category: "Documentation Generation",
    tags: ["documentation", "api-docs", "code-gen"],
    difficulty: "beginner",
    estimatedTime: "30-60 minutes",
  },
  {
    templateId: "tpl-test-generation",
    filename: "test-generation-workflow.yaml",
    category: "Testing & Validation",
    tags: ["testing", "coverage", "quality", "automation"],
    difficulty: "advanced",
    estimatedTime: "60-90 minutes",
  },
  {
    templateId: "tpl-deployment",
    filename: "deployment-workflow.yaml",
    category: "Deployment & Release",
    tags: ["deployment", "ci-cd", "automation", "validation"],
    difficulty: "advanced",
    estimatedTime: "90-120 minutes",
  },
  {
    templateId: "tpl-data-analysis",
    filename: "data-analysis-workflow.yaml",
    category: "Data Processing",
    tags: ["data", "analytics", "reporting", "automation"],
    difficulty: "intermediate",
    estimatedTime: "120-180 minutes",
  },
];

/**
 * Load a template from YAML file
 */
async function loadTemplate(filename: string): Promise<any> {
  const filePath = path.join(TEMPLATES_DIR, filename);
  const content = await fs.readFile(filePath, "utf-8");
  return yaml.parse(content);
}

/**
 * Load all built-in templates
 */
export async function loadBuiltInTemplates(): Promise<InsertWorkflowTemplate[]> {
  const templates: InsertWorkflowTemplate[] = [];

  for (const metadata of TEMPLATE_METADATA) {
    try {
      const config = await loadTemplate(metadata.filename);

      // Validate the workflow config
      workflowConfigSchema.parse(config);

      const template: InsertWorkflowTemplate = {
        templateId: metadata.templateId,
        name: config.name,
        description: config.description,
        category: metadata.category,
        tags: metadata.tags,
        difficulty: metadata.difficulty,
        estimatedTime: metadata.estimatedTime,
        version: config.version,
        authorId: undefined,
        isPublic: true,
        isBuiltIn: true,
        workflowConfig: config,
        usageCount: 0,
        averageRating: 0,
      };

      templates.push(template);
    } catch (error) {
      console.error(`Failed to load template ${metadata.filename}:`, error);
    }
  }

  return templates;
}

/**
 * Get template metadata
 */
export function getTemplateMetadata(): TemplateMetadata[] {
  return TEMPLATE_METADATA;
}
