# Tool Access Control - Quick Reference

## Available Tools

### Low Risk (Read-Only)
```yaml
tools:
  - Read              # Read files
  - Grep              # Search file contents
  - Glob              # Find files by pattern
  - CreateDirectory   # Create directories
  - WebSearch         # Search the web
  - TodoWrite         # Task management
  - AskUserQuestion   # Ask user for input
```

### Medium Risk (Write Operations)
```yaml
tools:
  - Write          # Write files
  - Edit           # Edit files
  - DeleteFile     # Delete files
  - NotebookEdit   # Edit Jupyter notebooks
  - WebFetch       # Fetch web content
  - BashOutput     # Get bash output
  - KillShell      # Kill background shells
  - Skill          # Execute skills
  - SlashCommand   # Execute slash commands
```

### High Risk (Command Execution)
```yaml
tools:
  - Bash(npm:*)      # All npm commands
  - Bash(npm:test)   # Specific npm command
  - Bash(git:*)      # All git commands
  - Bash(git:status) # Specific git command
  - Bash(python:*)   # All python commands
  - Bash(node:*)     # All node commands
  - Bash(pnpm:*)     # All pnpm commands
  - Bash(yarn:*)     # All yarn commands
```

## Configuration Patterns

### Pattern 1: Safe Code Review
```yaml
container:
  tools:
    - Read
    - Grep
    - Glob
```

### Pattern 2: Documentation Updates
```yaml
container:
  tools:
    - Read
    - Write
    - Edit
    - Grep
```

### Pattern 3: Test Runner
```yaml
container:
  tools:
    - Read
    - Write
    - Bash(npm:test)
    - Bash(npm:install)
    - Bash(git:status)
```

### Pattern 4: Full Build Pipeline
```yaml
container:
  tools:
    - Read
    - Write
    - Edit
    - Bash(npm:*)
    - Bash(git:*)
    - Bash(node:*)
```

### Pattern 5: Multi-Language
```yaml
container:
  tools:
    - Read
    - Bash(npm:*)
    - Bash(python:*)
    - Bash(go:*)
    - Bash(cargo:*)
```

## Wildcard Syntax

### Allow all sub-commands
```yaml
- Bash(npm:*)      # npm test, npm install, npm build, etc.
- Bash(git:*)      # git status, git commit, git push, etc.
```

### Allow specific sub-commands
```yaml
- Bash(npm:test)     # Only npm test
- Bash(git:status)   # Only git status
```

### Mix specific and wildcards
```yaml
- Bash(npm:test)     # Specific: npm test
- Bash(npm:build)    # Specific: npm build
- Bash(git:*)        # Wildcard: all git commands
```

## Blocked Commands

These are ALWAYS blocked for security:
- `sudo` - Privilege escalation
- `rm`, `rm -rf` - File deletion
- `chmod`, `chown` - Permission changes
- `dd`, `mkfs` - Disk operations
- `ssh`, `scp`, `sftp` - Remote access
- `kill`, `killall` - Process termination
- `reboot`, `shutdown` - System control

## Error Messages

### Unknown Tool
```
Unknown tool: 'InvalidTool'. Available tools: Read, Write, Edit, Bash, ...
```

**Fix**: Use a valid tool name from the registry.

### Dangerous Command
```
Tool 'Bash(sudo)' is a dangerous command and is explicitly blocked for security
```

**Fix**: Remove the dangerous command. It cannot be allowed.

### Bash Without Sub-Tools
```
Tool 'Bash' requires sub-tool specification
```

**Fix**: Specify sub-tools: `Bash(npm:test)` instead of just `Bash`.

### Not in Allowed List
```
Tool 'Write' is not in the allowed tools list. Allowed tools: Read, Grep
```

**Fix**: Add `Write` to the tools list or remove its usage.

## CLI Commands

### Validate Configuration
```bash
# Validation happens automatically on workflow load
# Check logs for validation results
```

### Run Type Check
```bash
pnpm check
```

### Run Tests
```bash
pnpm test server/toolValidator.test.ts
```

### Push Database Schema
```bash
pnpm db:push
```

## Database Queries

### View all audit logs
```typescript
import * as db from './server/db';

const logs = await db.getToolAccessAuditByWorkflow('wf_123');
```

### View denied attempts
```typescript
const denied = await db.getDeniedToolAccessAttempts();
```

### View high-risk usage
```typescript
const highRisk = await db.getHighRiskToolUsage();
```

## Validation in Code

### Validate Tools
```typescript
import { validateToolConfiguration } from './server/toolValidator';

const result = validateToolConfiguration(['Read', 'Write']);
if (!result.valid) {
  console.error('Errors:', result.errors);
}
```

### Generate Report
```typescript
import { ToolValidator } from './server/toolValidator';

const validator = new ToolValidator();
const report = validator.getValidationReport(tools);
console.log(report);
```

### Get Risk Levels
```typescript
const validator = new ToolValidator();
const highRisk = validator.getHighRiskTools(['Read', 'Bash(npm:test)']);
// Returns: ['Bash(npm:test)']
```

## Best Practices

1. **Start with minimal tools**
   - Only add tools you actually need
   - Use low-risk tools when possible

2. **Be specific with Bash**
   - Use `Bash(npm:test)` instead of `Bash(npm:*)`
   - Limit wildcards to known-safe commands

3. **Review audit logs**
   - Check for denied attempts
   - Monitor high-risk tool usage

4. **Test configurations**
   - Use example workflows in `/examples`
   - Validate locally before deploying

5. **Handle validation errors**
   - Clear error messages tell you what's wrong
   - Fix configuration and retry

## Default Behavior

If **no tools specified**, these defaults are used:
```yaml
tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - CreateDirectory
  - TodoWrite
  - WebSearch
```

Safe for most read/write operations, no command execution.

## Risk Levels

- **LOW**: Read-only, no system access → Always safe
- **MEDIUM**: Write operations, limited impact → Review carefully
- **HIGH**: Command execution, system access → Audit regularly

## Need Help?

- Full docs: `/Users/orie/dev/ccaas/TOOL_ACCESS_CONTROL.md`
- Examples: `/Users/orie/dev/ccaas/examples/`
- Tests: `/Users/orie/dev/ccaas/server/toolValidator.test.ts`
- Summary: `/Users/orie/dev/ccaas/IMPLEMENTATION_SUMMARY.md`
