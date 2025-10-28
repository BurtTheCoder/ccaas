/**
 * Tool Access Control and Validation Module
 *
 * Provides comprehensive tool validation, access control, and audit logging
 * for Claude Code Service tool usage.
 */

export enum ToolRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface ToolMetadata {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  allowsSubTools: boolean;
  subTools?: string[];
  requiredCapabilities?: string[];
}

export interface ToolValidationResult {
  valid: boolean;
  tool: string;
  error?: string;
  riskLevel?: ToolRiskLevel;
  normalizedTool?: string;
}

export interface ToolAccessLog {
  workflowId?: string;
  agentName?: string;
  requestedTools: string[];
  allowedTools: string[];
  deniedTools: string[];
  timestamp: Date;
}

/**
 * Comprehensive tool registry with metadata
 */
const TOOL_REGISTRY: Map<string, ToolMetadata> = new Map([
  // Low Risk Tools - Read-only operations
  ['Read', {
    name: 'Read',
    description: 'Read files from the filesystem',
    riskLevel: ToolRiskLevel.LOW,
    allowsSubTools: false,
  }],
  ['Grep', {
    name: 'Grep',
    description: 'Search file contents using patterns',
    riskLevel: ToolRiskLevel.LOW,
    allowsSubTools: false,
  }],
  ['Glob', {
    name: 'Glob',
    description: 'Find files matching patterns',
    riskLevel: ToolRiskLevel.LOW,
    allowsSubTools: false,
  }],
  ['CreateDirectory', {
    name: 'CreateDirectory',
    description: 'Create new directories',
    riskLevel: ToolRiskLevel.LOW,
    allowsSubTools: false,
  }],

  // Medium Risk Tools - Write operations
  ['Write', {
    name: 'Write',
    description: 'Write content to files',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],
  ['Edit', {
    name: 'Edit',
    description: 'Edit existing files',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],
  ['DeleteFile', {
    name: 'DeleteFile',
    description: 'Delete files from filesystem',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],
  ['NotebookEdit', {
    name: 'NotebookEdit',
    description: 'Edit Jupyter notebook cells',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],

  // High Risk Tools - Command execution
  ['Bash', {
    name: 'Bash',
    description: 'Execute bash commands',
    riskLevel: ToolRiskLevel.HIGH,
    allowsSubTools: true,
    subTools: [
      'npm', 'npm:*',
      'git', 'git:*',
      'python', 'python:*',
      'node', 'node:*',
      'docker', 'docker:*',
      'kubectl', 'kubectl:*',
      'curl', 'curl:*',
      'wget', 'wget:*',
      'make', 'make:*',
      'cargo', 'cargo:*',
      'go', 'go:*',
      'pip', 'pip:*',
      'yarn', 'yarn:*',
      'pnpm', 'pnpm:*',
    ],
  }],
  ['BashOutput', {
    name: 'BashOutput',
    description: 'Retrieve output from background bash processes',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],
  ['KillShell', {
    name: 'KillShell',
    description: 'Terminate background bash shells',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],

  // Communication Tools
  ['WebFetch', {
    name: 'WebFetch',
    description: 'Fetch content from web URLs',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],
  ['WebSearch', {
    name: 'WebSearch',
    description: 'Search the web for information',
    riskLevel: ToolRiskLevel.LOW,
    allowsSubTools: false,
  }],

  // Meta Tools
  ['AskUserQuestion', {
    name: 'AskUserQuestion',
    description: 'Ask questions to gather user input',
    riskLevel: ToolRiskLevel.LOW,
    allowsSubTools: false,
  }],
  ['TodoWrite', {
    name: 'TodoWrite',
    description: 'Create and manage task lists',
    riskLevel: ToolRiskLevel.LOW,
    allowsSubTools: false,
  }],
  ['Skill', {
    name: 'Skill',
    description: 'Execute specialized skills',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],
  ['SlashCommand', {
    name: 'SlashCommand',
    description: 'Execute slash commands',
    riskLevel: ToolRiskLevel.MEDIUM,
    allowsSubTools: false,
  }],
]);

/**
 * High-risk bash commands that should be explicitly blocked
 */
const DANGEROUS_BASH_COMMANDS = [
  'rm', 'rm:*', 'rm:-rf',
  'sudo', 'sudo:*',
  'chmod', 'chmod:*',
  'chown', 'chown:*',
  'dd', 'dd:*',
  'mkfs', 'mkfs:*',
  'fdisk', 'fdisk:*',
  'iptables', 'iptables:*',
  'systemctl', 'systemctl:*',
  'service', 'service:*',
  'reboot', 'shutdown',
  'kill', 'kill:*', 'killall',
  'ssh', 'ssh:*',
  'scp', 'scp:*',
  'sftp', 'sftp:*',
  'nc', 'netcat',
  'telnet',
];

/**
 * Tool Validator Class
 *
 * Validates tool names against allowed list, supports wildcard patterns,
 * and provides comprehensive error messages.
 */
export class ToolValidator {
  private allowedTools: string[];
  private riskThreshold: ToolRiskLevel;

  constructor(allowedTools: string[] = [], riskThreshold: ToolRiskLevel = ToolRiskLevel.HIGH) {
    this.allowedTools = allowedTools.map(t => t.trim());
    this.riskThreshold = riskThreshold;
  }

  /**
   * Validate a single tool name
   */
  validateTool(tool: string): ToolValidationResult {
    const trimmedTool = tool.trim();

    // Check if tool exists in registry
    const toolMetadata = this.getToolMetadata(trimmedTool);
    if (!toolMetadata) {
      return {
        valid: false,
        tool: trimmedTool,
        error: `Unknown tool: '${trimmedTool}'. Available tools: ${this.getAvailableTools().join(', ')}`,
      };
    }

    // Check risk level
    if (!this.isRiskLevelAllowed(toolMetadata.riskLevel)) {
      return {
        valid: false,
        tool: trimmedTool,
        error: `Tool '${trimmedTool}' has risk level ${toolMetadata.riskLevel} which exceeds threshold ${this.riskThreshold}`,
        riskLevel: toolMetadata.riskLevel,
      };
    }

    // Check if tool is in allowed list
    if (this.allowedTools.length > 0 && !this.isToolAllowed(trimmedTool)) {
      return {
        valid: false,
        tool: trimmedTool,
        error: `Tool '${trimmedTool}' is not in the allowed tools list. Allowed tools: ${this.allowedTools.join(', ')}`,
        riskLevel: toolMetadata.riskLevel,
      };
    }

    // Check for dangerous bash commands
    if (this.isDangerousCommand(trimmedTool)) {
      return {
        valid: false,
        tool: trimmedTool,
        error: `Tool '${trimmedTool}' is a dangerous command and is explicitly blocked for security`,
        riskLevel: ToolRiskLevel.HIGH,
      };
    }

    return {
      valid: true,
      tool: trimmedTool,
      riskLevel: toolMetadata.riskLevel,
      normalizedTool: this.normalizeTool(trimmedTool),
    };
  }

  /**
   * Validate a list of tools
   */
  validateTools(tools: string[]): {
    valid: boolean;
    results: ToolValidationResult[];
    allowedTools: string[];
    deniedTools: string[];
    errors: string[];
  } {
    const results = tools.map(tool => this.validateTool(tool));
    const allowedTools = results.filter(r => r.valid).map(r => r.normalizedTool || r.tool);
    const deniedTools = results.filter(r => !r.valid).map(r => r.tool);
    const errors = results.filter(r => !r.valid).map(r => r.error || 'Unknown error');

    return {
      valid: deniedTools.length === 0,
      results,
      allowedTools,
      deniedTools,
      errors,
    };
  }

  /**
   * Get normalized tool string for Claude CLI
   */
  normalizeTool(tool: string): string {
    // Handle sub-tool syntax: Bash(npm:test) -> Bash:npm:test
    const subToolMatch = tool.match(/^(\w+)\((.*)\)$/);
    if (subToolMatch) {
      const [, baseTool, subTools] = subToolMatch;
      return `${baseTool}:${subTools}`;
    }

    return tool;
  }

  /**
   * Check if a tool is allowed based on allowed list and wildcards
   */
  private isToolAllowed(tool: string): boolean {
    if (this.allowedTools.length === 0) {
      return true; // No restrictions if list is empty
    }

    // Direct match
    if (this.allowedTools.includes(tool)) {
      return true;
    }

    // Wildcard matching
    for (const allowed of this.allowedTools) {
      if (this.matchesPattern(tool, allowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match tool name against pattern with wildcard support
   */
  private matchesPattern(tool: string, pattern: string): boolean {
    // Handle Bash(npm:*) pattern
    const patternMatch = pattern.match(/^(\w+)\((.*)\)$/);
    const toolMatch = tool.match(/^(\w+)\((.*)\)$/);

    if (patternMatch && toolMatch) {
      const [, patternBase, patternSub] = patternMatch;
      const [, toolBase, toolSub] = toolMatch;

      if (patternBase !== toolBase) {
        return false;
      }

      return this.matchesWildcard(toolSub, patternSub);
    }

    // Handle direct wildcard patterns
    return this.matchesWildcard(tool, pattern);
  }

  /**
   * Check if string matches wildcard pattern
   */
  private matchesWildcard(str: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return str.startsWith(prefix);
    }

    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(str);
    }

    return str === pattern;
  }

  /**
   * Get tool metadata from registry
   */
  private getToolMetadata(tool: string): ToolMetadata | null {
    // Try direct lookup
    if (TOOL_REGISTRY.has(tool)) {
      return TOOL_REGISTRY.get(tool)!;
    }

    // Try extracting base tool for sub-tools
    const baseToolMatch = tool.match(/^(\w+)(?:\(|:)/);
    if (baseToolMatch) {
      const baseTool = baseToolMatch[1];
      if (TOOL_REGISTRY.has(baseTool)) {
        return TOOL_REGISTRY.get(baseTool)!;
      }
    }

    return null;
  }

  /**
   * Check if risk level is allowed
   */
  private isRiskLevelAllowed(riskLevel: ToolRiskLevel): boolean {
    const riskLevels = [ToolRiskLevel.LOW, ToolRiskLevel.MEDIUM, ToolRiskLevel.HIGH];
    const currentIndex = riskLevels.indexOf(riskLevel);
    const thresholdIndex = riskLevels.indexOf(this.riskThreshold);
    return currentIndex <= thresholdIndex;
  }

  /**
   * Check if command is explicitly dangerous
   */
  private isDangerousCommand(tool: string): boolean {
    for (const dangerous of DANGEROUS_BASH_COMMANDS) {
      if (this.matchesWildcard(tool, dangerous) ||
          tool.includes(dangerous) ||
          this.matchesWildcard(tool, `Bash(${dangerous})`) ||
          this.matchesWildcard(tool, `Bash:${dangerous}`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    return Array.from(TOOL_REGISTRY.keys());
  }

  /**
   * Get tools by risk level
   */
  getToolsByRiskLevel(riskLevel: ToolRiskLevel): string[] {
    return Array.from(TOOL_REGISTRY.entries())
      .filter(([, metadata]) => metadata.riskLevel === riskLevel)
      .map(([name]) => name);
  }

  /**
   * Get high-risk tools from a list
   */
  getHighRiskTools(tools: string[]): string[] {
    return tools.filter(tool => {
      const result = this.validateTool(tool);
      return result.riskLevel === ToolRiskLevel.HIGH;
    });
  }

  /**
   * Format tool list for Claude CLI --allow-tools parameter
   */
  formatToolsForCLI(tools: string[]): string {
    const validation = this.validateTools(tools);
    if (!validation.valid) {
      throw new Error(`Invalid tools: ${validation.errors.join('; ')}`);
    }
    return validation.allowedTools.join(',');
  }

  /**
   * Create audit log entry
   */
  createAuditLog(
    requestedTools: string[],
    workflowId?: string,
    agentName?: string
  ): ToolAccessLog {
    const validation = this.validateTools(requestedTools);

    return {
      workflowId,
      agentName,
      requestedTools,
      allowedTools: validation.allowedTools,
      deniedTools: validation.deniedTools,
      timestamp: new Date(),
    };
  }

  /**
   * Get detailed validation report
   */
  getValidationReport(tools: string[]): string {
    const validation = this.validateTools(tools);

    const lines: string[] = [
      '=== Tool Access Control Report ===',
      `Total Tools Requested: ${tools.length}`,
      `Allowed: ${validation.allowedTools.length}`,
      `Denied: ${validation.deniedTools.length}`,
      '',
    ];

    if (validation.allowedTools.length > 0) {
      lines.push('Allowed Tools:');
      validation.results
        .filter(r => r.valid)
        .forEach(r => {
          lines.push(`  ✓ ${r.tool} (${r.riskLevel})`);
        });
      lines.push('');
    }

    if (validation.deniedTools.length > 0) {
      lines.push('Denied Tools:');
      validation.results
        .filter(r => !r.valid)
        .forEach(r => {
          lines.push(`  ✗ ${r.tool}`);
          lines.push(`    Reason: ${r.error}`);
        });
      lines.push('');
    }

    const highRiskTools = this.getHighRiskTools(validation.allowedTools);
    if (highRiskTools.length > 0) {
      lines.push('⚠️  High-Risk Tools Allowed:');
      highRiskTools.forEach(tool => {
        lines.push(`  ! ${tool}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Get default safe tools for workflows
 */
export function getDefaultSafeTools(): string[] {
  return [
    'Read',
    'Grep',
    'Glob',
    'Write',
    'Edit',
    'CreateDirectory',
    'TodoWrite',
    'WebSearch',
  ];
}

/**
 * Get tools with bash access restricted to safe commands
 */
export function getSafeBashTools(): string[] {
  return [
    ...getDefaultSafeTools(),
    'Bash(npm:*)',
    'Bash(git:*)',
    'Bash(python:*)',
    'Bash(node:*)',
    'Bash(pnpm:*)',
    'Bash(yarn:*)',
  ];
}

/**
 * Validate tool configuration from workflow YAML
 */
export function validateToolConfiguration(tools: string[] | undefined): {
  valid: boolean;
  errors: string[];
  normalizedTools: string[];
} {
  if (!tools || tools.length === 0) {
    // Use default safe tools if none specified
    return {
      valid: true,
      errors: [],
      normalizedTools: getDefaultSafeTools(),
    };
  }

  const validator = new ToolValidator([], ToolRiskLevel.HIGH);
  const validation = validator.validateTools(tools);

  return {
    valid: validation.valid,
    errors: validation.errors,
    normalizedTools: validation.allowedTools,
  };
}
