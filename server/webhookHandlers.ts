import { Request, Response } from 'express';
import * as executionService from './executionService';
import * as workflowService from './workflowService';
import * as db from './db';
import { ConfigService } from './configService';
import { ActionService } from './actionService';
import { githubClient } from './githubClient';
import { handleLinearWebhook as handleLinearWebhookImpl } from './linearWebhookHandler';

export { handleLinearWebhookImpl as handleLinearWebhook };

/**
 * Handle Slack slash command webhook
 * 
 * Slack sends:
 * - command: /claude
 * - text: "explain the authentication flow"
 * - user_id, user_name, channel_id, etc.
 */
export async function handleSlackCommand(
  req: Request,
  res: Response,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  try {
    const { command, text, user_id, user_name, channel_id, response_url } = req.body;

    console.log(`[Webhook] Slack command: ${command} ${text}`);
    console.log(`[Webhook] User: ${user_name} (${user_id})`);

    // Respond immediately to Slack (within 3 seconds)
    res.json({
      response_type: 'in_channel',
      text: `🔄 Executing: "${text}"...`,
    });

    // Get or create user
    const userId = (req as any).userId || 1; // From API key middleware

    // Parse command options
    const { projectName, prompt, isWorkflow } = parseSlackCommand(text);

    // Get project
    const project = await db.getProjectByName(projectName);
    if (!project) {
      await sendSlackResponse(response_url, {
        text: `❌ Project "${projectName}" not found`,
      });
      return;
    }

    if (isWorkflow) {
      // Execute workflow
      const result = await workflowService.executeWorkflow(
        configService,
        actionService,
        {
          projectId: project.id,
          userId,
          source: 'slack',
          sourceMetadata: { user_id, channel_id, command },
        }
      );

      await sendSlackResponse(response_url, {
        text: `✅ Workflow started: ${result.name}\nWorkflow ID: ${result.workflowId}\nStatus: ${result.status}`,
      });
    } else {
      // Execute single-agent
      const result = await executionService.execute({
        projectId: project.id,
        userId,
        prompt,
        source: 'slack',
        sourceMetadata: { user_id, channel_id, command },
      });

      // Send result back to Slack
      if (result.status === 'completed') {
        await sendSlackResponse(response_url, {
          text: `✅ Execution completed\n\`\`\`\n${result.result?.substring(0, 500)}\n\`\`\``,
        });
      } else {
        await sendSlackResponse(response_url, {
          text: `❌ Execution failed: ${result.error}`,
        });
      }
    }

  } catch (error) {
    console.error('[Webhook] Slack command error:', error);
    
    // Try to send error to Slack
    if (req.body.response_url) {
      await sendSlackResponse(req.body.response_url, {
        text: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

/**
 * Handle GitHub webhook (PR opened, issue created, etc.)
 */
export async function handleGitHubWebhook(
  req: Request,
  res: Response,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  try {
    const event = req.headers['x-github-event'] as string;
    const payload = req.body;

    console.log(`[Webhook] GitHub event: ${event}`);

    // Respond immediately
    res.json({ status: 'received' });

    const userId = (req as any).userId || 1;

    // Handle different event types
    switch (event) {
      case 'pull_request':
        if (payload.action === 'opened' || payload.action === 'synchronize') {
          await handlePullRequest(payload, userId, configService, actionService);
        }
        break;

      case 'issues':
        if (payload.action === 'opened' || payload.action === 'labeled') {
          await handleIssue(payload, userId, configService, actionService);
        }
        break;

      case 'push':
        await handlePush(payload, userId, configService, actionService);
        break;

      default:
        console.log(`[Webhook] Unhandled GitHub event: ${event}`);
    }

  } catch (error) {
    console.error('[Webhook] GitHub webhook error:', error);
  }
}

/**
 * Handle GitHub pull request
 */
async function handlePullRequest(
  payload: any,
  userId: number,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  const pr = payload.pull_request;
  const repo = payload.repository;

  console.log(`[Webhook] PR #${pr.number}: ${pr.title}`);

  // Find project by repo name
  const project = await db.getProjectByName(repo.name);
  if (!project) {
    console.log(`[Webhook] No project found for repo: ${repo.name}`);
    return;
  }

  // Execute code review
  const prompt = `Review pull request #${pr.number}: ${pr.title}\n\nDescription:\n${pr.body}\n\nFiles changed: ${pr.changed_files}\nAdditions: ${pr.additions}\nDeletions: ${pr.deletions}`;

  const result = await executionService.execute({
    projectId: project.id,
    userId,
    prompt,
    source: 'github',
    sourceMetadata: {
      event: 'pull_request',
      pr_number: pr.number,
      repo: repo.full_name,
    },
  });

  console.log(`[Webhook] PR review completed: ${result.status}`);

  // Post review results as GitHub comment
  await postPRReviewComment(repo.full_name, pr.number, result);
}

/**
 * Handle GitHub issue
 */
async function handleIssue(
  payload: any,
  userId: number,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  const issue = payload.issue;
  const repo = payload.repository;

  console.log(`[Webhook] Issue #${issue.number}: ${issue.title}`);

  // Check if issue has automation label
  const hasAutomationLabel = issue.labels.some((label: any) => 
    label.name === 'safe-for-automation' || label.name === 'automation'
  );

  if (!hasAutomationLabel) {
    console.log(`[Webhook] Issue #${issue.number} doesn't have automation label`);
    return;
  }

  // Find project by repo name
  const project = await db.getProjectByName(repo.name);
  if (!project) {
    console.log(`[Webhook] No project found for repo: ${repo.name}`);
    return;
  }

  // Execute workflow for issue resolution
  await workflowService.executeWorkflow(
    configService,
    actionService,
    {
      projectId: project.id,
      userId,
      source: 'github',
      sourceMetadata: {
        event: 'issues',
        issue_number: issue.number,
        repo: repo.full_name,
      },
      context: {
        ISSUE_NUMBER: issue.number,
        ISSUE_TITLE: issue.title,
        ISSUE_BODY: issue.body,
      },
    }
  );
}

/**
 * Handle GitHub push
 */
async function handlePush(
  payload: any,
  userId: number,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  const repo = payload.repository;
  const commits = payload.commits;

  console.log(`[Webhook] Push to ${repo.full_name}: ${commits.length} commits`);

  // TODO: Implement push handling logic
}

/**
 * Post pull request review results as a GitHub comment
 */
async function postPRReviewComment(
  repoFullName: string,
  prNumber: number,
  executionResult: executionService.ExecutionStatus
): Promise<void> {
  try {
    // Check if GitHub client is configured
    if (!githubClient.isConfigured()) {
      console.warn('[Webhook] GitHub token not configured, skipping comment posting');
      return;
    }

    // Parse repository name
    const repoParts = githubClient.parseRepoFullName(repoFullName);
    if (!repoParts) {
      console.error('[Webhook] Invalid repository name, cannot post comment');
      return;
    }

    const { owner, repo } = repoParts;

    // Format the comment
    const comment = githubClient.formatPRReviewComment(
      {
        status: executionResult.status,
        result: executionResult.result,
        error: executionResult.error,
        duration: executionResult.duration,
        cost: executionResult.cost,
      },
      executionResult.executionId
    );

    // Post the comment
    const commentResult = await githubClient.postPRComment(owner, repo, prNumber, comment);

    if (commentResult) {
      console.log(`[Webhook] Posted review comment: ${commentResult.html_url}`);
    } else {
      console.warn('[Webhook] Failed to post review comment');
    }
  } catch (error) {
    // Don't fail the webhook if comment posting fails
    console.error('[Webhook] Error posting PR review comment:', error);
  }
}

/**
 * Parse Slack command text
 */
function parseSlackCommand(text: string): {
  projectName: string;
  prompt: string;
  isWorkflow: boolean;
} {
  // Check for workflow command
  if (text.startsWith('workflow ')) {
    const parts = text.substring(9).split(' ');
    return {
      projectName: parts[0] || 'default',
      prompt: parts.slice(1).join(' '),
      isWorkflow: true,
    };
  }

  // Check for project specification
  const projectMatch = text.match(/--project=(\S+)/);
  const projectName = projectMatch ? projectMatch[1] : 'default';
  const prompt = text.replace(/--project=\S+/, '').trim();

  return {
    projectName,
    prompt,
    isWorkflow: false,
  };
}

/**
 * Send response to Slack response_url
 */
async function sendSlackResponse(responseUrl: string, message: any): Promise<void> {
  try {
    const response = await fetch(responseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[Webhook] Failed to send Slack response:', response.statusText);
    }
  } catch (error) {
    console.error('[Webhook] Error sending Slack response:', error);
  }
}

/**
 * Generic webhook handler
 */
export async function handleGenericWebhook(
  req: Request,
  res: Response,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  try {
    const { projectId, prompt, workflowName, context } = req.body;
    const userId = (req as any).userId || 1;

    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    if (workflowName) {
      // Execute workflow
      const result = await workflowService.executeWorkflow(
        configService,
        actionService,
        {
          projectId,
          userId,
          workflowName,
          context,
          source: 'webhook',
        }
      );

      res.json(result);
    } else if (prompt) {
      // Execute single-agent
      const result = await executionService.execute({
        projectId,
        userId,
        prompt,
        source: 'webhook',
      });

      res.json(result);
    } else {
      res.status(400).json({ error: 'Either prompt or workflowName is required' });
    }

  } catch (error) {
    console.error('[Webhook] Generic webhook error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

