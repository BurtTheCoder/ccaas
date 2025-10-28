import { WebClient, ChatPostMessageResponse, ChatUpdateResponse } from '@slack/web-api';
import { ENV } from './_core/env';

/**
 * Slack Block Kit types for rich message formatting
 */
export interface SlackBlock {
  type: string;
  [key: string]: any;
}

export interface MessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
}

/**
 * Singleton Slack client for sending notifications
 */
export class SlackClient {
  private static instance: SlackClient | null = null;
  private client: WebClient | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    // Initialize Slack client if token is available
    if (ENV.slackBotToken) {
      try {
        this.client = new WebClient(ENV.slackBotToken);
        this.isInitialized = true;
        console.log('[SlackClient] Initialized successfully');
      } catch (error) {
        console.error('[SlackClient] Failed to initialize:', error);
        this.client = null;
        this.isInitialized = false;
      }
    } else {
      console.warn('[SlackClient] SLACK_BOT_TOKEN not configured - Slack notifications disabled');
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SlackClient {
    if (!SlackClient.instance) {
      SlackClient.instance = new SlackClient();
    }
    return SlackClient.instance;
  }

  /**
   * Check if Slack client is configured and ready
   */
  public isConfigured(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Send a message to a Slack channel
   * @param channel Channel ID or name (e.g., "#dev-automation" or "C1234567890")
   * @param text Plain text message content (also used as fallback)
   * @param blocks Optional Block Kit blocks for rich formatting
   * @returns Message response with channel and timestamp
   */
  public async sendMessage(
    channel: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<MessageResponse> {
    if (!this.isConfigured()) {
      console.warn('[SlackClient] Not configured - message not sent:', { channel, text });
      return { ok: false, error: 'Slack client not configured' };
    }

    try {
      // Normalize channel name (remove # if present)
      const normalizedChannel = channel.startsWith('#') ? channel.substring(1) : channel;

      const response = await this.client!.chat.postMessage({
        channel: normalizedChannel,
        text,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      }) as ChatPostMessageResponse;

      if (response.ok) {
        console.log('[SlackClient] Message sent successfully:', {
          channel: response.channel,
          ts: response.ts,
        });
        return {
          ok: true,
          channel: response.channel,
          ts: response.ts,
        };
      } else {
        console.error('[SlackClient] Failed to send message:', response.error);
        return {
          ok: false,
          error: response.error || 'Unknown error',
        };
      }
    } catch (error) {
      console.error('[SlackClient] Error sending message:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a direct message to a user
   * @param userId Slack user ID (e.g., "U1234567890")
   * @param text Plain text message content
   * @param blocks Optional Block Kit blocks for rich formatting
   * @returns Message response with channel and timestamp
   */
  public async sendDirectMessage(
    userId: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<MessageResponse> {
    if (!this.isConfigured()) {
      console.warn('[SlackClient] Not configured - DM not sent:', { userId, text });
      return { ok: false, error: 'Slack client not configured' };
    }

    try {
      // Open a DM channel with the user
      const dmResponse = await this.client!.conversations.open({
        users: userId,
      });

      if (!dmResponse.ok || !dmResponse.channel?.id) {
        console.error('[SlackClient] Failed to open DM channel:', dmResponse.error);
        return {
          ok: false,
          error: dmResponse.error || 'Failed to open DM channel',
        };
      }

      // Send message to the DM channel
      return await this.sendMessage(dmResponse.channel.id, text, blocks);
    } catch (error) {
      console.error('[SlackClient] Error sending DM:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Post a reply to a thread
   * @param channel Channel ID
   * @param threadTs Parent message timestamp
   * @param text Plain text message content
   * @param blocks Optional Block Kit blocks for rich formatting
   * @returns Message response with channel and timestamp
   */
  public async postThreadReply(
    channel: string,
    threadTs: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<MessageResponse> {
    if (!this.isConfigured()) {
      console.warn('[SlackClient] Not configured - thread reply not sent:', {
        channel,
        threadTs,
        text,
      });
      return { ok: false, error: 'Slack client not configured' };
    }

    try {
      const normalizedChannel = channel.startsWith('#') ? channel.substring(1) : channel;

      const response = await this.client!.chat.postMessage({
        channel: normalizedChannel,
        thread_ts: threadTs,
        text,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      }) as ChatPostMessageResponse;

      if (response.ok) {
        console.log('[SlackClient] Thread reply sent successfully:', {
          channel: response.channel,
          ts: response.ts,
        });
        return {
          ok: true,
          channel: response.channel,
          ts: response.ts,
        };
      } else {
        console.error('[SlackClient] Failed to send thread reply:', response.error);
        return {
          ok: false,
          error: response.error || 'Unknown error',
        };
      }
    } catch (error) {
      console.error('[SlackClient] Error sending thread reply:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update an existing message
   * @param channel Channel ID
   * @param ts Message timestamp
   * @param text New plain text message content
   * @param blocks Optional new Block Kit blocks
   * @returns Message response
   */
  public async updateMessage(
    channel: string,
    ts: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<MessageResponse> {
    if (!this.isConfigured()) {
      console.warn('[SlackClient] Not configured - message update skipped:', {
        channel,
        ts,
        text,
      });
      return { ok: false, error: 'Slack client not configured' };
    }

    try {
      const normalizedChannel = channel.startsWith('#') ? channel.substring(1) : channel;

      const response = await this.client!.chat.update({
        channel: normalizedChannel,
        ts,
        text,
        blocks,
      }) as ChatUpdateResponse;

      if (response.ok) {
        console.log('[SlackClient] Message updated successfully:', {
          channel: response.channel,
          ts: response.ts,
        });
        return {
          ok: true,
          channel: response.channel,
          ts: response.ts,
        };
      } else {
        console.error('[SlackClient] Failed to update message:', response.error);
        return {
          ok: false,
          error: response.error || 'Unknown error',
        };
      }
    } catch (error) {
      console.error('[SlackClient] Error updating message:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a simple text notification to the default channel
   * @param text Message text
   * @returns Message response
   */
  public async sendDefaultNotification(text: string): Promise<MessageResponse> {
    const defaultChannel = ENV.slackDefaultChannel || 'general';
    return await this.sendMessage(defaultChannel, text);
  }
}

/**
 * Get the singleton Slack client instance
 */
export function getSlackClient(): SlackClient {
  return SlackClient.getInstance();
}
