import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('client support is presented as a service chat and supports replies', async () => {
  const page = await readFile(new URL('../apps/web/public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../apps/web/public/app.js', import.meta.url), 'utf8');
  assert.match(page, /Chat avec l’administration/);
  assert.match(page, /Envoyer au service client/);
  assert.match(app, /Conversation avec le service client/);
  assert.match(app, /setInterval\(.*selectedTicketId/s);
});
