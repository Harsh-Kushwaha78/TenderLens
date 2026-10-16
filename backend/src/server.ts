import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
pool.on('error', () => console.error('[db] idle client error'));
const app = createApp({ pool, config });

const server = app.listen(config.port, () => {
  console.log(`TenderLens API listening on :${config.port} (${config.nodeEnv}). No authentication is enabled (development only).`);
});

const shutdown = () => {
  server.close(() => pool.end().finally(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
