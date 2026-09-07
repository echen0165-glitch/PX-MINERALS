import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('initial migration protects the financial ledger with unique idempotency keys', async () => {
  const migration = await readFile(new URL('../database/migrations/001_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(migration, /idempotency_key uuid NOT NULL UNIQUE/);
  assert.match(migration, /available_balance bigint NOT NULL DEFAULT 0/);
  assert.match(migration, /wave_webhook_events/);
});
