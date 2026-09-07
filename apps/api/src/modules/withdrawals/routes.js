import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';
import { applyWalletMutation } from '../wallet/ledger.js';
import { notify } from '../notifications/service.js';

export const withdrawalRouter = Router();
withdrawalRouter.use(requireAuthenticatedUser);

withdrawalRouter.get('/', async (request, response, next) => {
  try {
    const withdrawals = await pool.query(`SELECT id, gross_amount_xof, commission_xof, net_amount_xof, wave_number, status, requested_at, refusal_reason FROM withdrawals WHERE user_id = $1 ORDER BY requested_at DESC`, [request.user.id]);
    return response.json({ withdrawals: withdrawals.rows });
  } catch (error) { return next(error); }
});

withdrawalRouter.post('/', async (request, response, next) => {
  const parsed = z.object({ amountXof: z.number().int().positive() }).safeParse(request.body);
  const idempotencyKey = request.get('Idempotency-Key');
  if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_WITHDRAWAL_AMOUNT', message: 'Montant invalide.' } });
  if (!idempotencyKey || !z.string().uuid().safeParse(idempotencyKey).success) return response.status(400).json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Clé d’idempotence requise.' } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [request.user.id]);
    const previous = await client.query('SELECT id, status FROM withdrawals WHERE user_id = $1 AND idempotency_key = $2', [request.user.id, idempotencyKey]);
    if (previous.rowCount) { await client.query('COMMIT'); return response.json({ withdrawalId: previous.rows[0].id, status: previous.rows[0].status, idempotent: true }); }
    const deposited = await client.query("SELECT 1 FROM deposits WHERE user_id = $1 AND status = 'approved' LIMIT 1", [request.user.id]);
    if (!deposited.rowCount) { await client.query('ROLLBACK'); return response.status(422).json({ error: { code: 'VALIDATED_DEPOSIT_REQUIRED', message: 'Au moins un dépôt validé est requis avant un retrait.' } }); }
    const today = await client.query("SELECT 1 FROM withdrawals WHERE user_id = $1 AND requested_at >= date_trunc('day', now()) LIMIT 1", [request.user.id]);
    if (today.rowCount) { await client.query('ROLLBACK'); return response.status(429).json({ error: { code: 'DAILY_LIMIT_REACHED', message: 'Un seul retrait est autorisé par jour.' } }); }
    const wallet = await client.query('SELECT available_balance, signup_bonus_balance FROM wallets WHERE user_id = $1 FOR UPDATE', [request.user.id]);
    const availableBalance = Number(wallet.rows[0]?.available_balance ?? 0);
    const signupBonusBalance = Number(wallet.rows[0]?.signup_bonus_balance ?? 0);
    if (!wallet.rowCount || availableBalance + signupBonusBalance - parsed.data.amountXof < 450) { await client.query('ROLLBACK'); return response.status(422).json({ error: { code: 'MINIMUM_BALANCE_REQUIRED', message: 'Vous devez conserver au moins 450 FCFA après le retrait.' } }); }
    const signupBonusUsed = Math.min(signupBonusBalance, parsed.data.amountXof);
    const availableUsed = parsed.data.amountXof - signupBonusUsed;
    const rate = parsed.data.amountXof >= 500000 ? 3500 : 2500;
    const commission = Math.floor(parsed.data.amountXof * rate / 10000);
    const net = parsed.data.amountXof - commission;
    const withdrawal = await client.query(`INSERT INTO withdrawals (user_id, gross_amount_xof, commission_rate_basis_points, commission_xof, net_amount_xof, wave_number, idempotency_key) SELECT id,$2,$3,$4,$5,wave_number,$6 FROM users WHERE id = $1 RETURNING id`, [request.user.id, parsed.data.amountXof, rate, commission, net, idempotencyKey]);
    await applyWalletMutation(client, { userId: request.user.id, type: 'withdrawal', bucket: 'available', amountXof: -parsed.data.amountXof, deltas: { available: -availableUsed, bonus: -signupBonusUsed, signup_bonus: -signupBonusUsed, pending: parsed.data.amountXof }, status: 'pending', reference: `WDR-${withdrawal.rows[0].id}`, idempotencyKey: randomUUID(), reason: 'Demande de retrait en attente', metadata: { withdrawalId: withdrawal.rows[0].id, commissionXof: commission, netAmountXof: net, signupBonusUsed, availableUsed } });
    await notify(client, { userId: request.user.id, title: 'Retrait en attente', message: `Votre demande de retrait est en attente. Montant net prévu : ${net} FCFA.`, link: '#wallet' });
    await client.query('COMMIT');
    return response.status(201).json({ withdrawalId: withdrawal.rows[0].id, grossAmountXof: parsed.data.amountXof, commissionXof: commission, netAmountXof: net, status: 'pending' });
  } catch (error) { await client.query('ROLLBACK'); if (error.message === 'INSUFFICIENT_FUNDS') return response.status(422).json({ error: { code: 'INSUFFICIENT_FUNDS', message: 'Fonds insuffisants.' } }); return next(error); } finally { client.release(); }
});
