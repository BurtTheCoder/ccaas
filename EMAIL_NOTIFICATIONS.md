# Email Notifications

This document describes the email notification system for Claude Code Service.

## Overview

The email notification system sends automated email alerts for workflow events, execution results, and budget alerts. It supports SMTP-based email delivery with a reliable queue system and customizable preferences.

## Features

- **Multiple notification types**: Workflow started/completed/failed, execution completed/failed, budget warnings/exceeded
- **HTML email templates**: Professional, responsive email templates with rich formatting
- **Reliable delivery**: Queue-based system with exponential backoff retry logic
- **User preferences**: Configurable per-user and per-project email settings
- **SMTP support**: Works with any SMTP provider (Gmail, SendGrid, Mailgun, AWS SES, etc.)
- **Graceful degradation**: System continues working even if email is not configured

## Architecture

### Components

1. **EmailService** (`server/emailService.ts`): Core service for sending emails
   - Singleton pattern for global access
   - SMTP transport via nodemailer
   - Queue management and retry logic
   - Connection verification

2. **Email Templates** (`server/emailTemplates.ts`): HTML email templates
   - Workflow started/completed/failed
   - Execution completed/failed
   - Budget warning/exceeded
   - Test email

3. **Email Queue** (database table): Persistent queue for reliable delivery
   - Stores pending, sent, and failed emails
   - Tracks retry count and next retry time
   - Exponential backoff: 5, 10, 20, 40, 80 minutes

4. **Email Preferences** (database table): User notification preferences
   - Per-user or per-project settings
   - Enable/disable specific notification types
   - Custom recipient lists

### Database Schema

```sql
-- Email Queue
CREATE TABLE emailQueue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  to TEXT NOT NULL,
  from TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  retryCount INT DEFAULT 0,
  nextRetryAt TIMESTAMP,
  sentAt TIMESTAMP,
  error TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Preferences
CREATE TABLE emailPreferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  projectId INT,
  emailType VARCHAR(64) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  recipients JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Email provider: smtp or none
EMAIL_PROVIDER=smtp

# Sender configuration
EMAIL_FROM_ADDRESS=notifications@your-domain.com
EMAIL_FROM_NAME=Claude Code Service

# SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Common SMTP Providers

#### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Generate at: https://myaccount.google.com/apppasswords
```

#### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-smtp-username
SMTP_PASSWORD=your-mailgun-smtp-password
```

#### AWS SES
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

## Email Types

### Workflow Notifications

1. **workflow_started**: Sent when a workflow begins execution
   - Includes: Workflow name, description, total steps, budget limit
   - Recipients: Configured via user preferences

2. **workflow_completed**: Sent when a workflow completes successfully
   - Includes: Duration, cost, iterations, steps completed, result summary
   - Recipients: Configured via user preferences

3. **workflow_failed**: Sent when a workflow fails
   - Includes: Error details, duration, cost, failed agent, step number
   - Recipients: Configured via user preferences

### Execution Notifications

4. **execution_completed**: Sent when a single-agent execution completes
   - Includes: Execution ID, prompt, duration, cost, result
   - Recipients: Configured via user preferences

5. **execution_failed**: Sent when a single-agent execution fails
   - Includes: Execution ID, prompt, error details, duration, cost
   - Recipients: Configured via user preferences

### Budget Notifications

6. **budget_warning**: Sent at 80% of budget limit (not implemented for email yet)
   - Includes: Current spend, budget limit, percentage used
   - Recipients: All users with budget_warning preference enabled

7. **budget_exceeded**: Sent when budget limit is exceeded
   - Includes: Current spend, budget limit, stopped workflow details
   - Recipients: All users with budget_exceeded preference enabled

## Usage

### Setting Up Email Preferences

Users can configure email preferences via the tRPC API:

```typescript
// List all preferences
const preferences = await trpc.notifications.emailPreferences.list.query();

// Get a specific preference
const pref = await trpc.notifications.emailPreferences.get.query({
  emailType: 'workflow_completed',
  projectId: 1, // Optional
});

// Create or update preference
await trpc.notifications.emailPreferences.upsert.mutate({
  emailType: 'workflow_completed',
  projectId: 1, // Optional
  enabled: true,
  recipients: ['user@example.com', 'team@example.com'], // Optional custom recipients
});

// Delete preference
await trpc.notifications.emailPreferences.delete.mutate({ id: 1 });
```

### Testing Email Configuration

Test your email setup:

```typescript
// Send a test email
const result = await trpc.notifications.test.mutate({
  to: 'your-email@example.com'
});

// Verify SMTP connection
const status = await trpc.notifications.verify.query();
console.log(status); // { success: true } or { success: false, error: '...' }
```

### Monitoring Email Queue

Monitor email delivery status:

```typescript
// List emails by status
const pending = await trpc.notifications.emailQueue.list.query({
  status: 'pending',
  limit: 50
});

const failed = await trpc.notifications.emailQueue.list.query({
  status: 'failed',
  limit: 50
});

// Get status of a specific email
const status = await trpc.notifications.emailQueue.status.query({
  emailId: 123
});
```

## Default Behavior

### When Email is Not Configured

If `EMAIL_PROVIDER=none` or SMTP settings are missing:
- System logs warnings but continues working
- No emails are sent or queued
- All other functionality remains operational

### When User Has No Email Preferences

If a user has not configured preferences for a notification type:
- No emails are sent for that notification type
- System logs this silently
- User can enable notifications at any time

### Default Recipients

If a user enables a notification type but doesn't specify custom recipients:
- System uses the user's email from their account
- If user has no email in their account, no notification is sent

## Queue and Retry Logic

### Queue Processing

- Queue processor runs every 10 seconds
- Processes up to 50 pending emails per run
- Only processes emails where `nextRetryAt <= now`

### Retry Strategy

Emails that fail to send are automatically retried with exponential backoff:

1. First retry: 5 minutes after failure
2. Second retry: 10 minutes after failure
3. Third retry: 20 minutes after failure
4. Fourth retry: 40 minutes after failure
5. Fifth retry: 80 minutes after failure
6. After 5 failed attempts: Marked as permanently failed

### Email Status

Emails can have three statuses:
- **pending**: Waiting to be sent or scheduled for retry
- **sent**: Successfully delivered
- **failed**: Permanently failed after max retries

## Email Templates

### Template Structure

All emails use a consistent HTML structure:
- Responsive design that works on desktop and mobile
- Professional styling with color-coded status badges
- Structured information grids for key metrics
- Code blocks for prompts and error messages
- Footer with service branding

### Template Customization

To customize email templates:

1. Edit `server/emailTemplates.ts`
2. Modify the `wrapTemplate()` function to change overall styling
3. Update individual template functions for specific notification types
4. Test changes with `trpc.notifications.test.mutate()`

### Template Variables

Templates automatically populate these variables:
- Workflow/execution IDs
- Names, descriptions
- Durations (formatted as "Xh Ym" or "Xm Ys")
- Costs (formatted as "$X.XX")
- Errors (escaped and formatted)
- Timestamps

## Security Considerations

### SMTP Credentials

- Store SMTP credentials in environment variables, not in code
- Use app-specific passwords for Gmail (not your main password)
- Rotate credentials regularly
- Use TLS/SSL for SMTP connections

### Email Content

- Email bodies are stored in database (consider encryption for sensitive data)
- Error messages may contain sensitive information
- Prompt text is included in emails (may contain confidential data)

### Recipient Validation

- Email addresses are validated using Zod's email validator
- Multiple recipients are supported (comma-separated in database)
- No automatic BCC or forwarding rules

## Troubleshooting

### Emails Not Sending

1. **Check email service configuration**:
   ```typescript
   const status = await trpc.notifications.verify.query();
   ```

2. **Verify environment variables**:
   - EMAIL_PROVIDER is set to 'smtp'
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD are correct
   - EMAIL_FROM_ADDRESS is valid

3. **Check email queue**:
   ```typescript
   const failed = await trpc.notifications.emailQueue.list.query({ status: 'failed' });
   ```

4. **Review server logs**:
   - Look for "[EmailService]" log messages
   - Check for authentication errors
   - Verify SMTP connection errors

### Gmail-Specific Issues

If using Gmail:
1. Enable 2-factor authentication
2. Generate an app-specific password at https://myaccount.google.com/apppasswords
3. Use app password instead of your main password
4. Check Gmail's "Less secure app access" settings (may need to enable)

### Queue Stuck

If emails are stuck in the queue:

1. Check database for pending emails:
   ```sql
   SELECT * FROM emailQueue WHERE status = 'pending' ORDER BY createdAt DESC;
   ```

2. Check `nextRetryAt` timestamps (may be scheduled for future)

3. Manually reset stuck emails:
   ```sql
   UPDATE emailQueue SET nextRetryAt = NOW() WHERE status = 'pending' AND id = ?;
   ```

4. Restart the service to reset queue processor

## API Reference

### tRPC Endpoints

#### Email Preferences

- `notifications.emailPreferences.list`: List all user preferences
- `notifications.emailPreferences.get`: Get specific preference
- `notifications.emailPreferences.upsert`: Create or update preference
- `notifications.emailPreferences.delete`: Delete preference

#### Email Queue

- `notifications.emailQueue.list`: List emails by status
- `notifications.emailQueue.status`: Get email delivery status

#### Email Testing

- `notifications.test`: Send test email
- `notifications.verify`: Verify SMTP connection

### Database Functions

See `server/db.ts` for database operations:

- `createEmailQueue()`: Add email to queue
- `getEmailQueueById()`: Get email by ID
- `getPendingEmailQueue()`: Get pending emails
- `updateEmailQueue()`: Update email status
- `listEmailQueueByStatus()`: List by status
- `createEmailPreference()`: Create preference
- `getEmailPreference()`: Get preference
- `listEmailPreferencesByUser()`: List user preferences
- `updateEmailPreference()`: Update preference
- `upsertEmailPreference()`: Create or update
- `deleteEmailPreference()`: Delete preference
- `getEmailRecipientsForUser()`: Get recipients for notification type

## Future Enhancements

Potential improvements:

1. **Additional providers**: SendGrid API, Mailgun API (beyond SMTP)
2. **Template variables**: User-defined template variables
3. **Scheduling**: Send emails at specific times
4. **Batching**: Combine multiple notifications into digest emails
5. **Attachments**: Support for email attachments
6. **Rich analytics**: Track open rates, click rates
7. **Unsubscribe links**: Allow users to unsubscribe from specific types
8. **Email threading**: Group related workflow emails in threads
9. **Webhook callbacks**: Notify external systems of email events
10. **Budget warnings**: Implement 80% budget warning emails

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify SMTP configuration with test email
3. Review email queue for failed deliveries
4. Consult SMTP provider documentation for provider-specific issues
