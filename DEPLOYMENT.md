# Claude Code Service - Deployment Guide

## Prerequisites

- Node.js 18+ and pnpm
- Docker and Docker Compose
- MySQL/TiDB database
- Claude Code Max plan for authentication

## Environment Variables

The following environment variables are required:

### System Variables (Auto-injected by Platform)
- `DATABASE_URL` - MySQL/TiDB connection string
- `JWT_SECRET` - Session cookie signing secret
- `OAUTH_SERVER_URL` - Manus OAuth backend URL
- `VITE_OAUTH_PORTAL_URL` - Manus login portal URL
- `OWNER_OPEN_ID` - Owner's OpenID
- `OWNER_NAME` - Owner's name

### Application-Specific Variables (You Need to Set)
- `SLACK_SIGNING_SECRET` - Slack webhook signature verification
- `GITHUB_WEBHOOK_SECRET` - GitHub webhook signature verification
- `LINEAR_API_KEY` - Linear API access token
- `ANTHROPIC_API_KEY` - Claude API key for executions
- `DOCKER_HOST` - Docker daemon host (default: unix:///var/run/docker.sock)

## Installation Steps

### 1. Clone and Install Dependencies

```bash
cd /path/to/claude-code-service
pnpm install
```

### 2. Database Setup

The database schema is automatically created when you run:

```bash
pnpm db:push
```

This will create all necessary tables:
- users
- projects
- executions
- workflows
- agent_executions
- logs
- api_keys
- notifications
- budget_tracking

### 3. Configure Docker

Ensure Docker is running and accessible:

```bash
docker ps
```

The service will spawn Claude Code containers on demand. Make sure your Docker daemon has sufficient resources.

### 4. Start the Service

**Development:**
```bash
pnpm dev
```

**Production:**
```bash
pnpm build
pnpm start
```

The server will start on port 3000 by default (or the next available port).

## Webhook Configuration

### Slack Integration

1. Create a Slack app at https://api.slack.com/apps
2. Enable slash commands (e.g., `/claude`)
3. Set the request URL to: `https://your-domain.com/api/webhooks/slack`
4. Add your Slack signing secret to environment variables
5. Create an API key in the dashboard and use it in Slack's request headers

### GitHub Integration

1. Go to your repository settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/github`
3. Set content type to `application/json`
4. Add your webhook secret
5. Select events: Pull requests, Issues, Issue comments
6. Create an API key and add it to the webhook headers

### Generic Webhook

For custom integrations:

```bash
curl -X POST https://your-domain.com/api/webhooks/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "prompt": "Review the latest changes and suggest improvements",
    "source": "custom-integration"
  }'
```

## Project Configuration

Each project can have two configuration files:

### Container Configuration (`.claude/container.yaml`)

```yaml
image: anthropic/claude-code:latest
resources:
  memory: 4096
  cpus: 2
  timeout: 1800
environment:
  - NODE_ENV=production
volumes:
  - ./data:/workspace/data
mcpServers:
  - name: github
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
```

### Workflow Configuration (`.claude/workflow.yaml`)

```yaml
name: "PR Review Workflow"
description: "Multi-agent workflow for comprehensive PR reviews"
agents:
  - name: "code-reviewer"
    role: "Review code changes for bugs and improvements"
    prompt: "Review the PR changes in {{context.pr_url}}"
    
  - name: "security-checker"
    role: "Check for security vulnerabilities"
    prompt: "Analyze the code for security issues"
    condition: "{{agents.code-reviewer.status}} == 'completed'"
    
  - name: "documentation-writer"
    role: "Update documentation"
    prompt: "Update docs based on the changes"
    condition: "{{agents.security-checker.status}} == 'completed'"

validation:
  - agent: "security-checker"
    condition: "{{output.vulnerabilities}} == 0"
    onFail: "pause"

budget:
  maxCostCents: 1000
  onExceed: "pause"
```

## API Keys Management

1. Log in to the dashboard
2. Navigate to "API Keys"
3. Create a new key with appropriate permissions:
   - `execute` - Allow triggering executions
   - `read` - Allow reading execution status and logs
   - `admin` - Full access to all operations

4. Copy the key immediately (it won't be shown again)
5. Use it in webhook headers: `Authorization: Bearer YOUR_API_KEY`

## Monitoring

The dashboard provides real-time monitoring:

- **Dashboard** - Overview of executions, workflows, and costs
- **Executions** - List and details of single-agent runs
- **Workflows** - Multi-agent workflow tracking
- **Projects** - Project management and configuration
- **Budget** - Cost tracking and budget controls
- **Notifications** - System alerts and notifications

## Troubleshooting

### Docker Container Issues

Check Docker logs:
```bash
docker logs <container-id>
```

Ensure Docker has sufficient resources and the daemon is running.

### Database Connection Issues

Verify your `DATABASE_URL` is correct:
```bash
echo $DATABASE_URL
```

Test the connection:
```bash
pnpm db:push
```

### Webhook Signature Verification Failures

Ensure your webhook secrets match between the service and the external platform (Slack, GitHub, etc.).

### Budget Exceeded

Check the Budget page in the dashboard. If executions are paused due to budget limits, you can:
1. Increase the budget limit in your workflow configuration
2. Reset the daily budget tracking
3. Review and optimize your prompts to reduce costs

## Security Considerations

1. **API Keys** - Store securely and rotate regularly
2. **Webhook Secrets** - Use strong, unique secrets for each integration
3. **Docker Isolation** - Each execution runs in an isolated container
4. **Database Access** - Restrict database access to the application only
5. **Environment Variables** - Never commit secrets to version control

## Scaling

For high-volume deployments:

1. **Database** - Use a managed database service with read replicas
2. **Docker** - Deploy on a Docker Swarm or Kubernetes cluster
3. **Load Balancing** - Use a load balancer for multiple instances
4. **Caching** - Add Redis for session and execution state caching
5. **Queue** - Implement a job queue (Bull, BullMQ) for async execution

## Support

For issues and questions:
- Check the main README.md
- Review example configurations in `/examples`
- Check application logs for error messages

