import test from 'node:test';
import assert from 'node:assert/strict';
import { hashSecret, passwordIsValid, verifySecret } from '../apps/api/src/modules/auth/passwords.js';

test('passwords require a letter, a number and ten characters', () => {
  assert.equal(passwordIsValid('abcdefghij'), false);
  assert.equal(passwordIsValid('1234567890'), false);
  assert.equal(passwordIsValid('pxMinerals2026'), true);
});

test('a password hash cannot validate a different password', async () => {
  const hash = await hashSecret('pxMinerals2026');
  assert.equal(await verifySecret('pxMinerals2026', hash), true);
  assert.equal(await verifySecret('not-the-password', hash), false);
  assert.doesNotMatch(hash, /pxMinerals2026/);
});
