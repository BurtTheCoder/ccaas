import { ContainerConfig } from './docker';
import { WorkflowAgent } from './configService';
import { getMcpManager } from './mcpManager';
import { ENV } from './_core/env';

/**
 * Interpolate variables in a string template
 */
export function interpolateVariables(template: string, variables: Record<string, any>): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
    const keys = key.split('.');
    let value: any = variables;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return match; // Keep original if not found
      }
    }
    return String(value);
  });
}

/**
 * Evaluate a condition expression
 */
export function evaluateCondition(expression: string, context: Record<string, any>): boolean {
  try {
    const interpolated = interpolateVariables(expression, context);
    // This is still a simplified and somewhat unsafe evaluator.
    // In a real production environment, a proper sandboxed expression evaluator should be used.
    const operators = ['==', '!=', '>=', '<=', '>', '<'];
    const logicalOperators = ['&&', '||'];

    // A simple way to handle logical operators is to split by them and evaluate parts.
    // This has limitations with operator precedence and parentheses.
    const orParts = interpolated.split('|| ').map(s => s.trim());
    for (const orPart of orParts) {
      const andParts = orPart.split('&& ').map(s => s.trim());
      let andResult = true;
      for (const andPart of andParts) {
        let partResult = false;
        for (const op of operators) {
          if (andPart.includes(op)) {
            const [leftStr, rightStr] = andPart.split(op).map(s => s.trim());
            const left = parseFloat(leftStr) || leftStr;
            const right = parseFloat(rightStr) || rightStr;

            switch (op) {
              case '==': partResult = left === right; break;
              case '!=': partResult = left !== right; break;
              case '>=': partResult = left >= right; break;
              case '<=': partResult = left <= right; break;
              case '>': partResult = left > right; break;
              case '<': partResult = left < right; break;
            }
            break; // Assume one operator per part
          }
        }
        if (!partResult) {
            // Handle boolean checks like '${variable}' being true
            if (andPart === 'true') partResult = true;
            else if (andPart === 'false') partResult = false;
        }

        andResult = andResult && partResult;
      }
      if (andResult) return true; // If any OR part is true, the whole expression is true
    }

    return false; // If no OR part was true

  } catch (error) {
    console.error(`[Config] Failed to evaluate condition: ${expression}`, error);
    return false;
  }
}

/**
 * Parse cost string to cents (e.g., "$5.00" -> 500)
 */
export function parseCost(costStr: string): number {
  const match = costStr.match(/\$?(\d+\.?\d*)/);
  if (!match) return 0;
  return Math.round(parseFloat(match[1]) * 100);
}

/**
 * Format cost from cents to string (e.g., 500 -> "$5.00")
 */
export function formatCost(cents: number): string {
  return `${(cents / 100).toFixed(2)}`;
}

/**
 * Convert agent container config to docker ContainerConfig
 */
export function convertToContainerConfig(agentContainer: WorkflowAgent['container']): ContainerConfig {
  const parseMemory = (mem?: string): number => {
    if (!mem) return 2048; // Default 2GB
    const match = mem.match(/(\d+)(Gi|Mi)/);
    if (!match) return 2048;
    const amount = parseInt(match[1]);
    return match[2] === 'Gi' ? amount * 1024 : amount;
  };

  const parseTimeout = (timeout?: string): number => {
    if (!timeout) return 600; // Default 10 minutes
    const match = timeout.match(/(\d+)(s|m|h)/);
    if (!match) return 600;
    const amount = parseInt(match[1]);
    if (match[2] === 's') return amount;
    if (match[2] === 'm') return amount * 60;
    return amount * 3600; // hours
  };

  const parseCPU = (cpu?: string): number => {
    if (!cpu) return 2; // Default 2 CPUs
    return parseFloat(cpu) || 2;
  };

  // Process MCP servers (support both snake_case and camelCase)
  const mcpServerConfigs = agentContainer.mcp_servers || agentContainer.mcpServers;
  let mcpServers = undefined;

  if (mcpServerConfigs && mcpServerConfigs.length > 0) {
    // Build environment with all available credentials
    const environment: Record<string, string> = {
      GITHUB_TOKEN: ENV.githubToken,
      LINEAR_API_KEY: ENV.linearApiKey,
      BRAVE_API_KEY: ENV.braveApiKey,
      SLACK_BOT_TOKEN: ENV.slackBotToken,
      GOOGLE_DRIVE_CREDENTIALS: ENV.googleDriveCredentials,
      POSTGRES_CONNECTION_STRING: ENV.postgresConnectionString,
    };

    // Get MCP manager and configure servers
    const mcpManager = getMcpManager();
    mcpServers = mcpManager.configureMCPServers(mcpServerConfigs, environment);

    if (mcpServers.length > 0) {
      console.log(`[WorkflowUtils] Configured ${mcpServers.length} MCP server(s):`, mcpServers.map(s => s.name).join(', '));
    }
  }

  return {
    image: agentContainer.image,
    resources: {
      memory: parseMemory(agentContainer.resources?.memory),
      cpus: parseCPU(agentContainer.resources?.cpu),
      timeout: parseTimeout(agentContainer.resources?.timeout),
    },
    githubRepo: agentContainer.githubRepo,
    workingDir: agentContainer.workingDir,
    mcpServers,
    tools: agentContainer.tools, // Pass tools through for validation
  };
}
