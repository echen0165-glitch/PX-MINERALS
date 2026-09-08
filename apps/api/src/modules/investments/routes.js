import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';
import { applyWalletMutation } from '../wallet/ledger.js';
import { notify } from '../notifications/service.js';

export const investmentRouter = Router();

investmentRouter.get('/offers', async (request, response, next) => {
  try {
    const offers = await pool.query(`SELECT id, mineral_name, term, price_xof, duration_days, daily_gain_xof FROM mineral_offers ORDER BY term, price_xof`);
    return response.json({ offers: offers.rows });
  } catch (error) { return next(error); }
});

investmentRouter.use(requireAuthenticatedUser);

investmentRouter.get('/', async (request, response, next) => {
  try {
    const investments = await pool.query(`SELECT i.id, i.price_xof, i.duration_days, i.daily_gain_xof, i.purchased_at, i.ends_at, i.next_gain_at, i.gains_received_xof, i.status, o.mineral_name, o.term
      FROM investments i JOIN mineral_offers o ON o.id = i.offer_id WHERE i.user_id = $1 ORDER BY i.purchased_at DESC`, [request.user.id]);
    return response.json({ investments: investments.rows });
  } catch (error) { return next(error); }
});

investmentRouter.post('/', async (request, response, next) => {
  const parsed = z.object({ offerId: z.string().uuid() }).safeParse(request.body);
  if (!parsed.success) return response.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Offre invalide.' } });
  const rawKey = request.get('Idempotency-Key');
  if (!rawKey || !z.string().uuid().safeParse(rawKey).success) return response.status(400).json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Clé d’idempotence requise.' } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query(`SELECT metadata->>'investmentId' AS investment_id FROM transactions WHERE user_id = $1 AND idempotency_key = $2`, [request.user.id, rawKey]);
    if (previous.rowCount) { await client.query('COMMIT'); return response.status(200).json({ investmentId: previous.rows[0].investment_id, idempotent: true }); }
    const offer = await client.query('SELECT * FROM mineral_offers WHERE id = $1 AND is_locked = true', [parsed.data.offerId]);
    if (offer.rowCount !== 1) { await client.query('ROLLBACK'); return response.status(404).json({ error: { code: 'OFFER_NOT_FOUND', message: 'Offre indisponible.' } }); }
    const row = offer.rows[0];
    await client.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [request.user.id]);
    const wallet = await client.query('SELECT available_balance, bonus_balance, signup_bonus_balance FROM wallets WHERE user_id = $1 FOR UPDATE', [request.user.id]);
    if (!wallet.rowCount || Number(wallet.rows[0].available_balance) + Number(wallet.rows[0].bonus_balance) < Number(row.price_xof)) { await client.query('ROLLBACK'); return response.status(422).json({ error: { code: 'INSUFFICIENT_FUNDS', message: 'Fonds insuffisants. Effectuez un dépôt pour continuer.' } }); }
    const signupBonusBalance = Number(wallet.rows[0].signup_bonus_balance);
    const giftBonusBalance = Number(wallet.rows[0].bonus_balance) - signupBonusBalance;
    const giftBonusUsed = Math.min(giftBonusBalance, Number(row.price_xof));
    const signupBonusUsed = Math.min(signupBonusBalance, Number(row.price_xof) - giftBonusUsed);
    const bonusUsed = giftBonusUsed + signupBonusUsed;
    const availableUsed = Number(row.price_xof) - bonusUsed;
    const investment = await client.query(`INSERT INTO investments (user_id, offer_id, price_xof, duration_days, daily_gain_xof, ends_at, next_gain_at)
      VALUES ($1,$2,$3,$4,$5,now() + ($4 * interval '1 day'),now() + interval '24 hours') RETURNING id, ends_at, next_gain_at`, [request.user.id, row.id, row.price_xof, row.duration_days, row.daily_gain_xof]);
    const investmentId = investment.rows[0].id;
    await applyWalletMutation(client, { userId: request.user.id, type: 'investment', bucket: 'available', amountXof: -Number(row.price_xof), deltas: { available: -availableUsed, bonus: -bonusUsed, signup_bonus: -signupBonusUsed }, reference: `INV-${investmentId}`, idempotencyKey: rawKey, reason: `Investment ${row.mineral_name} ${row.term}`, metadata: { investmentId, offerId: row.id, bonusUsed, giftBonusUsed, signupBonusUsed } });
    await client.query(`INSERT INTO investment_gain_events (investment_id, scheduled_at, amount_xof)
      SELECT $1, now() + (item * interval '1 day'), $2 FROM generate_series(1, $3) item`, [investmentId, row.daily_gain_xof, row.duration_days]);
    try {
      await notify(client, { userId: request.user.id, title: 'Investissement activé', message: `${row.mineral_name} est maintenant actif. Votre premier gain sera crédité dans 24 heures.`, link: '#investments' });
    } catch (notificationError) {
      console.warn('PX_MINERALS_INVESTMENT_NOTIFICATION_FAILED', notificationError.message);
    }
    await client.query('COMMIT');
    return response.status(201).json({ investmentId, endsAt: investment.rows[0].ends_at, nextGainAt: investment.rows[0].next_gain_at });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.message === 'INSUFFICIENT_FUNDS') return response.status(422).json({ error: { code: 'INSUFFICIENT_FUNDS', message: 'Fonds insuffisants. Effectuez un dépôt pour continuer.' } });
    if (error.message === 'FUNDS_FROZEN') return response.status(423).json({ error: { code: 'FUNDS_FROZEN', message: 'Vos fonds sont temporairement gelés.' } });
    return next(error);
  } finally { client.release(); }
});
