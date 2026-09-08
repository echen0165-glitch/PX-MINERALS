import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('wallet ledger migration makes financial entries immutable', async () => {
  const migration = await readFile(new URL('../database/migrations/002_wallet_ledger.sql', import.meta.url), 'utf8');
  assert.match(migration, /wallet_ledger_entries/);
  assert.match(migration, /wallet ledger entries are immutable/);
});

test('wallet balance checks convert PostgreSQL numeric strings before arithmetic', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/wallet/ledger.js', import.meta.url), 'utf8');
  assert.match(source, /Number\(wallet\.rows\[0\]\[columns\[name\]\]\) \+ delta\[name\]/);
});
