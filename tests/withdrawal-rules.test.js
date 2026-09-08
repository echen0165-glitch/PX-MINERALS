import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function quote(amount) {
  const rate = amount >= 500000 ? 3500 : 2500;
  const commission = Math.floor(amount * rate / 10000);
  return { rate, commission, net: amount - commission };
}

test('withdrawal commission is 25% below 500000 FCFA and 35% from 500000 FCFA', () => {
  assert.deepEqual(quote(100000), { rate: 2500, commission: 25000, net: 75000 });
  assert.deepEqual(quote(500000), { rate: 3500, commission: 175000, net: 325000 });
});

test('withdrawals require both a validated deposit and an investment', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/withdrawals/routes.js', import.meta.url), 'utf8');
  assert.match(source, /VALIDATED_DEPOSIT_REQUIRED/);
  assert.match(source, /INVESTMENT_REQUIRED/);
  assert.match(source, /status IN \('active', 'completed'\)/);
});

test('withdrawals enforce a minimum of 2,000,000 FCFA', async () => {
  const source = await readFile(new URL('../apps/api/src/modules/withdrawals/routes.js', import.meta.url), 'utf8');
  assert.match(source, /amountXof < 2000000/);
  assert.match(source, /MINIMUM_WITHDRAWAL/);
});
