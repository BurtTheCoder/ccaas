# Testing MCP Server Integration

This guide helps you test the MCP server integration in Claude Code Service.

## Prerequisites

1. Docker installed and running
2. Claude Code Docker image built
3. Environment variables configured

## Setup Environment Variables

Create or update `.env` file in the project root:

```bash
# Copy example environment file
cp .env.example .env

# Add MCP server credentials
cat >> .env << 'EOF'

# MCP Server Credentials
GITHUB_TOKEN=ghp_your_github_token_here
LINEAR_API_KEY=lin_api_your_linear_key_here
BRAVE_API_KEY=BSA_your_brave_search_key_here
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
GOOGLE_DRIVE_CREDENTIALS='{"type":"service_account",...}'
POSTGRES_CONNECTION_STRING=postgresql://user:pass@localhost:5432/db
EOF
```

## Getting API Keys

### GitHub Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:org`, `read:user`
4. Copy token and add to `.env`

### Linear API Key
1. Go to https://linear.app/settings/api
2. Create new Personal API key
3. Copy key and add to `.env`

### Brave Search API Key
1. Go to https://brave.com/search/api/
2. Sign up for API access
3. Copy API key and add to `.env`

### Slack Bot Token
1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. Add bot token scopes: `chat:write`, `channels:read`, `channels:history`
4. Install app to workspace
5. Copy Bot User OAuth Token and add to `.env`

## Test 1: Verify MCP Manager Initialization

```bash
# Start the development server
pnpm dev

# Check logs for MCP manager initialization
# Should see:
# [MCP] Manager initialized with X built-in servers
```

## Test 2: Test Built-in Server Registry

Create a test script `test-mcp-registry.ts`:

```typescript
import { getMcpManager } from './server/mcpManager';
import { listAvailableMCPServers } from './server/builtInMcpServers';

// Get MCP manager
const manager = getMcpManager();

// List available servers
console.log('Available MCP Servers:');
const servers = listAvailableMCPServers();
servers.forEach(server => {
  console.log(`\n${server.name}: ${server.description}`);
  console.log(`  Required env: ${server.requiredEnv.join(', ')}`);
  console.log(`  Examples: ${server.examples.join(', ')}`);
});

// Test server resolution
const environment = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  LINEAR_API_KEY: process.env.LINEAR_API_KEY || '',
};

const githubServer = manager.resolveMCPServerConfig('github', environment);
console.log('\nGitHub Server Config:', githubServer);

const linearServer = manager.resolveMCPServerConfig('linear', environment);
console.log('Linear Server Config:', linearServer);
```

Run test:
```bash
npx tsx test-mcp-registry.ts
```

Expected output:
```
Available MCP Servers:

github: GitHub API access for repositories, issues, pull requests, and more
  Required env: GITHUB_TOKEN
  Examples: List repositories, Create issues, Review pull requests, Search code, Manage branches

linear: Linear issue tracking and project management integration
  Required env: LINEAR_API_KEY
  Examples: Create and update issues, Search issues, Manage projects, Track cycles, Assign team members

...

GitHub Server Config: { name: 'github', command: 'npx', args: [...], env: {...} }
Linear Server Config: { name: 'linear', command: 'npx', args: [...], env: {...} }
```

## Test 3: Test MCP Configuration in Container

```bash
# Start a test container
docker run -d --name test-mcp-container claude-code:latest tail -f /dev/null

# Test writing MCP config
node -e "
const { configureMCPServers } = require('./server/docker');

const mcpServers = [
  {
    name: 'github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: 'test_token' }
  }
];

configureMCPServers('test-mcp-container', mcpServers)
  .then(() => console.log('MCP config written successfully'))
  .catch(err => console.error('Error:', err));
"

# Verify config was written
docker exec test-mcp-container cat /root/.config/claude/mcp.json

# Expected output:
# {
#   "mcpServers": {
#     "github": {
#       "command": "npx",
#       "args": ["-y", "@modelcontextprotocol/server-github"],
#       "env": {
#         "GITHUB_TOKEN": "test_token"
#       }
#     }
#   }
# }

# Cleanup
docker rm -f test-mcp-container
```

## Test 4: Create Simple MCP Test Workflow

Create `.claude/workflow.yaml` in a test project:

```yaml
name: MCP Test Workflow
description: Simple test of MCP integration
version: 1.0.0

agents:
  - name: github_test
    role: GitHub Tester
    container:
      image: claude-code:latest
      mcpServers:
        - github
      resources:
        memory: 1Gi
        timeout: 120s
    prompt: |
      Test the GitHub MCP server by listing your repositories.

      Try to:
      1. List your GitHub repositories
      2. Find a specific repository
      3. List issues in that repository

      Report what you found.

workflow:
  trigger:
    type: manual
  max_iterations: 1
```

Execute the workflow:

```bash
# Via API
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "userId": 1
  }'

# Via CLI (if available)
pnpm start:workflow --project=test-mcp-project
```

## Test 5: Verify Workflow Execution Logs

Check the workflow logs for MCP-related messages:

```bash
# Watch logs
tail -f /path/to/logs/workflow.log

# Look for:
# [WorkflowUtils] Configured 1 MCP server(s): github
# [Docker] Configuring 1 MCP server(s) in container claude-code-abc123
# [Docker] MCP configuration written to container claude-code-abc123
# [github_test] Configured MCP servers: github
```

## Test 6: Test Error Handling

### Missing Credentials Test

Remove GITHUB_TOKEN from environment and run workflow:

```bash
unset GITHUB_TOKEN
pnpm start:workflow --project=test-mcp-project
```

Expected behavior:
- Warning logged: `MCP server 'github' requires environment variables: GITHUB_TOKEN`
- Server disabled but workflow continues
- Agent runs without GitHub MCP access

### Invalid Server Name Test

Create workflow with invalid MCP server:

```yaml
mcpServers:
  - invalid_server_name
```

Expected behavior:
- Error logged: `Unknown built-in MCP server: invalid_server_name`
- Server skipped
- Workflow continues with available servers

## Test 7: Integration Test with Real Services

### GitHub Integration Test

```yaml
name: GitHub Integration Test
description: Test GitHub MCP with real repository

agents:
  - name: github_reader
    role: GitHub Reader
    container:
      image: claude-code:latest
      mcpServers:
        - github
      resources:
        memory: 2Gi
        timeout: 180s
    prompt: |
      Using the GitHub MCP server:

      1. List repositories for the authenticated user
      2. Pick the most recent repository
      3. List all issues in that repository
      4. Create a markdown summary with:
         - Repository name and URL
         - Number of open issues
         - Number of closed issues
         - List of open issues with titles

      Save the summary to /workspace/github-summary.md

workflow:
  trigger:
    type: manual
```

Execute and verify:
1. Workflow completes successfully
2. Agent can access GitHub API via MCP
3. Summary file is created with real data
4. No authentication errors

### Linear Integration Test

```yaml
name: Linear Integration Test
description: Test Linear MCP with real workspace

agents:
  - name: linear_reader
    role: Linear Reader
    container:
      image: claude-code:latest
      mcpServers:
        - linear
      resources:
        memory: 2Gi
        timeout: 180s
    prompt: |
      Using the Linear MCP server:

      1. List all teams in the workspace
      2. Find issues assigned to you
      3. Create a summary with:
         - Team names
         - Number of assigned issues
         - Issue titles and status

      Save to /workspace/linear-summary.md

workflow:
  trigger:
    type: manual
```

## Test 8: Multi-Server Test

Test agent with multiple MCP servers:

```yaml
name: Multi-Server Test
description: Test multiple MCP servers simultaneously

agents:
  - name: multi_server_agent
    role: Multi-Server Agent
    container:
      image: claude-code:latest
      mcpServers:
        - github
        - linear
        - web_search
      resources:
        memory: 4Gi
        timeout: 300s
    prompt: |
      Test all available MCP servers:

      1. GitHub: List your repositories
      2. Linear: List your issues
      3. Web Search: Search for "Model Context Protocol"

      Create a report showing results from each service.

workflow:
  trigger:
    type: manual
```

Verify:
1. All three servers configured
2. Agent can use all servers
3. No conflicts between servers
4. Clean shutdown of all servers

## Troubleshooting

### Issue: MCP config not written to container

**Check**:
```bash
docker exec <container-id> ls -la /root/.config/claude/
docker logs <container-id>
```

**Solution**: Ensure container has bash and proper file system permissions

### Issue: Claude Code doesn't see MCP servers

**Check**:
```bash
docker exec <container-id> claude --version
docker exec <container-id> cat /root/.config/claude/mcp.json
```

**Solution**: Verify Claude Code version supports MCP, check config file format

### Issue: Authentication errors with MCP servers

**Check**:
- Verify credentials in `.env` are correct
- Test credentials directly with API
- Check token/key permissions and scopes

**Solution**: Regenerate API keys with correct permissions

### Issue: MCP server process fails to start

**Check**:
```bash
docker exec <container-id> npx -y @modelcontextprotocol/server-github --help
```

**Solution**: Ensure npx and Node.js are available in container

## Success Criteria

✅ MCP servers are parsed from workflow configuration
✅ Built-in servers (github, linear, web_search) are recognized
✅ Custom MCP servers can be configured
✅ Credentials are loaded from environment
✅ MCP configuration is written to container
✅ Claude Code discovers and uses MCP servers
✅ Agents can access MCP server capabilities
✅ Missing credentials are handled gracefully
✅ Error logging provides debugging information
✅ No type errors (pnpm check passes)

## Next Steps

After successful testing:

1. Deploy to staging environment
2. Test with production workloads
3. Monitor MCP server usage and performance
4. Add more built-in MCP servers as needed
5. Implement MCP server connection pooling
6. Add MCP server usage analytics
7. Create MCP server documentation for end users
