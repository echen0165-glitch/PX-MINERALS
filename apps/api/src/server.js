import { createApp } from './app.js';
import { pool, closeDatabase } from './config/database.js';
import { env } from './config/env.js';

const app = createApp();
const server = app.listen(env.PORT, () => console.log(`PX MINERALS API listening on port ${env.PORT}`));

async function shutdown(signal) {
  console.log(`${signal} received; closing gracefully.`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error', error));
