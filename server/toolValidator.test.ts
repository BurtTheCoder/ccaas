/**
 * Unit tests for Tool Validator
 *
 * Run with: pnpm test server/toolValidator.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  ToolValidator,
  ToolRiskLevel,
  validateToolConfiguration,
  getDefaultSafeTools,
  getSafeBashTools,
} from './toolValidator';

describe('ToolValidator', () => {
  describe('Basic Tool Validation', () => {
    it('should validate known tools', () => {
      const validator = new ToolValidator();

      const readResult = validator.validateTool('Read');
      expect(readResult.valid).toBe(true);
      expect(readResult.riskLevel).toBe(ToolRiskLevel.LOW);

      const writeResult = validator.validateTool('Write');
      expect(writeResult.valid).toBe(true);
      expect(writeResult.riskLevel).toBe(ToolRiskLevel.MEDIUM);

      const bashResult = validator.validateTool('Bash(npm:test)');
      expect(bashResult.valid).toBe(true);
      expect(bashResult.riskLevel).toBe(ToolRiskLevel.HIGH);
    });

    it('should reject unknown tools', () => {
      const validator = new ToolValidator();

      const result = validator.validateTool('InvalidTool');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown tool');
      expect(result.error).toContain('InvalidTool');
    });

    it('should reject dangerous commands', () => {
      const validator = new ToolValidator();

      const sudoResult = validator.validateTool('Bash(sudo)');
      expect(sudoResult.valid).toBe(false);
      expect(sudoResult.error).toContain('dangerous');

      const rmResult = validator.validateTool('Bash(rm:*)');
      expect(rmResult.valid).toBe(false);
      expect(rmResult.error).toContain('dangerous');

      const sshResult = validator.validateTool('Bash(ssh)');
      expect(sshResult.valid).toBe(false);
      expect(sshResult.error).toContain('dangerous');
    });
  });

  describe('Wildcard Pattern Matching', () => {
    it('should match wildcard patterns', () => {
      const validator = new ToolValidator(['Bash(npm:*)']);

      expect(validator.validateTool('Bash(npm:test)').valid).toBe(true);
      expect(validator.validateTool('Bash(npm:install)').valid).toBe(true);
      expect(validator.validateTool('Bash(npm:build)').valid).toBe(true);
      expect(validator.validateTool('Bash(git:status)').valid).toBe(false);
    });

    it('should handle multiple wildcard patterns', () => {
      const validator = new ToolValidator([
        'Bash(npm:*)',
        'Bash(git:*)',
        'Bash(python:*)',
      ]);

      expect(validator.validateTool('Bash(npm:test)').valid).toBe(true);
      expect(validator.validateTool('Bash(git:status)').valid).toBe(true);
      expect(validator.validateTool('Bash(python:run)').valid).toBe(true);
      expect(validator.validateTool('Bash(docker:build)').valid).toBe(false);
    });

    it('should handle star wildcard', () => {
      const validator = new ToolValidator(['*']);

      // Even with wildcard, dangerous commands should be blocked
      expect(validator.validateTool('Read').valid).toBe(true);
      expect(validator.validateTool('Write').valid).toBe(true);
      expect(validator.validateTool('Bash(sudo)').valid).toBe(false);
    });
  });

  describe('Risk Level Assessment', () => {
    it('should classify tools by risk level', () => {
      const validator = new ToolValidator();

      const lowRiskTools = validator.getToolsByRiskLevel(ToolRiskLevel.LOW);
      expect(lowRiskTools).toContain('Read');
      expect(lowRiskTools).toContain('Grep');
      expect(lowRiskTools).toContain('Glob');

      const mediumRiskTools = validator.getToolsByRiskLevel(ToolRiskLevel.MEDIUM);
      expect(mediumRiskTools).toContain('Write');
      expect(mediumRiskTools).toContain('Edit');
      expect(mediumRiskTools).toContain('DeleteFile');

      const highRiskTools = validator.getToolsByRiskLevel(ToolRiskLevel.HIGH);
      expect(highRiskTools).toContain('Bash');
    });

    it('should identify high-risk tools in a list', () => {
      const validator = new ToolValidator();

      const tools = ['Read', 'Write', 'Bash(npm:test)', 'Edit'];
      const highRiskTools = validator.getHighRiskTools(tools);

      expect(highRiskTools).toContain('Bash(npm:test)');
      expect(highRiskTools).toHaveLength(1);
    });

    it('should enforce risk threshold', () => {
      const validator = new ToolValidator([], ToolRiskLevel.MEDIUM);

      expect(validator.validateTool('Read').valid).toBe(true);
      expect(validator.validateTool('Write').valid).toBe(true);
      expect(validator.validateTool('Bash(npm:test)').valid).toBe(false);
    });
  });

  describe('Tool Normalization', () => {
    it('should normalize tool syntax', () => {
      const validator = new ToolValidator();

      expect(validator.normalizeTool('Read')).toBe('Read');
      expect(validator.normalizeTool('Bash(npm:test)')).toBe('Bash:npm:test');
      expect(validator.normalizeTool('Bash(git:*)')).toBe('Bash:git:*');
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple tools at once', () => {
      const validator = new ToolValidator();

      const tools = ['Read', 'Write', 'Edit', 'Bash(npm:test)'];
      const result = validator.validateTools(tools);

      expect(result.valid).toBe(true);
      expect(result.allowedTools).toHaveLength(4);
      expect(result.deniedTools).toHaveLength(0);
    });

    it('should identify all invalid tools in batch', () => {
      const validator = new ToolValidator();

      const tools = ['Read', 'InvalidTool1', 'Write', 'InvalidTool2'];
      const result = validator.validateTools(tools);

      expect(result.valid).toBe(false);
      expect(result.allowedTools).toHaveLength(2);
      expect(result.deniedTools).toHaveLength(2);
      expect(result.deniedTools).toContain('InvalidTool1');
      expect(result.deniedTools).toContain('InvalidTool2');
    });
  });

  describe('CLI Formatting', () => {
    it('should format tools for Claude CLI', () => {
      const validator = new ToolValidator();

      const tools = ['Read', 'Write', 'Bash(npm:test)'];
      const formatted = validator.formatToolsForCLI(tools);

      expect(formatted).toBe('Read,Write,Bash:npm:test');
    });

    it('should throw error if invalid tools', () => {
      const validator = new ToolValidator();

      const tools = ['Read', 'InvalidTool'];
      expect(() => validator.formatToolsForCLI(tools)).toThrow();
    });
  });

  describe('Validation Report', () => {
    it('should generate detailed validation report', () => {
      const validator = new ToolValidator();

      const tools = ['Read', 'Write', 'Bash(npm:test)', 'InvalidTool'];
      const report = validator.getValidationReport(tools);

      expect(report).toContain('Total Tools Requested: 4');
      expect(report).toContain('Allowed: 3');
      expect(report).toContain('Denied: 1');
      expect(report).toContain('Read (low)');
      expect(report).toContain('Write (medium)');
      expect(report).toContain('High-Risk Tools Allowed');
      expect(report).toContain('InvalidTool');
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entry', () => {
      const validator = new ToolValidator();

      const tools = ['Read', 'Write', 'Bash(npm:test)'];
      const auditLog = validator.createAuditLog(
        tools,
        'wf_123',
        'test-agent'
      );

      expect(auditLog.workflowId).toBe('wf_123');
      expect(auditLog.agentName).toBe('test-agent');
      expect(auditLog.requestedTools).toEqual(tools);
      expect(auditLog.allowedTools).toHaveLength(3);
      expect(auditLog.deniedTools).toHaveLength(0);
      expect(auditLog.timestamp).toBeInstanceOf(Date);
    });
  });
});

describe('Tool Configuration Validation', () => {
  it('should validate valid tool configuration', () => {
    const tools = ['Read', 'Write', 'Edit'];
    const result = validateToolConfiguration(tools);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalizedTools).toEqual(['Read', 'Write', 'Edit']);
  });

  it('should reject invalid tool configuration', () => {
    const tools = ['Read', 'InvalidTool', 'FakeTool'];
    const result = validateToolConfiguration(tools);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should use defaults when no tools specified', () => {
    const result = validateToolConfiguration(undefined);

    expect(result.valid).toBe(true);
    expect(result.normalizedTools.length).toBeGreaterThan(0);
    expect(result.normalizedTools).toContain('Read');
  });
});

describe('Default Tool Sets', () => {
  it('should provide default safe tools', () => {
    const safeTools = getDefaultSafeTools();

    expect(safeTools).toContain('Read');
    expect(safeTools).toContain('Write');
    expect(safeTools).toContain('Edit');
    expect(safeTools).not.toContain('Bash');
  });

  it('should provide safe bash tools', () => {
    const safeBashTools = getSafeBashTools();

    expect(safeBashTools).toContain('Read');
    expect(safeBashTools).toContain('Write');
    expect(safeBashTools).toContain('Bash(npm:*)');
    expect(safeBashTools).toContain('Bash(git:*)');
  });
});

describe('Security Tests', () => {
  it('should block all dangerous commands', () => {
    const validator = new ToolValidator();

    const dangerousCommands = [
      'Bash(sudo)',
      'Bash(rm:*)',
      'Bash(chmod)',
      'Bash(chown)',
      'Bash(dd)',
      'Bash(mkfs)',
      'Bash(ssh)',
      'Bash(scp)',
      'Bash(kill)',
      'Bash(reboot)',
      'Bash(shutdown)',
    ];

    dangerousCommands.forEach(cmd => {
      const result = validator.validateTool(cmd);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous');
    });
  });

  it('should allow safe bash sub-tools', () => {
    const validator = new ToolValidator();

    const safeCommands = [
      'Bash(npm:test)',
      'Bash(git:status)',
      'Bash(python:run)',
      'Bash(node:index.js)',
      'Bash(yarn:install)',
      'Bash(pnpm:build)',
    ];

    safeCommands.forEach(cmd => {
      const result = validator.validateTool(cmd);
      expect(result.valid).toBe(true);
    });
  });

  it('should prevent privilege escalation attempts', () => {
    const validator = new ToolValidator();

    const escalationAttempts = [
      'Bash(sudo:apt-get)',
      'Bash(sudo)',
      'Bash(su)',
      'Bash(chmod:777)',
      'Bash(chown:root)',
    ];

    escalationAttempts.forEach(cmd => {
      const result = validator.validateTool(cmd);
      expect(result.valid).toBe(false);
    });
  });

  it('should prevent file system destruction', () => {
    const validator = new ToolValidator();

    const destructiveCommands = [
      'Bash(rm:-rf)',
      'Bash(rm:*)',
      'Bash(dd)',
      'Bash(mkfs)',
      'Bash(fdisk)',
    ];

    destructiveCommands.forEach(cmd => {
      const result = validator.validateTool(cmd);
      expect(result.valid).toBe(false);
    });
  });

  it('should prevent network intrusion attempts', () => {
    const validator = new ToolValidator();

    const networkCommands = [
      'Bash(ssh)',
      'Bash(scp)',
      'Bash(sftp)',
      'Bash(telnet)',
      'Bash(nc)',
      'Bash(netcat)',
    ];

    networkCommands.forEach(cmd => {
      const result = validator.validateTool(cmd);
      expect(result.valid).toBe(false);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty tool list', () => {
    const validator = new ToolValidator();

    const result = validator.validateTools([]);
    expect(result.valid).toBe(true);
    expect(result.allowedTools).toHaveLength(0);
  });

  it('should handle whitespace in tool names', () => {
    const validator = new ToolValidator();

    const result = validator.validateTool('  Read  ');
    expect(result.valid).toBe(true);
    expect(result.tool).toBe('Read');
  });

  it('should handle case-sensitive tool names', () => {
    const validator = new ToolValidator();

    expect(validator.validateTool('Read').valid).toBe(true);
    expect(validator.validateTool('read').valid).toBe(false);
    expect(validator.validateTool('READ').valid).toBe(false);
  });

  it('should handle duplicate tools', () => {
    const validator = new ToolValidator();

    const tools = ['Read', 'Read', 'Write', 'Write'];
    const result = validator.validateTools(tools);

    expect(result.valid).toBe(true);
    expect(result.allowedTools).toHaveLength(4); // Duplicates preserved
  });
});
