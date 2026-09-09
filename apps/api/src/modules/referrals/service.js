import { randomUUID } from 'node:crypto';
import { applyWalletMutation } from '../wallet/ledger.js';

const rates = { 1: 3000, 2: 500, 3: 400 };

/** Call in the same transaction immediately after a deposit becomes approved. */
export async function grantFirstDepositCommissions(client, depositId) {
  const deposit = await client.query('SELECT user_id, amount_xof, status FROM deposits WHERE id = $1 FOR UPDATE', [depositId]);
  if (!deposit.rowCount || deposit.rows[0].status !== 'approved') return 0;
  const prior = await client.query("SELECT count(*)::int AS count FROM deposits WHERE user_id = $1 AND status = 'approved' AND id <> $2", [deposit.rows[0].user_id, depositId]);
  if (prior.rows[0].count > 0) return 0;
  // Le premier dépôt validé confirme officiellement le parrainage du filleul.
  await client.query('UPDATE referrals SET confirmed_at = now() WHERE referred_user_id = $1 AND confirmed_at IS NULL', [deposit.rows[0].user_id]);
  const referrals = await client.query('SELECT id, referrer_id, level FROM referrals WHERE referred_user_id = $1 AND confirmed_at IS NOT NULL ORDER BY level', [deposit.rows[0].user_id]);
  for (const referral of referrals.rows) {
    const rate = rates[referral.level];
    const amount = Math.floor(Number(deposit.rows[0].amount_xof) * rate / 10000);
    const inserted = await client.query(`INSERT INTO referral_commissions (referral_id, qualifying_deposit_id, amount_xof, rate_basis_points) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`, [referral.id, depositId, amount, rate]);
    if (inserted.rowCount) await applyWalletMutation(client, { userId: referral.referrer_id, type: 'referral_commission', bucket: 'referral', amountXof: amount, reason: `Commission parrainage niveau ${referral.level}`, idempotencyKey: randomUUID(), metadata: { depositId, referralId: referral.id, level: referral.level } });
  }
  return referrals.rowCount;
}
