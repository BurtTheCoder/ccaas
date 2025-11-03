import { z } from "zod";
import { getSlackClient, SlackBlock } from "./slackClient";
import * as formatter from "./slackFormatter";
import { linearClient } from "./linearClient";
import * as linearFormatter from "./linearFormatter";

// Define the schema for a single action
export const actionSchema = z.object({
  action: z.string(),
  // Allow any other properties, as actions have different parameters
}).passthrough();

export type Action = z.infer<typeof actionSchema>;

export class ActionService {
  private slackClient = getSlackClient();

  constructor() {}

  async executeActions(actions: Action[], context: Record<string, any>): Promise<void> {
    for (const action of actions) {
      // Interpolate variables in the action parameters
      const hydratedAction = this.hydrateAction(action, context);
      await this.executeAction(hydratedAction);
    }
  }

  private async executeAction(action: Action): Promise<void> {
    console.log(`[ActionService] Executing action: ${action.action}`, action);

    switch (action.action) {
      case "merge_branch":
        await this.mergeBranch(action);
        break;
      case "update_linear_issue":
      case "linear.updateIssue":
        await this.updateLinearIssue(action);
        break;
      case "create_linear_issue":
      case "linear.createIssue":
        await this.createLinearIssue(action);
        break;
      case "linear.addComment":
      case "add_linear_comment":
        await this.addLinearComment(action);
        break;
      case "notify":
        await this.notify(action);
        break;
      case "delete_branch":
        await this.deleteBranch(action);
        break;
      // Add other action handlers here
      default:
        console.warn(`[ActionService] Unknown action type: ${action.action}`);
    }
  }

  private hydrateAction(action: Action, context: Record<string, any>): Action {
    const hydrated: Record<string, any> = { action: action.action };
    for (const key in action) {
      if (key !== 'action' && typeof action[key] === 'string') {
        hydrated[key] = this.interpolate(action[key], context);
      } else {
        hydrated[key] = action[key];
      }
    }
    return hydrated as Action;
  }

  private interpolate(template: string, context: Record<string, any>): string {
    return template.replace(/\$\{([^}]+)\}/g, (_match, key) => {
      const keys = key.split('.');
      let value: any = context;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return ''; // Return empty string if path not found
        }
      }
      return String(value);
    });
  }

  // --- Action Implementations (Stubs for now) ---

  private async mergeBranch(action: Action): Promise<void> {
    const { branch, method = 'merge', delete_after = false } = action;
    console.log(`[ActionService] STUB: Would execute git merge command for branch: ${branch}`);
    console.log(`[ActionService] STUB: git checkout main && git merge ${branch} --squash=${method === 'squash'}`);
    if (delete_after) {
      console.log(`[ActionService] STUB: git branch -d ${branch}`);
    }
  }

  private async updateLinearIssue(action: Action): Promise<void> {
    const { issue_id, issueId, status, stateId, comment, body, labels, priority, assigneeId, projectId } = action;

    // Support both issue_id and issueId parameter names
    const targetIssueId = (issueId || issue_id) as string | undefined;

    if (!targetIssueId) {
      console.warn('[ActionService] update_linear_issue requires issue_id or issueId parameter');
      return;
    }

    if (!linearClient.isConfigured()) {
      console.log(`[ActionService] Linear not configured - would update issue ${targetIssueId}`);
      return;
    }

    try {
      // Build updates object
      const updates: any = {};

      if (stateId) {
        updates.stateId = stateId;
      } else if (status) {
        // Legacy support: if 'status' is provided instead of 'stateId'
        updates.stateId = status;
      }

      if (priority !== undefined) {
        updates.priority = priority;
      }

      if (assigneeId !== undefined) {
        updates.assigneeId = assigneeId;
      }

      if (projectId !== undefined) {
        updates.projectId = projectId;
      }

      // Update the issue
      if (Object.keys(updates).length > 0) {
        console.log(`[ActionService] Updating Linear issue ${targetIssueId}:`, updates);
        const issue = await linearClient.updateIssue(targetIssueId, updates);

        if (issue) {
          console.log(`[ActionService] Successfully updated issue: ${issue.identifier}`);
        } else {
          console.warn(`[ActionService] Failed to update issue ${targetIssueId}`);
        }
      }

      // Add comment if provided
      const commentBody = (body || comment) as string | undefined;
      if (commentBody) {
        console.log(`[ActionService] Adding comment to Linear issue ${targetIssueId}`);
        const commentResult = await linearClient.addComment(targetIssueId, commentBody);

        if (commentResult) {
          console.log(`[ActionService] Successfully added comment: ${commentResult.id}`);
        } else {
          console.warn(`[ActionService] Failed to add comment to issue ${targetIssueId}`);
        }
      }

    } catch (error) {
      console.error(`[ActionService] Error updating Linear issue ${targetIssueId}:`, error);
      // Don't throw - log error but continue workflow
    }
  }

  private async notify(action: Action): Promise<void> {
    const { channel, message, text, blocks, thread_ts, user_id, type } = action;

    // Determine message content - support both 'message' and 'text' fields
    const messageText = (text || message) as string | undefined;

    if (!messageText) {
      console.warn("[ActionService] Notify action missing message/text field", action);
      return;
    }

    // Check if Slack is configured
    if (!this.slackClient.isConfigured()) {
      console.log(`[ActionService] NOTIFY (Slack not configured) - would send to ${channel || 'default'}: ${messageText}`);
      return;
    }

    try {
      // Parse blocks if provided as a string (JSON)
      let parsedBlocks: SlackBlock[] | undefined;
      if (blocks) {
        if (typeof blocks === 'string') {
          try {
            parsedBlocks = JSON.parse(blocks);
          } catch (error) {
            console.error('[ActionService] Failed to parse blocks JSON:', error);
          }
        } else if (Array.isArray(blocks)) {
          parsedBlocks = blocks;
        }
      }

      // Handle different notification types
      if (type === 'dm' || user_id) {
        // Send direct message
        const userId = (user_id || channel) as string;
        console.log(`[ActionService] Sending DM to user ${userId}: ${messageText}`);
        const response = await this.slackClient.sendDirectMessage(userId, messageText, parsedBlocks);

        if (!response.ok) {
          console.error(`[ActionService] Failed to send DM: ${response.error}`);
        }
      } else if (thread_ts && channel) {
        // Send thread reply
        console.log(`[ActionService] Sending thread reply to #${channel}: ${messageText}`);
        const response = await this.slackClient.postThreadReply(
          channel as string,
          thread_ts as string,
          messageText,
          parsedBlocks
        );

        if (!response.ok) {
          console.error(`[ActionService] Failed to send thread reply: ${response.error}`);
        }
      } else if (channel) {
        // Send channel message
        console.log(`[ActionService] Sending message to #${channel}: ${messageText}`);
        const response = await this.slackClient.sendMessage(
          channel as string,
          messageText,
          parsedBlocks
        );

        if (!response.ok) {
          console.error(`[ActionService] Failed to send message: ${response.error}`);
        }
      } else {
        // Send to default channel
        console.log(`[ActionService] Sending message to default channel: ${messageText}`);
        const response = await this.slackClient.sendDefaultNotification(messageText);

        if (!response.ok) {
          console.error(`[ActionService] Failed to send default notification: ${response.error}`);
        }
      }
    } catch (error) {
      // Don't fail the workflow if Slack notification fails
      console.error('[ActionService] Error sending Slack notification:', error);
    }
  }

  private async createLinearIssue(action: Action): Promise<void> {
    const { teamId, title, description, priority, assigneeId, projectId, labels, stateId } = action;

    if (!teamId || !title) {
      console.warn('[ActionService] create_linear_issue requires teamId and title parameters');
      return;
    }

    if (!linearClient.isConfigured()) {
      console.log(`[ActionService] Linear not configured - would create issue: ${title}`);
      return;
    }

    try {
      console.log(`[ActionService] Creating Linear issue in team ${teamId}: ${title}`);

      const issue = await linearClient.createIssue({
        teamId: teamId as string,
        title: title as string,
        description: description as string | undefined,
        priority: priority as number | undefined,
        assigneeId: assigneeId as string | undefined,
        projectId: projectId as string | undefined,
        labels: labels as string[] | undefined,
        stateId: stateId as string | undefined,
      });

      if (issue) {
        console.log(`[ActionService] Successfully created issue: ${issue.identifier} (${issue.url})`);
      } else {
        console.warn(`[ActionService] Failed to create Linear issue`);
      }
    } catch (error) {
      console.error(`[ActionService] Error creating Linear issue:`, error);
      // Don't throw - log error but continue workflow
    }
  }

  private async addLinearComment(action: Action): Promise<void> {
    const { issueId, issue_id, body, comment } = action;

    // Support both parameter names
    const targetIssueId = (issueId || issue_id) as string | undefined;
    const commentBody = (body || comment) as string | undefined;

    if (!targetIssueId || !commentBody) {
      console.warn('[ActionService] add_linear_comment requires issueId and body parameters');
      return;
    }

    if (!linearClient.isConfigured()) {
      console.log(`[ActionService] Linear not configured - would add comment to ${targetIssueId}`);
      return;
    }

    try {
      console.log(`[ActionService] Adding comment to Linear issue ${targetIssueId}`);

      const commentResult = await linearClient.addComment(targetIssueId, commentBody);

      if (commentResult) {
        console.log(`[ActionService] Successfully added comment: ${commentResult.id}`);
      } else {
        console.warn(`[ActionService] Failed to add comment to issue ${targetIssueId}`);
      }
    } catch (error) {
      console.error(`[ActionService] Error adding Linear comment:`, error);
      // Don't throw - log error but continue workflow
    }
  }

  private async deleteBranch(action: Action): Promise<void> {
    const { branch } = action;
    console.log(`[ActionService] STUB: Would execute git command to delete branch: ${branch}`);
    console.log(`[ActionService] STUB: git push origin --delete ${branch}`);
  }
}
