export interface Config {
  port: number;
  databaseUrl: string;
  corsOrigin: string;
  appTimezone: string;
  nodeEnv: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required (see .env.example).');
  }
  const appTimezone = env.APP_TIMEZONE || 'Asia/Kolkata';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: appTimezone });
  } catch {
    throw new Error(`APP_TIMEZONE "${appTimezone}" is not a valid IANA timezone.`);
  }
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return {
    port,
    databaseUrl,
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    appTimezone,
    nodeEnv: env.NODE_ENV || 'development',
  };
}
