import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';

export const clientRouter = Router();
clientRouter.use(requireAuthenticatedUser);

clientRouter.get('/dashboard', async (request, response, next) => {
  try {
    const [profile, wallet, investments, notifications, referral, recent] = await Promise.all([
      pool.query(`SELECT first_name, last_name, username, client_code, avatar_key, created_at FROM users WHERE id = $1`, [request.user.id]),
      pool.query(`SELECT available_balance, pending_balance, bonus_balance, signup_bonus_balance, referral_balance, total_gains_received FROM wallets WHERE user_id = $1`, [request.user.id]),
      pool.query(`SELECT i.id, o.mineral_name, o.term, i.price_xof, i.daily_gain_xof, i.purchased_at, i.ends_at, i.next_gain_at, i.status, i.gains_received_xof FROM investments i JOIN mineral_offers o ON o.id = i.offer_id WHERE i.user_id = $1 ORDER BY i.purchased_at DESC LIMIT 100`, [request.user.id]),
      pool.query(`SELECT id, title, message, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`, [request.user.id]),
      pool.query(`SELECT rc.code, (SELECT count(*)::int FROM referrals r WHERE r.referrer_id = $1 AND r.level = 1) AS direct_referrals FROM referral_codes rc WHERE rc.user_id = $1`, [request.user.id]),
      pool.query(`SELECT id, type, amount_xof, balance_bucket, status, reference, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 6`, [request.user.id])
    ]);
    return response.json({ profile: profile.rows[0], wallet: wallet.rows[0] ?? { available_balance: 0, pending_balance: 0, bonus_balance: 0, signup_bonus_balance: 0, referral_balance: 0, total_gains_received: 0 }, investments: investments.rows, notifications: notifications.rows, referral: referral.rows[0] ?? null, recentTransactions: recent.rows });
  } catch (error) { return next(error); }
});

clientRouter.get('/account', async (request, response, next) => {
  try {
    const result = await pool.query(`SELECT first_name, last_name, username, email, birth_date, wave_number, avatar_key, client_code, status, email_verified_at, created_at, last_login_at, password_changed_at FROM users WHERE id = $1`, [request.user.id]);
    return response.json({ account: result.rows[0] });
  } catch (error) { return next(error); }
});

clientRouter.get('/wallet', async (request, response, next) => {
  try {
    const [wallet, entries] = await Promise.all([
      pool.query(`SELECT available_balance, pending_balance, bonus_balance, signup_bonus_balance, referral_balance, total_gains_received, funds_frozen, updated_at FROM wallets WHERE user_id = $1`, [request.user.id]),
      pool.query(`SELECT t.id, t.type, t.amount_xof, t.balance_bucket, t.status, t.reference, t.created_at, l.reason
        FROM transactions t JOIN wallet_ledger_entries l ON l.transaction_id = t.id
        WHERE t.user_id = $1 ORDER BY t.created_at DESC LIMIT 30`, [request.user.id])
    ]);
    return response.json({ wallet: wallet.rows[0], entries: entries.rows });
  } catch (error) { return next(error); }
});

clientRouter.get('/security', async (request, response, next) => {
  try {
    const [account, sessions, events] = await Promise.all([
      pool.query(`SELECT email_verified_at, wave_number, status, created_at, last_login_at, password_changed_at FROM users WHERE id = $1`, [request.user.id]),
      pool.query(`SELECT id, user_agent, ip_address, last_seen_at, created_at FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC`, [request.user.id]),
      pool.query(`SELECT event_type, result, user_agent, ip_address, created_at FROM security_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15`, [request.user.id])
    ]);
    return response.json({ security: account.rows[0], sessions: sessions.rows, events: events.rows });
  } catch (error) { return next(error); }
});

clientRouter.post('/wave-number-change-requests', async (request, response, next) => {
  const input = z.object({ waveNumber: z.string().trim().min(8).max(32) }).safeParse(request.body);
  if (!input.success) return response.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Numéro Wave invalide.' } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT wave_number FROM users WHERE id = $1 FOR UPDATE', [request.user.id]);
    if (!user.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'Compte introuvable.' } }); }
    if (user.rows[0].wave_number === input.data.waveNumber) { await client.query('ROLLBACK'); return response.status(422).json({ error: { code: 'SAME_WAVE_NUMBER', message: 'Ce numéro est déjà associé à votre compte.' } }); }
    const pending = await client.query("SELECT 1 FROM wave_number_change_requests WHERE user_id = $1 AND status = 'pending'", [request.user.id]);
    if (pending.rowCount) { await client.query('ROLLBACK'); return response.status(409).json({ error: { code: 'WAVE_CHANGE_PENDING', message: 'Une demande de modification est déjà en attente.' } }); }
    await client.query('INSERT INTO wave_number_change_requests(user_id,previous_number,requested_number) VALUES($1,$2,$3)', [request.user.id, user.rows[0].wave_number, input.data.waveNumber]);
    await client.query('COMMIT');
    return response.status(201).json({ message: 'Votre demande de modification Wave est en attente de validation.' });
  } catch (error) { await client.query('ROLLBACK'); return next(error); } finally { client.release(); }
});
