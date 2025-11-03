import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ENV } from './_core/env';
import * as db from './db';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailStatus {
  emailId: number;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  sentAt?: Date;
}

/**
 * Email service with support for SMTP (nodemailer)
 * Provides reliable email delivery with queue and retry support
 */
export class EmailService {
  private static instance: EmailService | null = null;
  private transporter: Transporter | null = null;
  private isInitialized: boolean = false;
  private processingQueue: boolean = false;

  private constructor() {
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Initialize email service based on environment configuration
   */
  private initialize(): void {
    // Check if email is configured
    if (!ENV.emailProvider || ENV.emailProvider === 'none') {
      console.warn('[EmailService] Email provider not configured - email notifications disabled');
      return;
    }

    try {
      if (ENV.emailProvider === 'smtp') {
        // SMTP configuration using nodemailer
        if (!ENV.smtpHost || !ENV.smtpPort) {
          console.warn('[EmailService] SMTP configuration incomplete - email notifications disabled');
          return;
        }

        this.transporter = nodemailer.createTransport({
          host: ENV.smtpHost,
          port: ENV.smtpPort,
          secure: ENV.smtpSecure, // true for 465, false for other ports
          auth: ENV.smtpUser && ENV.smtpPassword ? {
            user: ENV.smtpUser,
            pass: ENV.smtpPassword,
          } : undefined,
        });

        this.isInitialized = true;
        console.log('[EmailService] SMTP transport initialized successfully');
      } else {
        console.warn(`[EmailService] Unsupported email provider: ${ENV.emailProvider}`);
      }
    } catch (error) {
      console.error('[EmailService] Failed to initialize:', error);
      this.transporter = null;
      this.isInitialized = false;
    }

    // Start queue processor if initialized
    if (this.isInitialized) {
      this.startQueueProcessor();
    }
  }

  /**
   * Check if email service is configured and ready
   */
  public isConfigured(): boolean {
    return this.isInitialized && this.transporter !== null;
  }

  /**
   * Send an email immediately (bypasses queue)
   * Use this for testing or high-priority emails
   */
  public async sendImmediate(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('[EmailService] Not configured - email not sent:', { to: options.to, subject: options.subject });
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const from = options.from || ENV.emailFromAddress || 'noreply@claude-code-service.local';

      await this.transporter!.sendMail({
        from: `${ENV.emailFromName || 'Claude Code Service'} <${from}>`,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      console.log('[EmailService] Email sent successfully:', {
        to: recipients,
        subject: options.subject,
      });

      return { success: true };
    } catch (error) {
      console.error('[EmailService] Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Queue an email for reliable delivery with retry support
   */
  public async queueEmail(options: EmailOptions): Promise<number> {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const from = options.from || ENV.emailFromAddress || 'noreply@claude-code-service.local';

    // Create email queue record
    const email = await db.createEmailQueue({
      to: recipients,
      from: `${ENV.emailFromName || 'Claude Code Service'} <${from}>`,
      subject: options.subject,
      body: options.html,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: new Date(),
    });

    console.log('[EmailService] Email queued:', {
      emailId: email.id,
      to: recipients,
      subject: options.subject,
    });

    // Trigger immediate processing if not already processing
    if (!this.processingQueue) {
      setImmediate(() => this.processQueue());
    }

    return email.id;
  }

  /**
   * Send multiple emails in bulk
   */
  public async sendBulk(emails: EmailOptions[]): Promise<number[]> {
    const emailIds: number[] = [];

    for (const email of emails) {
      const emailId = await this.queueEmail(email);
      emailIds.push(emailId);
    }

    return emailIds;
  }

  /**
   * Get email delivery status
   */
  public async getStatus(emailId: number): Promise<EmailStatus | null> {
    const email = await db.getEmailQueueById(emailId);
    if (!email) {
      return null;
    }

    return {
      emailId: email.id,
      status: email.status,
      error: email.error || undefined,
      sentAt: email.sentAt || undefined,
    };
  }

  /**
   * Start background queue processor
   */
  private startQueueProcessor(): void {
    // Process queue every 10 seconds
    setInterval(() => {
      this.processQueue().catch(error => {
        console.error('[EmailService] Queue processor error:', error);
      });
    }, 10000);

    console.log('[EmailService] Queue processor started');
  }

  /**
   * Process pending emails in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || !this.isConfigured()) {
      return;
    }

    this.processingQueue = true;

    try {
      // Get pending emails ready for sending
      const pendingEmails = await db.getPendingEmailQueue(50);

      for (const email of pendingEmails) {
        try {
          // Send email
          await this.transporter!.sendMail({
            from: email.from,
            to: email.to,
            subject: email.subject,
            html: email.body,
            text: this.stripHtml(email.body),
          });

          // Mark as sent
          await db.updateEmailQueue(email.id, {
            status: 'sent',
            sentAt: new Date(),
          });

          console.log('[EmailService] Email sent from queue:', {
            emailId: email.id,
            to: email.to,
            subject: email.subject,
          });
        } catch (error) {
          console.error('[EmailService] Failed to send queued email:', {
            emailId: email.id,
            error,
          });

          // Update retry count and schedule next retry
          const retryCount = email.retryCount + 1;
          const maxRetries = 5;

          if (retryCount >= maxRetries) {
            // Max retries reached, mark as failed
            await db.updateEmailQueue(email.id, {
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
              retryCount,
            });
          } else {
            // Schedule retry with exponential backoff
            const backoffMinutes = Math.pow(2, retryCount) * 5; // 5, 10, 20, 40, 80 minutes
            const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

            await db.updateEmailQueue(email.id, {
              retryCount,
              nextRetryAt,
              error: error instanceof Error ? error.message : String(error),
            });

            console.log('[EmailService] Email retry scheduled:', {
              emailId: email.id,
              retryCount,
              nextRetryAt,
            });
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Strip HTML tags from text (simple implementation)
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Verify email service connection
   */
  public async verify(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await this.transporter!.verify();
      console.log('[EmailService] Connection verified successfully');
      return { success: true };
    } catch (error) {
      console.error('[EmailService] Connection verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Get the singleton email service instance
 */
export function getEmailService(): EmailService {
  return EmailService.getInstance();
}
