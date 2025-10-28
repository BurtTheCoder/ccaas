import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import * as db from './db';

/**
 * Verify Slack webhook signature
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Check timestamp to prevent replay attacks (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const requestTimestamp = parseInt(timestamp, 10);
  
  if (Math.abs(now - requestTimestamp) > 300) {
    console.warn('[Webhook] Slack request timestamp too old');
    return false;
  }

  // Compute signature
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const computedSignature = `v0=${hmac.digest('hex')}`;

  // Compare signatures
  try {
    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);
    
    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (error) {
    console.error('[Webhook] Error comparing signatures:', error);
    return false;
  }
}

/**
 * Verify GitHub webhook signature
 */
export function verifyGitHubSignature(
  secret: string,
  signature: string,
  body: string
): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  const computedSignature = `sha256=${hmac.digest('hex')}`;

  try {
    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);
    
    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (error) {
    console.error('[Webhook] Error comparing signatures:', error);
    return false;
  }
}

/**
 * Middleware to verify API key
 */
export async function verifyApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const apiKey = authHeader.substring(7);
  
  try {
    const keyRecord = await db.getApiKeyByKey(apiKey);
    
    if (!keyRecord) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Check expiration
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      res.status(401).json({ error: 'API key expired' });
      return;
    }

    // Attach user and key info to request
    (req as any).apiKey = keyRecord;
    (req as any).userId = keyRecord.userId;

    next();
  } catch (error) {
    console.error('[Webhook] Error verifying API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware to verify Slack webhook
 */
export function verifySlackWebhook(signingSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const body = (req as any).rawBody || JSON.stringify(req.body);

    if (!signature || !timestamp) {
      res.status(401).json({ error: 'Missing Slack signature headers' });
      return;
    }

    if (!verifySlackSignature(signingSecret, signature, timestamp, body)) {
      res.status(401).json({ error: 'Invalid Slack signature' });
      return;
    }

    next();
  };
}

/**
 * Middleware to verify GitHub webhook
 */
export function verifyGitHubWebhook(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const body = (req as any).rawBody || JSON.stringify(req.body);

    if (!signature) {
      res.status(401).json({ error: 'Missing GitHub signature header' });
      return;
    }

    if (!verifyGitHubSignature(secret, signature, body)) {
      res.status(401).json({ error: 'Invalid GitHub signature' });
      return;
    }

    next();
  };
}

/**
 * Check if API key has required permissions
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = (req as any).apiKey;
    
    if (!apiKey) {
      res.status(401).json({ error: 'No API key found' });
      return;
    }

    const permissions = apiKey.permissions as string[] || [];
    
    // Check if key has all required permissions or has 'all' permission
    if (permissions.includes('all')) {
      next();
      return;
    }

    const hasAllPermissions = requiredPermissions.every(perm => 
      permissions.includes(perm)
    );

    if (!hasAllPermissions) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredPermissions,
        has: permissions,
      });
      return;
    }

    next();
  };
}

