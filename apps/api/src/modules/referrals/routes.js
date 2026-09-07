import { Router } from 'express';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';
export const referralRouter = Router(); referralRouter.use(requireAuthenticatedUser);
referralRouter.get('/', async (request, response, next) => { try {
  const [code, stats, commissions] = await Promise.all([
    pool.query('SELECT code FROM referral_codes WHERE user_id = $1', [request.user.id]),
    pool.query('SELECT level, count(*)::int AS total FROM referrals WHERE referrer_id = $1 GROUP BY level', [request.user.id]),
    pool.query(`SELECT rc.amount_xof, rc.rate_basis_points, rc.created_at, r.level FROM referral_commissions rc JOIN referrals r ON r.id = rc.referral_id WHERE r.referrer_id = $1 ORDER BY rc.created_at DESC`, [request.user.id])
  ]);
  return response.json({ code: code.rows[0]?.code, stats: stats.rows, commissions: commissions.rows, minimumWithdrawalXof: 5850 });
} catch (error) { return next(error); } });
