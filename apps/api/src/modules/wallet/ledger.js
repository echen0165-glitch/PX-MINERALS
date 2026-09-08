import { randomUUID } from 'node:crypto';

const buckets = new Set(['available', 'pending', 'bonus', 'signup_bonus', 'referral']);
const columns = { available: 'available_balance', pending: 'pending_balance', bonus: 'bonus_balance', signup_bonus: 'signup_bonus_balance', referral: 'referral_balance' };

/**
 * Applies one auditable wallet movement inside the caller's PostgreSQL transaction.
 * The wallet row is locked first, preventing concurrent duplicate debits or credits.
 */
export async function applyWalletMutation(client, { userId, type, bucket = 'available', amountXof, deltas = null, status = 'completed', reference = null, idempotencyKey = randomUUID(), reason, metadata = {} }) {
  if (!buckets.has(bucket)) throw new Error('INVALID_WALLET_BUCKET');
  if (!Number.isSafeInteger(amountXof) || amountXof === 0) throw new Error('INVALID_WALLET_AMOUNT');
  // Older accounts may predate wallet provisioning. Creating the zeroed row
  // here keeps every financial operation recoverable and idempotent.
  await client.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  const wallet = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
  if (wallet.rowCount !== 1) throw new Error('WALLET_NOT_FOUND');
  const delta = { available: 0, pending: 0, bonus: 0, signup_bonus: 0, referral: 0, ...(deltas ?? { [bucket]: amountXof }) };
  if (!Object.entries(delta).every(([name, value]) => buckets.has(name) && Number.isSafeInteger(value))) throw new Error('INVALID_WALLET_DELTAS');
  if (Object.keys(delta).some((name) => wallet.rows[0][columns[name]] + delta[name] < 0)) throw new Error('INSUFFICIENT_FUNDS');
  if (wallet.rows[0].funds_frozen && Object.values(delta).some((value) => value < 0)) throw new Error('FUNDS_FROZEN');
  const transaction = await client.query(
    `INSERT INTO transactions (user_id, type, amount_xof, balance_bucket, status, reference, idempotency_key, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [userId, type, amountXof, bucket, status, reference, idempotencyKey, metadata]
  );
  await client.query(`UPDATE wallets SET available_balance = available_balance + $2, pending_balance = pending_balance + $3, bonus_balance = bonus_balance + $4, signup_bonus_balance = signup_bonus_balance + $5, referral_balance = referral_balance + $6, version = version + 1, updated_at = now() WHERE user_id = $1`, [userId, delta.available, delta.pending, delta.bonus, delta.signup_bonus, delta.referral]);
  await client.query(
    `INSERT INTO wallet_ledger_entries (wallet_user_id, transaction_id, available_delta_xof, pending_delta_xof, bonus_delta_xof, signup_bonus_delta_xof, referral_delta_xof, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [userId, transaction.rows[0].id, delta.available, delta.pending, delta.bonus, delta.signup_bonus, delta.referral, reason]
  );
  return transaction.rows[0].id;
}
