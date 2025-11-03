import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { z } from "zod";
import { validateToolConfiguration } from "./toolValidator";

// MCP Server configuration schema
export const mcpServerSchema = z.union([
  // Simple string for built-in servers
  z.string(),
  // Full configuration object for custom servers
  z.object({
    name: z.string(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    protocol: z.enum(['stdio', 'sse', 'socket']).optional(),
    enabled: z.boolean().optional(),
  }),
]);

export const agentSchema = z.object({
  name: z.string(),
  role: z.string(),
  container: z.object({
    image: z.string(),
    githubRepo: z.string().optional(),
    workingDir: z.string().optional(),
    tools: z.array(z.string()).optional().refine(
      (tools) => {
        if (!tools || tools.length === 0) return true;
        const validation = validateToolConfiguration(tools);
        return validation.valid;
      },
      {
        message: "Invalid tools configuration",
      }
    ),
    mcp_servers: z.array(mcpServerSchema).optional(),
    mcpServers: z.array(mcpServerSchema).optional(), // Alternative camelCase naming
    skills: z.array(z.string()).optional(),
    resources: z.object({
      memory: z.string().optional(),
      timeout: z.string().optional(),
      cpu: z.string().optional(),
    }).optional(),
  }),
  prompt: z.string(),
  output: z.string().optional(),
  next: z.union([z.string(), z.array(z.string())]).optional(),
  conditions: z.array(z.object({
    if: z.string(),
    then: z.any(),
    next: z.string().optional(),
  })).optional(),
  onError: z.object({
    action: z.string(),
    next: z.string().nullable().optional(),
    notify: z.boolean().optional(),
    comment: z.string().optional(),
  }).optional(),
});

export type WorkflowAgent = z.infer<typeof agentSchema>;



export type WorkflowConfig = z.infer<typeof workflowConfigSchema>;

export class ConfigService {
  constructor(private projectRoot: string) {}

  async getWorkflowConfig(projectPath: string): Promise<z.infer<typeof workflowConfigSchema> | null> {
    const configPath = path.join(this.projectRoot, projectPath, ".claude", "workflow.yaml");
    try {
      const fileContent = await fs.readFile(configPath, "utf-8");
      const config = yaml.parse(fileContent);
      return workflowConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`Invalid workflow config for project at ${projectPath}:`, error.issues);
      } else {
        console.error(`Error loading workflow config for project at ${projectPath}:`, error);
      }
      return null;
    }
  }

  async getWorkflowConfigRaw(projectPath: string): Promise<string | null> {
    const configPath = path.join(this.projectRoot, projectPath, ".claude", "workflow.yaml");
    try {
      return await fs.readFile(configPath, "utf-8");
    } catch (error) {
      console.error(`Error reading workflow config for project at ${projectPath}:`, error);
      return null;
    }
  }

  async saveWorkflowConfig(projectPath: string, content: string): Promise<void> {
    const configPath = path.join(this.projectRoot, projectPath, ".claude", "workflow.yaml");
    try {
      // Ensure the .claude directory exists
      const dir = path.dirname(configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(configPath, content, "utf-8");
    } catch (error) {
      console.error(`Error saving workflow config for project at ${projectPath}:`, error);
      throw error;
    }
  }

  async getContainerConfig(projectPath: string): Promise<string | null> {
    const configPath = path.join(this.projectRoot, projectPath, ".claude", "container.yaml");
    try {
      return await fs.readFile(configPath, "utf-8");
    } catch (error) {
      console.error(`Error reading container config for project at ${projectPath}:`, error);
      return null;
    }
  }

  async saveContainerConfig(projectPath: string, content: string): Promise<void> {
    const configPath = path.join(this.projectRoot, projectPath, ".claude", "container.yaml");
    try {
      // Ensure the .claude directory exists
      const dir = path.dirname(configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(configPath, content, "utf-8");
    } catch (error) {
      console.error(`Error saving container config for project at ${projectPath}:`, error);
      throw error;
    }
  }
}

export const workflowConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  agents: z.array(agentSchema),
  workflow: z.object({
    trigger: z.object({
      type: z.enum(["cron", "webhook", "manual"]),
      schedule: z.string().optional(),
      endpoint: z.string().optional()
    }),
    max_iterations: z.number().optional(),
    max_consecutive_failures: z.number().optional(),
    max_runtime: z.string().optional(),
    budget: z.object({
      max_cost_per_execution: z.string().optional(),
      daily_max_cost: z.string().optional(),
      monthly_max_cost: z.string().optional(),
      pause_on_exceed: z.boolean().optional(),
      alert_at_percent: z.number().optional()
    }).optional(),
    notifications: z.any().optional(),
    safety: z.object({
      require_human_approval_for: z.array(z.any()).optional(),
      never_auto_merge: z.array(z.any()).optional(),
      validation: z.object({
        min_score: z.number().optional(),
        require_tests: z.boolean().optional(),
        require_passing_tests: z.boolean().optional(),
        min_coverage: z.number().optional()
      }).optional()
    }).optional(),
    context: z.record(z.string(), z.any()).optional()
  })
});
