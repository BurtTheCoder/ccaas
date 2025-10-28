# MCP Integration Quick Start Guide

Get started with MCP (Model Context Protocol) servers in Claude Code Service in 5 minutes.

## What is MCP?

MCP enables Claude AI agents to use external tools and services like GitHub, Linear, web search, databases, and more. Think of it as "API access for AI agents."

## Quick Setup

### 1. Configure Credentials

Copy the example environment file:

```bash
cp .env.example .env
```

Add your API credentials to `.env`:

```bash
# Minimum setup for GitHub MCP
GITHUB_TOKEN=ghp_your_token_here

# Optional: Add more services
LINEAR_API_KEY=lin_api_your_key
BRAVE_API_KEY=BSA_your_key
```

Get tokens:
- **GitHub**: https://github.com/settings/tokens (scopes: `repo`, `read:org`)
- **Linear**: https://linear.app/settings/api
- **Brave Search**: https://brave.com/search/api/

### 2. Create a Workflow with MCP

Create `.claude/workflow.yaml` in your project:

```yaml
name: My First MCP Workflow
description: Use GitHub MCP to analyze repositories
version: 1.0.0

agents:
  - name: github_agent
    role: GitHub Analyzer
    container:
      image: claude-code:latest
      mcpServers:
        - github  # Just add the server name!
      resources:
        memory: 2Gi
        timeout: 300s
    prompt: |
      List my GitHub repositories and summarize the most active ones.

workflow:
  trigger:
    type: manual
```

### 3. Run the Workflow

```bash
# Start the service
pnpm dev

# Execute workflow via API or UI
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{"projectId": 1, "userId": 1}'
```

That's it! Your agent can now access GitHub via MCP.

## Available MCP Servers

Add any of these to your `mcpServers` list:

| Server | Name | Required Env | Use Case |
|--------|------|--------------|----------|
| GitHub | `github` | `GITHUB_TOKEN` | Repos, issues, PRs |
| Linear | `linear` | `LINEAR_API_KEY` | Issue tracking |
| Web Search | `web_search` | `BRAVE_API_KEY` | Internet search |
| Slack | `slack` | `SLACK_BOT_TOKEN` | Messaging |
| Filesystem | `filesystem` | None | File operations |
| PostgreSQL | `postgres` | `POSTGRES_CONNECTION_STRING` | Database access |
| Google Drive | `google_drive` | `GOOGLE_DRIVE_CREDENTIALS` | Drive files |
| Puppeteer | `puppeteer` | None | Web automation |

## Common Patterns

### Pattern 1: GitHub Issue Analysis

```yaml
mcpServers:
  - github
prompt: |
  Analyze open issues in my repository and categorize them by type.
```

### Pattern 2: Research with Web Search

```yaml
mcpServers:
  - web_search
prompt: |
  Research the latest best practices for React performance optimization.
```

### Pattern 3: Multi-Service Integration

```yaml
mcpServers:
  - github
  - linear
  - slack
prompt: |
  1. Find GitHub bugs
  2. Create Linear issues
  3. Notify team on Slack
```

### Pattern 4: Database Operations

```yaml
mcpServers:
  - postgres
prompt: |
  Query the users table and generate a summary report.
```

## Configuration Options

### Simple (Recommended)

Just use the server name:

```yaml
mcpServers:
  - github
  - linear
```

### Advanced (Custom Servers)

Full configuration:

```yaml
mcpServers:
  - name: github
  - name: custom_mcp
    command: node
    args: ["/path/to/server.js"]
    env:
      API_KEY: ${MY_API_KEY}
    protocol: stdio
    enabled: true
```

## Troubleshooting

### MCP Server Not Working?

**Check credentials:**
```bash
# Verify env vars are set
echo $GITHUB_TOKEN

# Check logs
docker logs <container-id>
```

**Check MCP config in container:**
```bash
docker exec <container-id> cat /root/.config/claude/mcp.json
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Unknown MCP server" | Check server name spelling |
| "Requires environment variables" | Add credentials to `.env` |
| "Failed to configure MCP" | Check Docker permissions |
| Agent can't use MCP | Verify Claude Code version supports MCP |

## Examples

### Example 1: Daily Standup Generator

```yaml
name: Daily Standup
agents:
  - name: standup_generator
    container:
      mcpServers: [github, linear]
    prompt: |
      Generate daily standup report:
      - My GitHub PRs from yesterday
      - My Linear issues in progress
      - Blockers and next steps
```

### Example 2: Code Review Bot

```yaml
name: Auto Code Review
agents:
  - name: reviewer
    container:
      mcpServers: [github]
    prompt: |
      Review latest PR:
      - Check for bugs
      - Verify tests
      - Comment on PR
```

### Example 3: Documentation Generator

```yaml
name: Auto Documentation
agents:
  - name: doc_generator
    container:
      mcpServers: [github, web_search, filesystem]
    prompt: |
      - Read codebase from GitHub
      - Research best practices
      - Generate documentation
      - Save to filesystem
```

## Next Steps

1. ✅ Set up credentials in `.env`
2. ✅ Create workflow with MCP server
3. ✅ Run workflow and verify logs
4. 📚 Read full documentation: [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)
5. 🧪 Try test workflows: [examples/mcp-workflow.yaml](./examples/mcp-workflow.yaml)
6. 🛠️ Follow testing guide: [examples/test-mcp-setup.md](./examples/test-mcp-setup.md)

## Resources

- [Full MCP Documentation](./MCP_INTEGRATION.md)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Community MCP Servers](https://github.com/modelcontextprotocol/servers)
- [Example Workflows](./examples/)

## Need Help?

- Check logs: Look for `[MCP]` and `[Docker]` messages
- Verify config: `docker exec <container> cat /root/.config/claude/mcp.json`
- Test credentials: Try API calls manually first
- Review examples: See working workflows in `examples/`

## Pro Tips

💡 **Start simple**: Use one MCP server first, then add more

💡 **Test credentials**: Verify API keys work before adding to workflow

💡 **Check logs**: MCP configuration is logged during workflow execution

💡 **Graceful degradation**: Workflows continue even if MCP servers fail

💡 **Reuse configs**: Same MCP server works across all agents

---

**Happy automating!** 🚀
