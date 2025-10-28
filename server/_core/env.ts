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
  // MCP Server Credentials
  linearApiKey: process.env.LINEAR_API_KEY ?? "",
  braveApiKey: process.env.BRAVE_API_KEY ?? "",
  googleDriveCredentials: process.env.GOOGLE_DRIVE_CREDENTIALS ?? "",
  postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING ?? "",
};
