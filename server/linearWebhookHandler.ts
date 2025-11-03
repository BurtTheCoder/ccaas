import { Request, Response } from 'express';
import * as crypto from 'crypto';
import * as db from './db';
import * as workflowService from './workflowService';
import { ConfigService } from './configService';
import { ActionService } from './actionService';
import { linearClient } from './linearClient';
import { ENV } from './_core/env';

/**
 * Linear webhook event types
 */
export type LinearWebhookEvent =
  | 'Issue'
  | 'Comment'
  | 'Project'
  | 'Cycle'
  | 'IssueLabel';

export type LinearWebhookAction =
  | 'create'
  | 'update'
  | 'remove';

export interface LinearWebhookPayload {
  action: LinearWebhookAction;
  type: LinearWebhookEvent;
  createdAt: string;
  data: any;
  url: string;
  organizationId: string;
  webhookTimestamp: number;
  webhookId: string;
}

/**
 * Verify Linear webhook signature
 *
 * Linear signs webhooks with HMAC-SHA256
 * Signature is in the 'linear-signature' header
 */
function verifyLinearSignature(payload: string, signature: string): boolean {
  if (!ENV.linearWebhookSecret) {
    console.warn('[Linear Webhook] LINEAR_WEBHOOK_SECRET not configured, skipping signature verification');
    return true; // Allow webhooks if no secret is configured (for development)
  }

  try {
    const hmac = crypto.createHmac('sha256', ENV.linearWebhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Linear Webhook] Signature verification error:', error);
    return false;
  }
}

/**
 * Handle Linear webhook events
 */
export async function handleLinearWebhook(
  req: Request,
  res: Response,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  try {
    // Verify webhook signature
    const signature = req.headers['linear-signature'] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (signature && !verifyLinearSignature(rawBody, signature)) {
      console.error('[Linear Webhook] Invalid signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const payload: LinearWebhookPayload = req.body;

    console.log(`[Linear Webhook] Received event: ${payload.type}.${payload.action}`);
    console.log(`[Linear Webhook] Webhook ID: ${payload.webhookId}`);

    // Respond immediately to Linear
    res.json({ status: 'received' });

    const userId = (req as any).userId || 1;

    // Store webhook event in database
    try {
      await db.createLinearWebhookEvent({
        webhookId: payload.webhookId,
        eventType: `${payload.type}.${payload.action}`,
        action: payload.action,
        type: payload.type,
        issueId: payload.data?.id,
        issueIdentifier: payload.data?.identifier,
        organizationId: payload.organizationId,
        payload: payload as any,
        processed: false,
      });
    } catch (dbError) {
      console.error('[Linear Webhook] Failed to store webhook event:', dbError);
    }

    // Route to appropriate handler based on event type
    switch (payload.type) {
      case 'Issue':
        await handleIssueEvent(payload, userId, configService, actionService);
        break;

      case 'Comment':
        await handleCommentEvent(payload, userId, configService, actionService);
        break;

      case 'Project':
        console.log(`[Linear Webhook] Project ${payload.action} event received`);
        break;

      case 'Cycle':
        console.log(`[Linear Webhook] Cycle ${payload.action} event received`);
        break;

      default:
        console.log(`[Linear Webhook] Unhandled event type: ${payload.type}`);
    }

  } catch (error) {
    console.error('[Linear Webhook] Error handling webhook:', error);
    // Don't send error response since we already responded
  }
}

/**
 * Handle Issue events (create, update, remove)
 */
async function handleIssueEvent(
  payload: LinearWebhookPayload,
  userId: number,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  const issue = payload.data;

  console.log(`[Linear Webhook] Issue ${payload.action}: ${issue.identifier} - ${issue.title}`);

  // Handle issue creation
  if (payload.action === 'create') {
    await handleIssueCreated(issue, userId, configService, actionService);
  }

  // Handle issue updates
  if (payload.action === 'update') {
    await handleIssueUpdated(issue, payload, userId, configService, actionService);
  }

  // Mark webhook event as processed
  try {
    await db.updateLinearWebhookEvent(payload.webhookId, { processed: true });
  } catch (error) {
    console.error('[Linear Webhook] Failed to mark event as processed:', error);
  }
}

/**
 * Handle issue created event
 */
async function handleIssueCreated(
  issue: any,
  userId: number,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  console.log(`[Linear Webhook] Processing new issue: ${issue.identifier}`);

  // Check for automation labels
  const hasAutomationLabel = issue.labels?.some((label: any) =>
    label.name === 'safe-for-automation' || label.name === 'automation' || label.name === 'claude-code'
  );

  if (!hasAutomationLabel) {
    console.log(`[Linear Webhook] Issue ${issue.identifier} doesn't have automation label, skipping`);
    return;
  }

  // Find project configuration by team
  const integrationConfig = await db.getLinearIntegrationConfigByTeam(issue.team.id);
  if (!integrationConfig || !integrationConfig.isActive) {
    console.log(`[Linear Webhook] No active integration config found for team ${issue.team.id}`);
    return;
  }

  // Check if this event type is enabled
  const enabledEvents = integrationConfig.eventTypes as string[] || [];
  if (!enabledEvents.includes('Issue.create')) {
    console.log(`[Linear Webhook] Issue.create event not enabled for team ${issue.team.id}`);
    return;
  }

  // Find the associated project
  const project = await db.getProjectById(integrationConfig.projectId);
  if (!project) {
    console.log(`[Linear Webhook] Project ${integrationConfig.projectId} not found`);
    return;
  }

  // Execute workflow with issue context
  try {
    const workflowResult = await workflowService.executeWorkflow(
      configService,
      actionService,
      {
        projectId: project.id,
        userId,
        source: 'linear',
        sourceMetadata: {
          event: 'Issue.create',
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          teamId: issue.team.id,
        },
        context: {
          LINEAR_ISSUE_ID: issue.id,
          LINEAR_ISSUE_IDENTIFIER: issue.identifier,
          LINEAR_ISSUE_TITLE: issue.title,
          LINEAR_ISSUE_DESCRIPTION: issue.description || '',
          LINEAR_ISSUE_URL: issue.url,
          LINEAR_TEAM_ID: issue.team.id,
          LINEAR_TEAM_NAME: issue.team.name,
          LINEAR_PROJECT_ID: issue.project?.id,
        },
      }
    );

    console.log(`[Linear Webhook] Workflow started: ${workflowResult.workflowId}`);

    // Store workflow ID in webhook event
    await db.updateLinearWebhookEvent(issue.id, {
      workflowId: workflowResult.workflowId,
    });

  } catch (error) {
    console.error(`[Linear Webhook] Failed to execute workflow for issue ${issue.identifier}:`, error);
  }
}

/**
 * Handle issue updated event
 */
async function handleIssueUpdated(
  issue: any,
  payload: LinearWebhookPayload,
  userId: number,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  console.log(`[Linear Webhook] Processing issue update: ${issue.identifier}`);

  // Check if status changed to specific state
  const updatedFrom = payload.data?.updatedFrom;
  if (updatedFrom?.state && issue.state) {
    console.log(`[Linear Webhook] Issue state changed: ${updatedFrom.state.name} -> ${issue.state.name}`);

    // Check for automation trigger on state change
    const integrationConfig = await db.getLinearIntegrationConfigByTeam(issue.team.id);
    if (integrationConfig && integrationConfig.isActive) {
      const enabledEvents = integrationConfig.eventTypes as string[] || [];
      if (enabledEvents.includes('Issue.update')) {
        // Could trigger workflows based on specific state transitions
        console.log(`[Linear Webhook] Issue state change could trigger automation`);
      }
    }
  }

  // Check if assignee changed
  if (updatedFrom?.assignee && issue.assignee) {
    console.log(`[Linear Webhook] Issue assigned to: ${issue.assignee.name}`);
  }
}

/**
 * Handle Comment events
 */
async function handleCommentEvent(
  payload: LinearWebhookPayload,
  userId: number,
  configService: ConfigService,
  actionService: ActionService
): Promise<void> {
  const comment = payload.data;

  console.log(`[Linear Webhook] Comment ${payload.action}: ${comment.id}`);

  if (payload.action === 'create') {
    // Check if comment mentions bot or has trigger phrase
    const hasTrigger = comment.body?.includes('@claude-code') || comment.body?.includes('/claude');

    if (hasTrigger) {
      console.log(`[Linear Webhook] Comment has trigger phrase, could initiate automation`);
      // Could trigger workflows based on comment content
    }
  }

  // Mark webhook event as processed
  try {
    await db.updateLinearWebhookEvent(payload.webhookId, { processed: true });
  } catch (error) {
    console.error('[Linear Webhook] Failed to mark event as processed:', error);
  }
}

/**
 * Test webhook connectivity
 */
export async function testLinearWebhook(): Promise<{ success: boolean; message: string }> {
  if (!linearClient.isConfigured()) {
    return {
      success: false,
      message: 'Linear client not configured. Please set LINEAR_API_KEY.',
    };
  }

  try {
    // Test by fetching teams
    const teams = await linearClient.getTeams();

    if (teams.length > 0) {
      return {
        success: true,
        message: `Linear API connection successful. Found ${teams.length} team(s).`,
      };
    } else {
      return {
        success: true,
        message: 'Linear API connection successful, but no teams found.',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
