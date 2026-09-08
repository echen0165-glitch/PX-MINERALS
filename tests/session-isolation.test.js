import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin and client sessions use separate cookies and logout contexts', async () => {
  const session = await readFile(new URL('../apps/api/src/modules/auth/session.js', import.meta.url), 'utf8');
  const routes = await readFile(new URL('../apps/api/src/modules/auth/routes.js', import.meta.url), 'utf8');
  const clientApp = await readFile(new URL('../apps/web/public/app.js', import.meta.url), 'utf8');
  const adminApp = await readFile(new URL('../apps/admin/public/app.js', import.meta.url), 'utf8');

  assert.match(session, /CLIENT_SESSION_COOKIE = 'px_client_session'/);
  assert.match(session, /ADMIN_SESSION_COOKIE = 'px_admin_session'/);
  assert.match(session, /request\.originalUrl\?\.startsWith\('\/api\/auth\/admin\/'\)/);
  assert.match(routes, /found\.rows\[0\]\.role === 'admin' \? 'admin' : 'client'/);
  assert.match(routes, /request\.cookies\[sessionCookieName\(context\)\]/);
  assert.match(clientApp, /'X-PX-Context': 'client'/);
  assert.match(adminApp, /'X-PX-Context'\s*:\s*'admin'/);
});
