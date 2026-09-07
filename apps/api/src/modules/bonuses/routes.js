import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';
import { applyWalletMutation } from '../wallet/ledger.js';

export const bonusRouter = Router();
bonusRouter.use(requireAuthenticatedUser);

bonusRouter.get('/', async (request, response, next) => {
  try {
    const [wallet, redemptions] = await Promise.all([
      pool.query('SELECT bonus_balance, signup_bonus_balance FROM wallets WHERE user_id = $1', [request.user.id]),
      pool.query(`SELECT b.code, b.amount_xof, br.redeemed_at FROM bonus_redemptions br JOIN bonus_campaigns b ON b.id = br.bonus_id WHERE br.user_id = $1 ORDER BY br.redeemed_at DESC`, [request.user.id])
    ]);
    return response.json({ bonusBalance: wallet.rows[0]?.bonus_balance ?? 0, withdrawableSignupBonus: wallet.rows[0]?.signup_bonus_balance ?? 0, redemptions: redemptions.rows });
  } catch (error) { return next(error); }
});

bonusRouter.post('/redeem', async (request, response, next) => {
  const parsed = z.object({ code: z.string().trim().min(1).max(64) }).safeParse(request.body);
  if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_BONUS_CODE', message: 'Code bonus invalide.' } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bonus = await client.query(`SELECT * FROM bonus_campaigns WHERE upper(code) = upper($1) FOR UPDATE`, [parsed.data.code]);
    if (!bonus.rowCount || !bonus.rows[0].active || (bonus.rows[0].expires_at && bonus.rows[0].expires_at <= new Date()) || bonus.rows[0].used_count >= bonus.rows[0].max_uses) { await client.query('ROLLBACK'); return response.status(422).json({ error: { code: 'BONUS_UNAVAILABLE', message: 'Ce code est invalide, expiré ou épuisé.' } }); }
    const redeemed = await client.query('SELECT 1 FROM bonus_redemptions WHERE bonus_id = $1 AND user_id = $2', [bonus.rows[0].id, request.user.id]);
    if (redeemed.rowCount) { await client.query('ROLLBACK'); return response.status(409).json({ error: { code: 'BONUS_ALREADY_USED', message: 'Ce code a déjà été utilisé.' } }); }
    const transactionId = await applyWalletMutation(client, { userId: request.user.id, type: 'bonus', bucket: 'bonus', amountXof: Number(bonus.rows[0].amount_xof), reason: `Code bonus ${bonus.rows[0].code}`, metadata: { bonusId: bonus.rows[0].id } });
    await client.query('INSERT INTO bonus_redemptions (bonus_id, user_id) VALUES ($1,$2)', [bonus.rows[0].id, request.user.id]);
    await client.query('UPDATE bonus_campaigns SET used_count = used_count + 1 WHERE id = $1', [bonus.rows[0].id]);
    await client.query('COMMIT');
    return response.status(201).json({ transactionId, amountXof: Number(bonus.rows[0].amount_xof), message: 'Bonus ajouté à votre solde bonus.' });
  } catch (error) { await client.query('ROLLBACK'); return next(error); } finally { client.release(); }
});
