import { Router } from 'express';
import * as webhookAuth from './webhookAuth';
import * as webhookHandlers from './webhookHandlers';
import { ConfigService } from './configService';
import { ActionService } from './actionService';

const router = Router();

// Middleware to capture raw body for signature verification
function captureRawBody(req: any, res: any, buf: Buffer, encoding: BufferEncoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

export function registerWebhookRoutes(app: any) {
  // Initialize services
  const projectRoot = process.cwd();
  const configService = new ConfigService(projectRoot);
  const actionService = new ActionService();

  // Create route handlers with injected services
  const createSlackHandler = (configService: ConfigService, actionService: ActionService) =>
    (req: any, res: any) => webhookHandlers.handleSlackCommand(req, res, configService, actionService);

  const createGitHubHandler = (configService: ConfigService, actionService: ActionService) =>
    (req: any, res: any) => webhookHandlers.handleGitHubWebhook(req, res, configService, actionService);

  const createGenericHandler = (configService: ConfigService, actionService: ActionService) =>
    (req: any, res: any) => webhookHandlers.handleGenericWebhook(req, res, configService, actionService);

  const createLinearHandler = (configService: ConfigService, actionService: ActionService) =>
    (req: any, res: any) => webhookHandlers.handleLinearWebhook(req, res, configService, actionService);

  /**
   * Slack webhook endpoint
   * POST /webhook/slack
   */
  router.post(
    '/slack',
    webhookAuth.verifyApiKey,
    webhookAuth.requirePermissions('execute'),
    // Note: In production, also add verifySlackWebhook middleware
    createSlackHandler(configService, actionService)
  );

  /**
   * GitHub webhook endpoint
   * POST /webhook/github
   */
  router.post(
    '/github',
    webhookAuth.verifyApiKey,
    webhookAuth.requirePermissions('execute'),
    // Note: In production, also add verifyGitHubWebhook middleware
    createGitHubHandler(configService, actionService)
  );

  /**
   * Generic webhook endpoint
   * POST /webhook/execute
   */
  router.post(
    '/execute',
    webhookAuth.verifyApiKey,
    webhookAuth.requirePermissions('execute'),
    createGenericHandler(configService, actionService)
  );

  /**
   * Linear webhook endpoint
   * POST /webhook/linear
   */
  router.post(
    '/linear',
    webhookAuth.verifyApiKey,
    webhookAuth.requirePermissions('execute'),
    // Note: In production, signature verification is handled inside the handler
    createLinearHandler(configService, actionService)
  );

  app.use('/api/webhooks', router);
}

export default router;

