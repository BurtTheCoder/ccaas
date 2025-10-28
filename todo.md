# Claude Code Service - TODO

## Phase 1: Database Schema & Planning
- [x] Initialize project with web-db-user features
- [x] Create todo.md

## Phase 2: Core Backend Infrastructure
- [x] Design and implement database schema (executions, workflows, agents, projects, configs)
- [x] Create core API endpoints (execute, status, logs)
- [x] Implement webhook validation and authentication
- [x] Add Docker container management utilities
- [x] Create configuration loader for projects

## Phase 3: Workflow Engine & Agent Orchestration
- [x] Build workflow executor engine
- [x] Implement agent orchestration system
- [x] Add state management for workflows
- [x] Implement conditional routing logic
- [x] Add error handling and retry mechanisms
- [x] Create validation gates system
- [x] Implement budget tracking and controls

## Phase 4: Webhook Integrations
- [x] Slack integration (slash commands, notifications)
- [x] GitHub webhook handler (PR reviews, issue comments)
- [x] Linear integration (issue tracking)
- [x] Generic webhook endpoint
- [x] Webhook signature verification
- [x] Integrate webhook routes into Express server

## Phase 5: Monitoring Dashboard & UI
- [x] Create dashboard layout
- [x] Build execution list view (single-agent)
- [x] Build workflow list view (active & completed)
- [ ] Add real-time workflow progress streaming
- [x] Implement cost tracking dashboard
- [ ] Add workflow control UI (pause, resume, cancel)
- [x] Create logs viewer
- [ ] Add metrics and analytics
- [x] Build Executions list page
- [x] Build Execution detail page
- [x] Build Workflows list page
- [x] Build Workflow detail page
- [x] Build Projects list page
- [ ] Build Project detail/edit page
- [x] Build Budget tracking page
- [x] Build API Keys management page
- [x] Build Notifications page

## Phase 6: Configuration System & Docker Management
- [x] Implement project config parser (.claude/container.yaml)
- [x] Implement workflow config parser (.claude/workflow.yaml)
- [x] Create Docker image management
- [x] Add container spawning and lifecycle management
- [x] Implement resource limits and timeouts
- [x] Add MCP server configuration
- [ ] Create pre-built container definitions

## Phase 7: Testing & Polish
- [ ] Test single-agent execution flow
- [ ] Test multi-agent workflow execution
- [ ] Test webhook integrations
- [ ] Test budget controls
- [ ] Add error handling improvements
- [ ] Create example configurations
- [x] Write documentation

## Phase 7.5: Complete Remaining Features
- [x] Implement real Docker container spawning with Claude Code CLI
- [x] Replace mock execution with actual Docker exec calls
- [x] Add real-time workflow progress streaming (polling-based with auto-refresh)
- [x] Build workflow control UI (pause/resume/cancel buttons)
- [x] Build Project detail/edit page
- [x] Create Dockerfile for Claude Code base image
- [x] Test end-to-end execution flow

## Phase 8: Delivery
- [x] Final checkpoint
- [x] Prepare deployment instructions
- [x] Create README with setup guide




## Phase 9: Additional Features
- [x] Add --dangerously-skip-permissions flag to Claude CLI execution
- [x] Add project folder/GitHub repo configuration to execution options
- [x] Support cloning GitHub repos before execution
- [x] Add working directory configuration to container execution




## Bug Fixes
- [x] Fix nested <a> tags in Dashboard.tsx (Link wrapping Card with links)
- [x] Fix budget.today query returning undefined

