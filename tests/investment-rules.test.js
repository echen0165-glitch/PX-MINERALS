import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('investment flow has mandatory idempotency and schedules the first gain after 24 hours', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/investments/routes.js', import.meta.url), 'utf8');
  assert.match(source, /IDEMPOTENCY_KEY_REQUIRED/);
  assert.match(source, /now\(\) \+ interval '24 hours'/);
  assert.match(source, /\$4::int \* interval/);
  assert.match(source, /generate_series\(1, \$3::int\)/);
});

test('client investment payload includes the product validity duration', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/client/routes.js', import.meta.url), 'utf8');
  assert.match(source, /i\.duration_days/);
});

test('legacy active investments receive one gain event per product day', async () => {
  const migration = await readFile(new URL('../database/migrations/014_backfill_investment_gain_events.sql', import.meta.url), 'utf8');
  assert.match(migration, /FROM investments i/);
  assert.match(migration, /generate_series\(1, legacy\.duration_days\)/);
  assert.match(migration, /NOT EXISTS \(\s*SELECT 1 FROM investment_gain_events/);
  assert.match(migration, /ON CONFLICT \(investment_id, scheduled_at\) DO NOTHING/);
});

test('referral commissions require a confirmed first validated deposit', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/referrals/service.js', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../database/migrations/013_referral_deposit_confirmation.sql', import.meta.url), 'utf8');
  assert.match(source, /SET confirmed_at = now\(\)/);
  assert.match(source, /confirmed_at IS NOT NULL/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS confirmed_at/);
});
