import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Brevo mailer uses the transactional endpoint and never exposes its key to the browser', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/auth/mailer.js', import.meta.url), 'utf8');
  assert.match(source, /https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
  assert.match(source, /'api-key': env\.EMAIL_API_KEY/);
  assert.doesNotMatch(source, /public.*EMAIL_API_KEY/i);
});
