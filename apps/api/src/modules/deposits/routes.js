import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';
import { notify } from '../notifications/service.js';

const allowedAmounts = new Set([3755, 7050, 20050, 30050, 50000, 85000, 150000, 275000, 475000, 755000, 1250000, 1749500]);
export const depositRouter = Router();
depositRouter.use(requireAuthenticatedUser);

depositRouter.get('/', async (request, response, next) => {
  const client = await pool.connect();
  try {
    const deposits = await pool.query(`SELECT d.id, d.amount_xof, d.status, d.requested_at, d.reviewed_at, d.refusal_reason, w.wave_reference, w.client_reference, w.raw_response->>'payerWaveNumber' AS payer_wave_number
      FROM deposits d LEFT JOIN wave_transactions w ON w.deposit_id = d.id WHERE d.user_id = $1 ORDER BY d.requested_at DESC`, [request.user.id]);
    return response.json({ deposits: deposits.rows, allowedAmounts: [...allowedAmounts], checkoutUrl: env.WAVE_DEPOSIT_URL });
  } catch (error) { return next(error); }
});

depositRouter.post('/', async (request, response, next) => {
  const parsed = z.object({
    amountXof: z.number().int(),
    waveReference: z.string().trim().min(3).max(255),
    payerWaveNumber: z.string().trim().min(8).max(32),
    paymentScreenshot: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/).max(1500000)
  }).safeParse(request.body);
  const rawKey = request.get('Idempotency-Key');
  if (!parsed.success || !allowedAmounts.has(parsed.data.amountXof)) return response.status(422).json({ error: { code: 'INVALID_DEPOSIT_AMOUNT', message: 'Le montant doit être une formule de dépôt prédéfinie.' } });
  if (!rawKey || !z.string().uuid().safeParse(rawKey).success) return response.status(400).json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Clé d’idempotence requise.' } });
  try {
    const previous = await pool.query(`SELECT d.id, w.payment_url FROM deposits d LEFT JOIN wave_transactions w ON w.deposit_id = d.id WHERE d.user_id = $1 AND d.idempotency_key = $2`, [request.user.id, rawKey]);
    if (previous.rowCount) return response.status(200).json({ depositId: previous.rows[0].id, checkoutUrl: previous.rows[0].payment_url, idempotent: true });
    const reference = `PXDEP-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    await client.query('BEGIN');
    try {
      const deposit = await client.query(`INSERT INTO deposits (user_id, amount_xof, idempotency_key) VALUES ($1,$2,$3) RETURNING id`, [request.user.id, parsed.data.amountXof, rawKey]);
      await client.query(`INSERT INTO wave_transactions (deposit_id, direction, client_reference, wave_reference, payment_url, raw_response) VALUES ($1,'incoming',$2,$3,$4,$5)`, [deposit.rows[0].id, reference, parsed.data.waveReference, env.WAVE_DEPOSIT_URL, { integration: 'static-payment-link', automaticValidation: false, payerWaveNumber: parsed.data.payerWaveNumber, paymentScreenshot: parsed.data.paymentScreenshot }]);
      await notify(client, { userId: request.user.id, title: 'Dépôt en attente', message: `Votre demande de dépôt de ${parsed.data.amountXof} FCFA attend une vérification.`, link: '#wallet' });
      await client.query('COMMIT');
      return response.status(201).json({ depositId: deposit.rows[0].id, clientReference: reference, checkoutUrl: env.WAVE_DEPOSIT_URL, status: 'pending', message: 'Demande créée. Le solde reste inchangé jusqu’à vérification et validation.' });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: { code: 'DUPLICATE_DEPOSIT', message: 'Cette demande existe déjà.' } });
    return next(error);
  } finally { client.release(); }
});

// Intentionally does not credit a wallet. Real Wave signature verification and API credentials are required first.
depositRouter.post('/wave/webhook', async (request, response) => {
  if (!env.WAVE_API_KEY || !env.WAVE_WEBHOOK_SECRET) return response.status(503).json({ error: { code: 'WAVE_NOT_CONFIGURED', message: 'Intégration Wave Business non configurée.' } });
  return response.status(501).json({ error: { code: 'WAVE_SIGNATURE_VERIFICATION_REQUIRED', message: 'Vérification de signature Wave à configurer avec les identifiants Business.' } });
});
