import { z } from "zod";
import { getSlackClient, SlackBlock } from "./slackClient";
import * as formatter from "./slackFormatter";

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
        await this.updateLinearIssue(action);
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
    const { issue_id, status, comment, labels, priority } = action;
    console.log(`[ActionService] STUB: Would call Linear API to update issue ${issue_id}`);
    console.log(`[ActionService] STUB: linear.issueUpdate('${issue_id}', { status: '${status}', comment: '${comment}', labels: ${JSON.stringify(labels)}, priority: '${priority}' })`);
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

  private async deleteBranch(action: Action): Promise<void> {
    const { branch } = action;
    console.log(`[ActionService] STUB: Would execute git command to delete branch: ${branch}`);
    console.log(`[ActionService] STUB: git push origin --delete ${branch}`);
  }
}
