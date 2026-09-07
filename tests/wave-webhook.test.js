import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validWaveSignature } from '../apps/api/src/modules/deposits/wave-webhook.js';

test('Wave webhook accepts a valid HMAC signature and rejects altered or old payloads', () => {
  const secret = 'test-wave-secret'; const timestamp = '1700000000'; const body = Buffer.from('{"id":"EV-1","type":"test.test_event"}');
  const signature = createHmac('sha256', secret).update(`${timestamp}${body.toString('utf8')}`).digest('hex');
  assert.equal(validWaveSignature(`t=${timestamp},v1=${signature}`, body, secret, 1700000000000), true);
  assert.equal(validWaveSignature(`t=${timestamp},v1=${signature}`, Buffer.from('{"id":"EV-2"}'), secret, 1700000000000), false);
  assert.equal(validWaveSignature(`t=${timestamp},v1=${signature}`, body, secret, 1700000400000), false);
});
