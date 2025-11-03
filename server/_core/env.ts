export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET ?? "",
  slackDefaultChannel: process.env.SLACK_DEFAULT_CHANNEL ?? "",
  // Email Configuration
  emailProvider: process.env.EMAIL_PROVIDER ?? "none",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? "",
  emailFromName: process.env.EMAIL_FROM_NAME ?? "Claude Code Service",
  // SMTP Configuration
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  // Linear Integration
  linearApiKey: process.env.LINEAR_API_KEY ?? "",
  linearWebhookSecret: process.env.LINEAR_WEBHOOK_SECRET ?? "",
  // MCP Server Credentials
  braveApiKey: process.env.BRAVE_API_KEY ?? "",
  googleDriveCredentials: process.env.GOOGLE_DRIVE_CREDENTIALS ?? "",
  postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING ?? "",
};
