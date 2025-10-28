import { MCPServerConfig } from './mcpManager';

/**
 * Built-in MCP Server Definitions
 *
 * These are community MCP servers that can be used by agents.
 * They are installed via npx when needed.
 */
export interface BuiltInMCPServerDefinition {
  name: string;
  description: string;
  package: string;
  command: string;
  args: (env?: Record<string, string>) => string[];
  requiredEnv: string[];
  optionalEnv?: string[];
  protocol: 'stdio' | 'sse' | 'socket';
  documentation?: string;
  examples?: string[];
}

/**
 * Registry of built-in MCP servers
 */
export const BUILTIN_MCP_SERVERS: Record<string, BuiltInMCPServerDefinition> = {
  // GitHub MCP Server
  github: {
    name: 'github',
    description: 'GitHub API access for repositories, issues, pull requests, and more',
    package: '@modelcontextprotocol/server-github',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-github'],
    requiredEnv: ['GITHUB_TOKEN'],
    optionalEnv: ['GITHUB_API_URL'],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    examples: [
      'List repositories',
      'Create issues',
      'Review pull requests',
      'Search code',
      'Manage branches',
    ],
  },

  // Linear MCP Server
  linear: {
    name: 'linear',
    description: 'Linear issue tracking and project management integration',
    package: '@modelcontextprotocol/server-linear',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-linear'],
    requiredEnv: ['LINEAR_API_KEY'],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/linear',
    examples: [
      'Create and update issues',
      'Search issues',
      'Manage projects',
      'Track cycles',
      'Assign team members',
    ],
  },

  // Brave Search MCP Server (Web Search)
  web_search: {
    name: 'web_search',
    description: 'Web search capability using Brave Search API',
    package: '@modelcontextprotocol/server-brave-search',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-brave-search'],
    requiredEnv: ['BRAVE_API_KEY'],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    examples: [
      'Search the web',
      'Get search results',
      'Find recent news',
      'Research topics',
    ],
  },

  // Filesystem MCP Server
  filesystem: {
    name: 'filesystem',
    description: 'File system access with path restrictions for security',
    package: '@modelcontextprotocol/server-filesystem',
    command: 'npx',
    args: (env) => {
      const allowedPaths = env?.ALLOWED_PATHS?.split(':') || ['/workspace'];
      return ['-y', '@modelcontextprotocol/server-filesystem', ...allowedPaths];
    },
    requiredEnv: [],
    optionalEnv: ['ALLOWED_PATHS'],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    examples: [
      'Read files',
      'Write files',
      'List directories',
      'Search files',
      'File operations',
    ],
  },

  // Slack MCP Server
  slack: {
    name: 'slack',
    description: 'Slack messaging and channel management',
    package: '@modelcontextprotocol/server-slack',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-slack'],
    requiredEnv: ['SLACK_BOT_TOKEN'],
    optionalEnv: ['SLACK_TEAM_ID'],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    examples: [
      'Send messages',
      'Read channels',
      'Post to channels',
      'List channels',
      'Get channel history',
    ],
  },

  // Google Drive MCP Server
  google_drive: {
    name: 'google_drive',
    description: 'Google Drive file access and management',
    package: '@modelcontextprotocol/server-gdrive',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-gdrive'],
    requiredEnv: ['GOOGLE_DRIVE_CREDENTIALS'],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive',
    examples: [
      'List files',
      'Read documents',
      'Upload files',
      'Search Drive',
      'Manage permissions',
    ],
  },

  // PostgreSQL MCP Server
  postgres: {
    name: 'postgres',
    description: 'PostgreSQL database access and queries',
    package: '@modelcontextprotocol/server-postgres',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-postgres'],
    requiredEnv: ['POSTGRES_CONNECTION_STRING'],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    examples: [
      'Execute queries',
      'List tables',
      'Describe schema',
      'Read data',
      'Database operations',
    ],
  },

  // Puppeteer MCP Server (Web Scraping/Automation)
  puppeteer: {
    name: 'puppeteer',
    description: 'Web automation and scraping with Puppeteer',
    package: '@modelcontextprotocol/server-puppeteer',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-puppeteer'],
    requiredEnv: [],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    examples: [
      'Navigate web pages',
      'Take screenshots',
      'Scrape content',
      'Automate interactions',
      'Fill forms',
    ],
  },

  // Memory MCP Server (Persistent storage for agents)
  memory: {
    name: 'memory',
    description: 'Persistent key-value storage for agent memory',
    package: '@modelcontextprotocol/server-memory',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-memory'],
    requiredEnv: [],
    protocol: 'stdio',
    documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    examples: [
      'Store values',
      'Retrieve values',
      'List keys',
      'Delete entries',
      'Persistent memory',
    ],
  },
};

/**
 * Get built-in MCP server definition
 */
export function getBuiltInServer(name: string): BuiltInMCPServerDefinition | undefined {
  return BUILTIN_MCP_SERVERS[name];
}

/**
 * Get all built-in server names
 */
export function getBuiltInServerNames(): string[] {
  return Object.keys(BUILTIN_MCP_SERVERS);
}

/**
 * Check if a server name is built-in
 */
export function isBuiltInServer(name: string): boolean {
  return name in BUILTIN_MCP_SERVERS;
}

/**
 * Create MCP server config from built-in definition
 */
export function createMCPServerConfig(
  name: string,
  environment: Record<string, string>
): MCPServerConfig | null {
  const definition = BUILTIN_MCP_SERVERS[name];
  if (!definition) {
    return null;
  }

  // Check required environment variables
  const missingEnv = definition.requiredEnv.filter((envVar) => !environment[envVar]);
  if (missingEnv.length > 0) {
    console.warn(
      `[MCP] Built-in server '${name}' requires environment variables: ${missingEnv.join(', ')}`
    );
    return null;
  }

  // Extract relevant environment variables
  const env: Record<string, string> = {};
  const allEnvVars = [...definition.requiredEnv, ...(definition.optionalEnv || [])];
  for (const envVar of allEnvVars) {
    if (environment[envVar]) {
      env[envVar] = environment[envVar];
    }
  }

  return {
    name: definition.name,
    command: definition.command,
    args: definition.args(env),
    protocol: definition.protocol,
    env,
    enabled: true,
  };
}

/**
 * Validate environment variables for an MCP server
 */
export function validateMCPServerEnvironment(
  name: string,
  environment: Record<string, string>
): { valid: boolean; missingEnv: string[] } {
  const definition = BUILTIN_MCP_SERVERS[name];
  if (!definition) {
    return { valid: false, missingEnv: [] };
  }

  const missingEnv = definition.requiredEnv.filter((envVar) => !environment[envVar]);

  return {
    valid: missingEnv.length === 0,
    missingEnv,
  };
}

/**
 * Get MCP server documentation
 */
export function getMCPServerDocumentation(name: string): string | undefined {
  return BUILTIN_MCP_SERVERS[name]?.documentation;
}

/**
 * List all available built-in MCP servers with their descriptions
 */
export function listAvailableMCPServers(): Array<{
  name: string;
  description: string;
  requiredEnv: string[];
  examples: string[];
}> {
  return Object.values(BUILTIN_MCP_SERVERS).map((server) => ({
    name: server.name,
    description: server.description,
    requiredEnv: server.requiredEnv,
    examples: server.examples || [],
  }));
}
