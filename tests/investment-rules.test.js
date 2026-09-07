import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('investment flow has mandatory idempotency and schedules the first gain after 24 hours', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/investments/routes.js', import.meta.url), 'utf8');
  assert.match(source, /IDEMPOTENCY_KEY_REQUIRED/);
  assert.match(source, /now\(\) \+ interval '24 hours'/);
  assert.match(source, /generate_series\(1, \$3\)/);
});
