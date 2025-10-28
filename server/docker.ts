import { spawn, ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { MCPServerConfig } from './mcpManager';
import { ToolValidator, validateToolConfiguration } from './toolValidator';

export interface ContainerConfig {
  image: string;
  resources: {
    memory: number; // MB
    cpus: number;
    timeout: number; // seconds
  };
  environment?: Record<string, string>;
  volumes?: string[];
  mcpServers?: MCPServerConfig[];
  workingDir?: string; // Working directory inside container
  githubRepo?: string; // GitHub repo to clone before execution
  tools?: string[]; // Allowed tools for this container
}

export interface ExecutionResult {
  exitCode: number;
  output: string;
  error?: string;
  duration: number;
  containerId: string;
  toolsUsed?: string[]; // Tools that were allowed for this execution
  toolValidation?: {
    valid: boolean;
    errors?: string[];
  };
}

/**
 * Spawn a Docker container with Claude Code installed
 */
export async function spawnContainer(config: ContainerConfig): Promise<string> {
  const containerId = `claude-code-${randomBytes(8).toString('hex')}`;
  
  const dockerArgs = [
    'run',
    '-d', // Detached mode
    '--name', containerId,
    '--memory', `${config.resources.memory}m`,
    '--cpus', config.resources.cpus.toString(),
    '--network', 'bridge',
  ];

  // Add environment variables
  if (config.environment) {
    for (const [key, value] of Object.entries(config.environment)) {
      dockerArgs.push('-e', `${key}=${value}`);
    }
  }

  // Add volumes
  if (config.volumes) {
    for (const volume of config.volumes) {
      dockerArgs.push('-v', volume);
    }
  }

  // Add image
  dockerArgs.push(config.image);

  // Keep container running
  dockerArgs.push('tail', '-f', '/dev/null');

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', dockerArgs);
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Failed to spawn container: ${stderr}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error('Container spawn timeout'));
    }, 30000);
  });
}

/**
 * Configure MCP servers in a container
 */
export async function configureMCPServers(
  containerId: string,
  mcpServers: MCPServerConfig[]
): Promise<void> {
  if (!mcpServers || mcpServers.length === 0) {
    return;
  }

  console.log(`[Docker] Configuring ${mcpServers.length} MCP server(s) in container ${containerId}`);

  // Create MCP config directory in container
  const setupCommand = `mkdir -p /root/.config/claude`;
  await execInContainer(containerId, setupCommand);

  // Generate MCP configuration file
  const mcpConfig = {
    mcpServers: {} as Record<string, { command: string; args: string[]; env?: Record<string, string> }>,
  };

  for (const server of mcpServers) {
    if (server.command) {
      mcpConfig.mcpServers[server.name] = {
        command: server.command,
        args: server.args || [],
      };

      // Include environment variables in config if needed
      if (server.env && Object.keys(server.env).length > 0) {
        mcpConfig.mcpServers[server.name].env = server.env;
      }
    }
  }

  // Write MCP config to container
  const configJson = JSON.stringify(mcpConfig, null, 2);
  const writeConfigCommand = `cat > /root/.config/claude/mcp.json << 'EOF'\n${configJson}\nEOF`;

  try {
    await execInContainer(containerId, writeConfigCommand);
    console.log(`[Docker] MCP configuration written to container ${containerId}`);
  } catch (error) {
    console.error(`[Docker] Failed to write MCP config to container:`, error);
    throw error;
  }
}

/**
 * Helper function to execute a command in a container
 */
async function execInContainer(containerId: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', [
      'exec',
      '-i',
      containerId,
      '/bin/bash',
      '-c',
      command
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Command timeout'));
    }, 30000);
  });
}

/**
 * Execute Claude Code command in a container
 */
export async function executeInContainer(
  containerId: string,
  prompt: string,
  config: ContainerConfig,
  onLog?: (message: string) => void
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Validate and prepare tools
  let toolsForCLI: string[] = [];
  let toolValidation: { valid: boolean; errors?: string[] } | undefined;

  if (config.tools && config.tools.length > 0) {
    const validation = validateToolConfiguration(config.tools);
    toolValidation = {
      valid: validation.valid,
      errors: validation.errors.length > 0 ? validation.errors : undefined,
    };

    if (!validation.valid) {
      console.error('[Docker] Tool validation failed:', validation.errors);
      if (onLog) {
        onLog(`[ERROR] Tool validation failed: ${validation.errors.join('; ')}\n`);
      }
      // Return early with validation error
      return {
        exitCode: 1,
        output: '',
        error: `Tool validation failed: ${validation.errors.join('; ')}`,
        duration: Date.now() - startTime,
        containerId,
        toolsUsed: [],
        toolValidation,
      };
    }

    toolsForCLI = validation.normalizedTools;

    if (onLog) {
      onLog(`[INFO] Allowed tools: ${toolsForCLI.join(', ')}\n`);
    }

    // Log high-risk tools
    const validator = new ToolValidator(toolsForCLI);
    const highRiskTools = validator.getHighRiskTools(toolsForCLI);
    if (highRiskTools.length > 0 && onLog) {
      onLog(`[WARN] High-risk tools allowed: ${highRiskTools.join(', ')}\n`);
    }
  }

  // Configure MCP servers if specified
  if (config.mcpServers && config.mcpServers.length > 0) {
    try {
      await configureMCPServers(containerId, config.mcpServers);
    } catch (error) {
      console.error('[Docker] Failed to configure MCP servers:', error);
      // Continue anyway - MCP servers are optional
      if (onLog) {
        onLog(`[WARN] Failed to configure MCP servers: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  }

  // Build Claude Code command with tool restrictions
  const workDir = config.workingDir || '/workspace';
  const escapedPrompt = prompt.replace(/"/g, '\\"');

  // Add tool restrictions to command
  let claudeCommand = `cd ${workDir} && claude --dangerously-skip-permissions`;

  if (toolsForCLI.length > 0) {
    // Format tools for CLI: Read,Write,Edit,Bash:npm:*
    const toolsList = toolsForCLI.join(',');
    claudeCommand += ` --allow-tools "${toolsList}"`;
  }

  claudeCommand += ` "${escapedPrompt}"`;

  if (onLog) {
    onLog(`[INFO] Executing Claude Code with tool restrictions\n`);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', [
      'exec',
      '-i',
      containerId,
      '/bin/bash',
      '-c',
      claudeCommand
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (onLog) {
        onLog(chunk);
      }
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (onLog) {
        onLog(`[ERROR] ${chunk}`);
      }
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;

      resolve({
        exitCode: code || 0,
        output: stdout,
        error: stderr || undefined,
        duration,
        containerId,
        toolsUsed: toolsForCLI,
        toolValidation,
      });
    });

    // Timeout based on config
    const timeout = config.resources.timeout * 1000;
    setTimeout(() => {
      proc.kill();
      const duration = Date.now() - startTime;

      resolve({
        exitCode: 124, // Timeout exit code
        output: stdout,
        error: 'Execution timeout',
        duration,
        containerId,
        toolsUsed: toolsForCLI,
        toolValidation,
      });
    }, timeout);
  });
}

/**
 * Stop and remove a container
 */
export async function stopContainer(containerId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['rm', '-f', containerId]);
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to stop container ${containerId}`));
      }
    });

    setTimeout(() => {
      proc.kill();
      resolve(); // Resolve anyway after timeout
    }, 10000);
  });
}

/**
 * Get container logs
 */
export async function getContainerLogs(containerId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['logs', containerId]);
    
    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      resolve(output);
    });

    setTimeout(() => {
      proc.kill();
      resolve(output);
    }, 5000);
  });
}

/**
 * Check if Docker is available
 */
export async function checkDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['version']);
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });

    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Build the Claude Code base image
 */
export async function buildClaudeCodeImage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', [
      'build',
      '-t', 'claude-code:latest',
      '-f', './docker/Dockerfile.claude-code',
      '.'
    ]);

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(data.toString());
    });

    proc.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[Docker] Claude Code image built successfully');
        resolve();
      } else {
        reject(new Error(`Failed to build image: ${stderr}`));
      }
    });
  });
}


/**
 * Clone a GitHub repository into a container
 */
export async function cloneGitHubRepo(
  containerId: string,
  repoUrl: string,
  targetDir: string = '/workspace'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cloneCommand = `git clone ${repoUrl} ${targetDir}`;
    
    const proc = spawn('docker', [
      'exec',
      '-i',
      containerId,
      '/bin/bash',
      '-c',
      cloneCommand
    ]);

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to clone repo: ${stderr}`));
      }
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Git clone timeout'));
    }, 60000); // 1 minute timeout for cloning
  });
}

