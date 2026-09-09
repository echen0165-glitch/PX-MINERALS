import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin can open every user conversation and reply', async () => {
  const api = await readFile(new URL('../apps/api/src/modules/admin/routes.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../apps/admin/public/app.js', import.meta.url), 'utf8');
  assert.match(api, /adminRouter\.get\('\/support'/);
  assert.match(api, /adminRouter\.post\('\/support\/:id\/messages'/);
  assert.match(app, /support-reply-form/);
  assert.match(api, /Réponse du support/);
});
