import { spawn, ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  protocol?: 'stdio' | 'sse' | 'socket';
  enabled?: boolean;
}

/**
 * Built-in MCP Server Definition
 */
export interface BuiltInMCPServer {
  name: string;
  description: string;
  command: string;
  args: string[];
  requiredEnv: string[];
  protocol: 'stdio' | 'sse' | 'socket';
}

/**
 * MCP Server Instance
 */
export interface MCPServerInstance {
  id: string;
  config: MCPServerConfig;
  process?: ChildProcess;
  status: 'starting' | 'running' | 'failed' | 'stopped';
  error?: string;
  startedAt?: Date;
  healthCheckInterval?: NodeJS.Timeout;
}

/**
 * MCP Server Manager
 * Manages lifecycle of MCP servers for Claude Code agents
 */
export class McpServerManager {
  private servers: Map<string, MCPServerInstance> = new Map();
  private builtInServers: Map<string, BuiltInMCPServer>;

  constructor() {
    this.builtInServers = this.initializeBuiltInServers();
  }

  /**
   * Initialize registry of built-in MCP servers
   */
  private initializeBuiltInServers(): Map<string, BuiltInMCPServer> {
    const servers = new Map<string, BuiltInMCPServer>();

    // GitHub MCP Server
    servers.set('github', {
      name: 'github',
      description: 'GitHub API access for repositories, issues, PRs',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      requiredEnv: ['GITHUB_TOKEN'],
      protocol: 'stdio',
    });

    // Linear MCP Server
    servers.set('linear', {
      name: 'linear',
      description: 'Linear issue tracking integration',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-linear'],
      requiredEnv: ['LINEAR_API_KEY'],
      protocol: 'stdio',
    });

    // Web Search MCP Server (using Brave Search)
    servers.set('web_search', {
      name: 'web_search',
      description: 'Web search capability using Brave Search API',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      requiredEnv: ['BRAVE_API_KEY'],
      protocol: 'stdio',
    });

    // Filesystem MCP Server
    servers.set('filesystem', {
      name: 'filesystem',
      description: 'File system access with sandboxing',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
      requiredEnv: [],
      protocol: 'stdio',
    });

    // Slack MCP Server
    servers.set('slack', {
      name: 'slack',
      description: 'Slack messaging and notifications',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      requiredEnv: ['SLACK_BOT_TOKEN'],
      protocol: 'stdio',
    });

    return servers;
  }

  /**
   * Get built-in server configuration
   */
  public getBuiltInServer(name: string): BuiltInMCPServer | undefined {
    return this.builtInServers.get(name);
  }

  /**
   * Get all built-in servers
   */
  public getBuiltInServers(): BuiltInMCPServer[] {
    return Array.from(this.builtInServers.values());
  }

  /**
   * Resolve MCP server configuration
   * Handles both built-in servers (by name) and custom servers (full config)
   */
  public resolveMCPServerConfig(
    configOrName: string | MCPServerConfig,
    environment: Record<string, string>
  ): MCPServerConfig | null {
    let config: MCPServerConfig;

    // If it's a string, try to find built-in server
    if (typeof configOrName === 'string') {
      const builtIn = this.builtInServers.get(configOrName);
      if (!builtIn) {
        console.error(`[MCP] Unknown built-in MCP server: ${configOrName}`);
        return null;
      }

      // Check required environment variables
      const missingEnv = builtIn.requiredEnv.filter(envVar => !environment[envVar]);
      if (missingEnv.length > 0) {
        console.warn(
          `[MCP] MCP server '${configOrName}' requires environment variables: ${missingEnv.join(', ')}. Server will be disabled.`
        );
        return null;
      }

      config = {
        name: builtIn.name,
        command: builtIn.command,
        args: builtIn.args,
        protocol: builtIn.protocol,
        env: {},
        enabled: true,
      };

      // Extract relevant environment variables
      for (const envVar of builtIn.requiredEnv) {
        if (environment[envVar]) {
          config.env![envVar] = environment[envVar];
        }
      }
    } else {
      // Custom server configuration
      config = {
        ...configOrName,
        enabled: configOrName.enabled !== false,
      };
    }

    return config;
  }

  /**
   * Configure MCP servers for a container
   * Returns array of MCP server configs ready for container setup
   */
  public configureMCPServers(
    mcpServerConfigs: (string | MCPServerConfig)[],
    environment: Record<string, string>
  ): MCPServerConfig[] {
    const resolvedServers: MCPServerConfig[] = [];

    for (const configOrName of mcpServerConfigs) {
      const resolved = this.resolveMCPServerConfig(configOrName, environment);
      if (resolved && resolved.enabled !== false) {
        resolvedServers.push(resolved);
      }
    }

    return resolvedServers;
  }

  /**
   * Start an MCP server process
   * Note: This is for local testing. In production, MCP servers run inside containers.
   */
  public async startMCPServer(config: MCPServerConfig): Promise<MCPServerInstance> {
    const instanceId = `mcp_${config.name}_${randomBytes(4).toString('hex')}`;

    console.log(`[MCP] Starting MCP server: ${config.name} (${instanceId})`);

    const instance: MCPServerInstance = {
      id: instanceId,
      config,
      status: 'starting',
      startedAt: new Date(),
    };

    this.servers.set(instanceId, instance);

    try {
      if (!config.command) {
        throw new Error(`MCP server '${config.name}' has no command specified`);
      }

      // Spawn the MCP server process
      const childProcess = spawn(config.command, config.args || [], {
        env: {
          ...process.env,
          ...config.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      instance.process = childProcess;

      // Handle process events
      childProcess.on('error', (error: Error) => {
        console.error(`[MCP] Server ${config.name} process error:`, error);
        instance.status = 'failed';
        instance.error = error.message;
      });

      childProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        console.log(`[MCP] Server ${config.name} exited with code ${code}, signal ${signal}`);
        instance.status = 'stopped';
        if (code !== 0 && code !== null) {
          instance.error = `Process exited with code ${code}`;
        }
      });

      // Capture stderr for debugging
      childProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[MCP] ${config.name} stderr:`, data.toString());
      });

      // Wait a bit to see if it starts successfully
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (instance.status === 'failed') {
        throw new Error(instance.error || 'Failed to start MCP server');
      }

      instance.status = 'running';
      console.log(`[MCP] Server ${config.name} started successfully`);

      // Start health check interval
      instance.healthCheckInterval = setInterval(() => {
        this.checkServerHealth(instanceId);
      }, 30000); // Check every 30 seconds

      return instance;
    } catch (error) {
      console.error(`[MCP] Failed to start server ${config.name}:`, error);
      instance.status = 'failed';
      instance.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Check health of an MCP server
   */
  private checkServerHealth(instanceId: string): void {
    const instance = this.servers.get(instanceId);
    if (!instance || !instance.process) return;

    // Check if process is still running
    if (instance.process.killed || instance.process.exitCode !== null) {
      console.warn(`[MCP] Server ${instance.config.name} is no longer running`);
      instance.status = 'stopped';
      if (instance.healthCheckInterval) {
        clearInterval(instance.healthCheckInterval);
      }
    }
  }

  /**
   * Stop an MCP server
   */
  public async stopMCPServer(instanceId: string): Promise<void> {
    const instance = this.servers.get(instanceId);
    if (!instance) {
      console.warn(`[MCP] Server instance ${instanceId} not found`);
      return;
    }

    console.log(`[MCP] Stopping MCP server: ${instance.config.name} (${instanceId})`);

    // Clear health check interval
    if (instance.healthCheckInterval) {
      clearInterval(instance.healthCheckInterval);
    }

    // Kill the process
    if (instance.process && !instance.process.killed) {
      instance.process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (instance.process && !instance.process.killed) {
          console.warn(`[MCP] Force killing server ${instance.config.name}`);
          instance.process.kill('SIGKILL');
        }
      }, 5000);
    }

    instance.status = 'stopped';
    this.servers.delete(instanceId);
  }

  /**
   * Stop all MCP servers
   */
  public async stopAllServers(): Promise<void> {
    console.log(`[MCP] Stopping all MCP servers (${this.servers.size} servers)`);
    const stopPromises = Array.from(this.servers.keys()).map((id) =>
      this.stopMCPServer(id)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Get server instance
   */
  public getServerInstance(instanceId: string): MCPServerInstance | undefined {
    return this.servers.get(instanceId);
  }

  /**
   * Get all server instances
   */
  public getAllInstances(): MCPServerInstance[] {
    return Array.from(this.servers.values());
  }

  /**
   * Generate MCP server configuration file for Claude Code
   * This generates the config that Claude Code CLI expects
   */
  public generateClaudeCodeMCPConfig(servers: MCPServerConfig[]): string {
    const config = {
      mcpServers: {} as Record<string, { command: string; args: string[]; env?: Record<string, string> }>,
    };

    for (const server of servers) {
      if (server.command && server.enabled !== false) {
        config.mcpServers[server.name] = {
          command: server.command,
          args: server.args || [],
        };

        // Only include non-sensitive env vars in config
        // Actual env vars should be passed via container environment
        if (server.env && Object.keys(server.env).length > 0) {
          config.mcpServers[server.name].env = server.env;
        }
      }
    }

    return JSON.stringify(config, null, 2);
  }

  /**
   * Validate MCP server configuration
   */
  public validateMCPConfig(config: MCPServerConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('MCP server name is required');
    }

    if (!config.command && !this.builtInServers.has(config.name)) {
      errors.push(`MCP server '${config.name}' is not a built-in server and has no command specified`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let mcpManagerInstance: McpServerManager | null = null;

/**
 * Get or create MCP Manager singleton
 */
export function getMcpManager(): McpServerManager {
  if (!mcpManagerInstance) {
    mcpManagerInstance = new McpServerManager();
  }
  return mcpManagerInstance;
}
