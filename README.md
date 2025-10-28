# Claude Code Service

A self-hosted platform for triggering Claude Code executions via webhooks with both single-agent and multi-agent workflow capabilities.

## Overview

Claude Code Service allows you to:
- **Execute single-agent tasks** via webhooks from Slack, GitHub, or custom integrations
- **Run multi-agent workflows** with complex orchestration, conditionals, and error handling
- **Monitor executions** through a web dashboard with real-time status updates
- **Track costs** and set budget limits for executions and workflows
- **Manage projects** with custom container and workflow configurations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code Service                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Webhook    │  │   tRPC API   │  │  Dashboard   │      │
│  │   Endpoints  │  │   Endpoints  │  │      UI      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                 │                                  │
│         └─────────┬───────┘                                  │
│                   │                                          │
│         ┌─────────▼─────────┐                               │
│         │  Execution Engine  │                               │
│         │  - Single Agent    │                               │
│         │  - Multi Agent     │                               │
│         └─────────┬─────────┘                               │
│                   │                                          │
│         ┌─────────▼─────────┐                               │
│         │ Docker Container  │                               │
│         │    Management     │                               │
│         └───────────────────┘                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Features

### ✅ Implemented

#### Core Infrastructure
- **Database Schema**: Complete schema for executions, workflows, agents, projects, logs, and budget tracking
- **Execution Service**: Single-agent task execution with Docker container management
- **Workflow Service**: Multi-agent workflow orchestration with state management
- **Docker Management**: Container spawning, lifecycle management, and resource controls
- **Configuration System**: YAML-based project and workflow configuration loaders

#### API & Integrations
- **tRPC API**: Type-safe API endpoints for all operations
- **Webhook Authentication**: API key validation and signature verification
- **Slack Integration**: Slash commands for triggering executions
- **GitHub Integration**: Webhook handlers for PR reviews and issue automation
- **Generic Webhooks**: Custom webhook endpoint for any integration

#### Monitoring Dashboard
- **Dashboard UI**: Overview with stats, recent activity, and quick actions
- **Execution Tracking**: List and detail views for single-agent runs
- **Workflow Monitoring**: Multi-agent workflow status and progress
- **Budget Tracking**: Daily cost tracking and visualization
- **API Key Management**: Create and manage API keys with permissions
- **Notifications**: Unread alerts and system notifications

#### Workflow Engine
- **Agent Orchestration**: Sequential agent execution with state passing
- **Conditional Routing**: If/then/else logic for dynamic workflows
- **Error Handling**: Retry mechanisms and error recovery strategies
- **Budget Controls**: Cost limits and automatic pause on exceed
- **Validation Gates**: Pre-execution validation and approval workflows
- **State Management**: Persistent workflow state and context

#### Enterprise Features (Newly Implemented)
- **Real-time Workflow Streaming**: Server-Sent Events (SSE) for live progress updates
- **Slack Notifications**: Rich Block Kit formatted messages with budget alerts
- **GitHub Integration**: Automatic PR review comments
- **MCP Server Configuration**: 9 built-in community ML model context servers
- **Tool Access Control**: Risk-based tool validation with audit logging

### 🚧 To Be Implemented

- Container image pre-building and caching
- Advanced metrics and analytics dashboard
- Direct Linear integration (webhook and API)
- Email notifications
- Workflow templates library
- Project detail/edit page enhancements

## Getting Started

### Prerequisites

- Node.js 22+
- Docker
- MySQL/TiDB database
- Claude Code Max plan (for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd claude-code-service
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   
   The following environment variables are automatically injected:
   - `DATABASE_URL`: MySQL/TiDB connection string
   - `JWT_SECRET`: Session cookie signing secret
   - `OAUTH_SERVER_URL`: Manus OAuth backend
   - `VITE_APP_TITLE`: Application title
   - `VITE_APP_LOGO`: Logo URL

4. **Push database schema**
   ```bash
   pnpm db:push
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

The application will be available at `http://localhost:3000`.

## Project Configuration

### Container Configuration

Create `.claude/container.yaml` in your project directory:

```yaml
name: my-project
baseImage: claude-base:latest

tools:
  allowed:
    - Read
    - Write
    - Edit
    - Bash
    - Browser

mcpServers:
  - name: github
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
  - name: linear
    env:
      LINEAR_API_KEY: ${LINEAR_API_KEY}

resources:
  memory: 2Gi
  timeout: 600s
  cpu: "2"

security:
  runAsUser: 1000
  readOnlyRoot: false
  noNewPrivileges: true
  dropCapabilities:
    - ALL
  networkMode: bridge
  allowedDomains:
    - github.com
    - api.linear.app
```

### Workflow Configuration

Create `.claude/workflow.yaml` for multi-agent workflows:

```yaml
name: Code Review Workflow
description: Automated code review with multiple specialized agents
version: 1.0.0

agents:
  - name: analyzer
    role: Code Analyzer
    container:
      baseImage: claude-base:latest
      tools: [Read, Edit]
    prompt: |
      Analyze the code changes in ${PR_DIFF}.
      Look for:
      - Potential bugs
      - Security issues
      - Performance problems
    output: analysis_result
    next: reviewer

  - name: reviewer
    role: Code Reviewer
    container:
      baseImage: claude-base:latest
      tools: [Read, Write]
    prompt: |
      Based on the analysis: ${analysis_result}
      
      Write a comprehensive code review with:
      - Summary of findings
      - Specific recommendations
      - Code examples for fixes
    output: review_text
    next: commenter

  - name: commenter
    role: GitHub Commenter
    container:
      baseImage: claude-base:latest
      tools: [Bash]
      mcpServers: [github]
    prompt: |
      Post this review to GitHub PR #${PR_NUMBER}:
      ${review_text}
    onError:
      action: notify
      next: analyzer

workflow:
  trigger:
    type: webhook
    endpoint: /webhook/github

  maxIterations: 5
  maxConsecutiveFailures: 2
  maxRuntime: 1800s

  budget:
    maxCostPerExecution: $5.00
    dailyMaxCost: $50.00
    pauseOnExceed: true
    alertAtPercent: 80

  notifications:
    slack:
      channel: "#code-reviews"
      notifyOn:
        - completed
        - failed
        - budget_exceeded

  safety:
    requireHumanApprovalFor:
      - action: merge_pr
      - action: deploy
    validation:
      requireTests: true
      requirePassingTests: true
      minCoverage: 80
```

## API Usage

### Create a Project

```typescript
const project = await trpc.projects.create.mutate({
  name: "my-project",
  path: "/path/to/project",
  description: "My awesome project",
  containerConfig: {
    baseImage: "claude-base:latest",
    tools: ["Read", "Write", "Edit", "Bash"],
  },
});
```

### Execute Single-Agent Task

```typescript
const execution = await trpc.executions.execute.mutate({
  projectId: project.id,
  prompt: "Explain the authentication flow in this codebase",
  source: "api",
});

// Check status
const status = await trpc.executions.status.query({
  executionId: execution.executionId,
});
```

### Execute Multi-Agent Workflow

```typescript
const workflow = await trpc.workflows.execute.mutate({
  projectId: project.id,
  context: {
    PR_NUMBER: 123,
    PR_DIFF: "...",
  },
  source: "github",
});

// Monitor workflow
const status = await trpc.workflows.status.query({
  workflowId: workflow.workflowId,
});

// Control workflow
await trpc.workflows.pause.mutate({ workflowId: workflow.workflowId });
await trpc.workflows.resume.mutate({ workflowId: workflow.workflowId });
await trpc.workflows.cancel.mutate({ workflowId: workflow.workflowId });
```

## Webhook Integration

### Slack Slash Command

1. **Create an API key**
   ```typescript
   const apiKey = await trpc.apiKeys.create.mutate({
     name: "Slack Integration",
     permissions: ["execute"],
   });
   ```

2. **Configure Slack app**
   - Add slash command: `/claude`
   - Request URL: `https://your-domain.com/webhook/slack`
   - Add header: `Authorization: Bearer ${apiKey.key}`

3. **Use in Slack**
   ```
   /claude --project=my-project explain the authentication flow
   /claude workflow my-project
   ```

### GitHub Webhook

1. **Create an API key**
   ```typescript
   const apiKey = await trpc.apiKeys.create.mutate({
     name: "GitHub Integration",
     permissions: ["execute"],
   });
   ```

2. **Configure GitHub webhook**
   - Payload URL: `https://your-domain.com/webhook/github`
   - Content type: `application/json`
   - Secret: (optional, for signature verification)
   - Events: Pull requests, Issues, Push

3. **Add API key to project**
   Store the API key in your project's environment variables.

### Generic Webhook

```bash
curl -X POST https://your-domain.com/webhook/execute \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "prompt": "Analyze the latest commit",
    "source": "custom"
  }'
```

## Database Schema

### Core Tables

- **users**: User accounts and authentication
- **projects**: Project configurations
- **executions**: Single-agent execution records
- **workflows**: Multi-agent workflow records
- **agentExecutions**: Individual agent runs within workflows
- **logs**: Execution and workflow logs
- **apiKeys**: API key management
- **notifications**: User notifications
- **budgetTracking**: Daily cost tracking

## Docker Container Management

The service manages Docker containers for Claude Code execution:

### Container Lifecycle

1. **Spawn**: Create container with specified configuration
2. **Execute**: Run Claude Code with the prompt
3. **Monitor**: Track logs and status
4. **Cleanup**: Remove container after completion

### Resource Controls

- **Memory limits**: Configure max memory per container
- **CPU limits**: Set CPU allocation
- **Timeouts**: Automatic termination after timeout
- **Network isolation**: Control network access
- **Security**: Run as non-root, drop capabilities

### Example Docker Command

```bash
docker run \
  --name claude-code-abc123 \
  --memory 2Gi \
  --cpus 2 \
  --user 1000 \
  --read-only \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --network bridge \
  -v /project/path:/workspace:ro \
  -e GITHUB_TOKEN=xxx \
  --label claude-code-service=true \
  --rm \
  claude-base:latest
```

## Cost Tracking

The service tracks execution costs and provides budget controls:

- **Per-execution cost**: Based on duration and resources
- **Daily tracking**: Aggregate costs per user per day
- **Budget limits**: Set maximum daily/monthly costs
- **Alerts**: Notifications at configurable thresholds
- **Automatic pause**: Stop executions when budget exceeded

## Security

### Authentication

- Uses Claude Code Max plan for user authentication
- OAuth-based login flow
- Session management with secure cookies

### API Keys

- Bearer token authentication for webhooks
- Granular permissions (execute, read, admin)
- Expiration dates
- Usage tracking

### Webhook Verification

- Slack signature verification (HMAC-SHA256)
- GitHub signature verification (SHA256)
- Timestamp validation to prevent replay attacks

### Container Security

- Non-root user execution
- Read-only root filesystem (optional)
- Capability dropping
- Network isolation
- Domain whitelisting

## Development

### Project Structure

```
claude-code-service/
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   └── lib/           # tRPC client
├── server/                # Backend Node.js app
│   ├── routers.ts         # tRPC routes
│   ├── db.ts              # Database queries
│   ├── executionService.ts
│   ├── workflowService.ts
│   ├── docker.ts          # Docker management
│   ├── config.ts          # Config loaders
│   ├── webhookAuth.ts     # Auth middleware
│   ├── webhookHandlers.ts # Webhook handlers
│   └── webhookRoutes.ts   # Express routes
├── drizzle/               # Database schema
│   └── schema.ts
└── README.md
```

### Available Scripts

- `pnpm dev`: Start development server
- `pnpm build`: Build for production
- `pnpm db:push`: Push database schema changes
- `pnpm db:studio`: Open Drizzle Studio

### Adding a New Integration

1. Create webhook handler in `server/webhookHandlers.ts`
2. Add route in `server/webhookRoutes.ts`
3. Implement signature verification in `server/webhookAuth.ts`
4. Add configuration options to project schema
5. Update documentation

## Troubleshooting

### Database Connection Issues

```bash
# Check DATABASE_URL environment variable
echo $DATABASE_URL

# Test connection
pnpm db:push
```

### Docker Container Errors

```bash
# List running containers
docker ps --filter label=claude-code-service=true

# View container logs
docker logs <container-id>

# Clean up stopped containers
docker container prune --filter label=claude-code-service=true
```

### Webhook Authentication Failures

- Verify API key is valid and not expired
- Check `Authorization` header format: `Bearer <key>`
- Ensure API key has required permissions
- For Slack/GitHub, verify signature secrets match

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [repository-url]/wiki
- Email: support@example.com

