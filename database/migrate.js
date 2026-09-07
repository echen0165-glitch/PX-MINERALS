import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const directory = path.dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to run migrations.');

const client = new pg.Client({ connectionString, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
await client.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Set((await client.query('SELECT filename FROM schema_migrations')).rows.map((row) => row.filename));
  const files = (await readdir(path.join(directory, 'migrations'))).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(directory, 'migrations', file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
