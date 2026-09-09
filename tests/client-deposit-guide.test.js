import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('deposit page provides a clear tutorial and referral rule', async () => {
  const page = await readFile(new URL('../apps/web/public/index.html', import.meta.url), 'utf8');
  assert.match(page, /Comment faire votre dépôt \?/);
  assert.match(page, /Faire la demande de dépôt/);
  assert.match(page, /Aucune commission n’est attribuée tant que votre filleul n’a pas effectué un premier dépôt validé/);
});
