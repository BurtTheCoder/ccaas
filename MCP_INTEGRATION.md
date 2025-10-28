# MCP (Model Context Protocol) Integration

This document describes the MCP server integration in Claude Code Service, enabling agents to access external services like GitHub, Linear, web search, and more.

## Overview

MCP (Model Context Protocol) is a standardized protocol for Claude AI agents to communicate with external tools and services. This integration allows agents in workflows to use MCP servers for enhanced capabilities beyond the basic Claude Code CLI.

## Architecture

### Components

1. **MCP Manager** (`server/mcpManager.ts`)
   - Manages MCP server lifecycle (spawn, connect, shutdown)
   - Handles server initialization and health checks
   - Maintains registry of available MCP servers
   - Validates server configurations

2. **Built-in MCP Servers** (`server/builtInMcpServers.ts`)
   - Registry of community MCP servers
   - Pre-configured server definitions
   - Environment variable requirements
   - Documentation and examples

3. **Docker Integration** (`server/docker.ts`)
   - Configures MCP servers in containers
   - Writes MCP configuration to container filesystem
   - Manages MCP server credentials via environment

4. **Workflow Integration** (`server/workflowService.ts`, `server/workflowUtils.ts`)
   - Parses MCP server configs from workflow YAML
   - Resolves server credentials from environment
   - Passes MCP configuration to Docker containers

## Built-in MCP Servers

### GitHub (`github`)
- **Description**: GitHub API access for repositories, issues, pull requests
- **Package**: `@modelcontextprotocol/server-github`
- **Required Env**: `GITHUB_TOKEN`
- **Capabilities**:
  - List repositories
  - Create and manage issues
  - Review pull requests
  - Search code
  - Manage branches

### Linear (`linear`)
- **Description**: Linear issue tracking and project management
- **Package**: `@modelcontextprotocol/server-linear`
- **Required Env**: `LINEAR_API_KEY`
- **Capabilities**:
  - Create and update issues
  - Search issues
  - Manage projects and cycles
  - Assign team members

### Web Search (`web_search`)
- **Description**: Web search using Brave Search API
- **Package**: `@modelcontextprotocol/server-brave-search`
- **Required Env**: `BRAVE_API_KEY`
- **Capabilities**:
  - Search the web
  - Get search results
  - Find recent news
  - Research topics

### Filesystem (`filesystem`)
- **Description**: File system access with path restrictions
- **Package**: `@modelcontextprotocol/server-filesystem`
- **Required Env**: None (optional: `ALLOWED_PATHS`)
- **Capabilities**:
  - Read and write files
  - List directories
  - Search files
  - File operations

### Slack (`slack`)
- **Description**: Slack messaging and channel management
- **Package**: `@modelcontextprotocol/server-slack`
- **Required Env**: `SLACK_BOT_TOKEN`
- **Capabilities**:
  - Send messages
  - Read channels
  - Post to channels
  - List channels

### Additional Servers
- **Google Drive** (`google_drive`): Google Drive file access
- **PostgreSQL** (`postgres`): Database queries and operations
- **Puppeteer** (`puppeteer`): Web automation and scraping
- **Memory** (`memory`): Persistent key-value storage

## Configuration

### Environment Variables

Add MCP server credentials to your `.env` file:

```bash
# GitHub MCP Server
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Linear MCP Server
LINEAR_API_KEY=lin_api_xxxxxxxxxxxx

# Web Search MCP Server
BRAVE_API_KEY=BSAxxxxxxxxxx

# Slack MCP Server
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx

# Google Drive MCP Server
GOOGLE_DRIVE_CREDENTIALS='{"type":"service_account",...}'

# PostgreSQL MCP Server
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:5432/db
```

### Workflow Configuration

#### Simple Configuration (Built-in Servers)

Use simple string names for built-in MCP servers:

```yaml
agents:
  - name: github_reviewer
    role: Code Reviewer
    container:
      image: claude-code:latest
      mcpServers:
        - github
        - linear
        - web_search
      resources:
        memory: 2Gi
        timeout: 300s
    prompt: |
      Review the pull request and create Linear issues for any problems found.
```

#### Advanced Configuration (Custom Servers)

Use full configuration objects for custom MCP servers:

```yaml
agents:
  - name: custom_agent
    role: Custom Agent
    container:
      image: claude-code:latest
      mcpServers:
        - name: github
        - name: custom_server
          command: node
          args: ["/path/to/custom-mcp-server.js"]
          env:
            CUSTOM_API_KEY: ${CUSTOM_API_KEY}
          protocol: stdio
          enabled: true
      resources:
        memory: 2Gi
    prompt: |
      Use custom MCP server for special operations.
```

#### Alternative Naming

Both `mcpServers` (camelCase) and `mcp_servers` (snake_case) are supported:

```yaml
container:
  image: claude-code:latest
  mcp_servers:  # snake_case also works
    - github
    - linear
```

## Usage Examples

### Example 1: GitHub Code Review Agent

```yaml
name: GitHub Code Review
description: Automated PR review with GitHub MCP integration

agents:
  - name: reviewer
    role: Code Reviewer
    container:
      image: claude-code:latest
      githubRepo: https://github.com/user/repo
      mcpServers:
        - github
      resources:
        memory: 2Gi
        timeout: 300s
    prompt: |
      Review the latest pull request in this repository.

      Tasks:
      1. Analyze code changes for bugs and issues
      2. Check for security vulnerabilities
      3. Verify test coverage
      4. Post review comments on the PR
      5. Approve or request changes
```

### Example 2: Issue Tracking with Linear

```yaml
name: Bug Triage Workflow
description: Triage bugs and create Linear issues

agents:
  - name: bug_analyzer
    role: Bug Analyzer
    container:
      image: claude-code:latest
      mcpServers:
        - github
        - linear
        - web_search
      resources:
        memory: 2Gi
    prompt: |
      Analyze GitHub issues labeled "bug".

      For each bug:
      1. Search web for similar issues and solutions
      2. Determine severity and priority
      3. Create Linear issue with:
         - Detailed description
         - Reproduction steps
         - Suggested fix
         - Priority level
      4. Link Linear issue to GitHub issue
```

### Example 3: Research Agent with Web Search

```yaml
name: Research Assistant
description: Research topics and create reports

agents:
  - name: researcher
    role: Research Assistant
    container:
      image: claude-code:latest
      mcpServers:
        - web_search
        - filesystem
        - slack
      resources:
        memory: 4Gi
        timeout: 600s
    prompt: |
      Research: ${RESEARCH_TOPIC}

      Tasks:
      1. Search web for latest information
      2. Compile findings into markdown report
      3. Save report to /workspace/reports/
      4. Post summary to Slack
```

## How It Works

### 1. Configuration Parsing

When a workflow is loaded, the configuration service parses MCP server definitions:

```typescript
// configService.ts
mcpServers: z.array(z.union([
  z.string(),  // Simple: "github"
  z.object({   // Advanced: full config
    name: z.string(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    protocol: z.enum(['stdio', 'sse', 'socket']).optional(),
    enabled: z.boolean().optional(),
  }),
])).optional()
```

### 2. Server Resolution

The MCP manager resolves configurations, checking for built-in servers and validating credentials:

```typescript
// workflowUtils.ts
const mcpManager = getMcpManager();
const mcpServers = mcpManager.configureMCPServers(
  mcpServerConfigs,
  environment
);
```

### 3. Container Configuration

Before spawning a container, MCP servers are configured:

```typescript
// docker.ts
await configureMCPServers(containerId, config.mcpServers);
```

This writes a configuration file to `/root/.config/claude/mcp.json` in the container:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    }
  }
}
```

### 4. Claude Code Execution

When Claude Code runs in the container, it automatically discovers and connects to MCP servers defined in the configuration file.

## Error Handling

### Missing Credentials

If required environment variables are missing, the server is disabled with a warning:

```
[MCP] MCP server 'github' requires environment variables: GITHUB_TOKEN. Server will be disabled.
```

### Server Startup Failures

If an MCP server fails to start, the workflow continues without it:

```
[WARN] Failed to configure MCP servers: Command failed with code 1
```

### Graceful Degradation

Agents can still function without MCP servers, but won't have access to external services:

```typescript
// MCP servers are optional - continue anyway
if (onLog) {
  onLog(`[WARN] Failed to configure MCP servers: ${error.message}\n`);
}
```

## Testing

### Manual Testing

1. **Test GitHub MCP Server**:
   ```bash
   # Set credentials
   export GITHUB_TOKEN=ghp_your_token

   # Create test workflow with GitHub MCP
   # Run workflow
   # Verify agent can access GitHub API
   ```

2. **Test Linear MCP Server**:
   ```bash
   export LINEAR_API_KEY=lin_api_your_key

   # Create workflow with Linear MCP
   # Verify agent can create Linear issues
   ```

3. **Test Web Search**:
   ```bash
   export BRAVE_API_KEY=BSA_your_key

   # Create workflow with web search
   # Verify agent can search web
   ```

### Verification Steps

1. Check workflow logs for MCP server configuration:
   ```
   [WorkflowUtils] Configured 2 MCP server(s): github, linear
   [Docker] Configuring 2 MCP server(s) in container claude-code-abc123
   [Docker] MCP configuration written to container claude-code-abc123
   [analyzer] Configured MCP servers: github, linear
   ```

2. Verify container has MCP config:
   ```bash
   docker exec <container-id> cat /root/.config/claude/mcp.json
   ```

3. Monitor agent execution for MCP server usage:
   ```
   [analyzer] Using GitHub MCP to fetch PR #123
   [analyzer] Creating Linear issue via MCP
   ```

## Security Considerations

### Credential Management

- Credentials are stored in environment variables
- Never logged or exposed in output
- Passed securely to containers via environment
- Not included in workflow state or database

### MCP Server Sandboxing

- MCP servers run inside Docker containers
- Filesystem MCP has path restrictions
- Network access controlled by Docker
- Container resource limits apply

### API Rate Limiting

- Be aware of API rate limits (GitHub, Linear, etc.)
- MCP servers may implement their own rate limiting
- Consider caching strategies for repeated queries

## Troubleshooting

### Problem: MCP Server Not Found

**Symptom**: `Unknown built-in MCP server: xyz`

**Solution**: Check server name spelling or use custom configuration

### Problem: Missing Credentials

**Symptom**: `MCP server 'github' requires environment variables: GITHUB_TOKEN`

**Solution**: Add credentials to `.env` file and restart service

### Problem: MCP Config Not Written

**Symptom**: `Failed to write MCP config to container`

**Solution**: Check Docker permissions and container filesystem access

### Problem: Claude Code Doesn't See MCP Servers

**Symptom**: Agent can't use MCP capabilities

**Solution**:
1. Verify config file exists: `docker exec <container> cat /root/.config/claude/mcp.json`
2. Check Claude Code version supports MCP
3. Review container logs for MCP initialization

## API Reference

### getMcpManager()

Get the singleton MCP manager instance.

```typescript
import { getMcpManager } from './mcpManager';

const manager = getMcpManager();
```

### configureMCPServers()

Configure MCP servers for a workflow agent.

```typescript
const servers = manager.configureMCPServers(
  ['github', 'linear'],
  { GITHUB_TOKEN: 'xxx', LINEAR_API_KEY: 'yyy' }
);
```

### getBuiltInServers()

Get list of all built-in MCP servers.

```typescript
import { listAvailableMCPServers } from './builtInMcpServers';

const servers = listAvailableMCPServers();
// Returns: [{ name, description, requiredEnv, examples }]
```

## Future Enhancements

- [ ] MCP server connection pooling (reuse across agents)
- [ ] MCP server health monitoring dashboard
- [ ] Custom MCP server marketplace
- [ ] MCP server usage analytics
- [ ] Rate limiting and quota management
- [ ] MCP server caching layer
- [ ] SSE and socket protocol support
- [ ] MCP server version pinning
- [ ] Automatic server updates

## Contributing

To add a new built-in MCP server:

1. Add server definition to `BUILTIN_MCP_SERVERS` in `builtInMcpServers.ts`
2. Add required environment variables to `ENV` in `_core/env.ts`
3. Update `workflowUtils.ts` to include credentials in environment
4. Update this documentation with usage examples
5. Test with sample workflow

## Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP Server Repositories](https://github.com/modelcontextprotocol/servers)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Writing Custom MCP Servers](https://modelcontextprotocol.io/docs/guides/building-servers)
