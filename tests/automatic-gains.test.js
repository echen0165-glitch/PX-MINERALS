import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('gains job is a real Netlify scheduled function and dashboard has a safety trigger', async () => {
  const scheduled = await readFile(new URL('../netlify/functions/settle-gains.mjs', import.meta.url), 'utf8');
  const client = await readFile(new URL('../apps/api/src/modules/client/routes.js', import.meta.url), 'utf8');
  assert.match(scheduled, /export default async/);
  assert.match(scheduled, /config = \{ schedule: '15 \* \* \* \*' \}/);
  assert.doesNotMatch(scheduled, /closeDatabase/);
  assert.match(client, /await settleDueGains\(\{ userId: request\.user\.id \}\)/);
  assert.match(client, /PX_MINERALS_GAIN_SETTLEMENT_DEFERRED/);
  assert.match(scheduled, /settleDueGains\(\)/);
  const job = await readFile(new URL('../apps/api/src/jobs/settle-gains.js', import.meta.url), 'utf8');
  assert.match(job, /FROM scheduled CROSS JOIN LATERAL generate_series/);
  assert.match(job, /total_gains_received = total_gains_received \+ \$1/);
  assert.match(job, /COALESCE\(\(SELECT min\(scheduled_at\).*ends_at\)/s);
  assert.match(job, /'completed'::investment_status ELSE 'active'::investment_status/);
});
