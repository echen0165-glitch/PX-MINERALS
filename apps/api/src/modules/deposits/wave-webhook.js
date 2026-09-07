import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../../config/env.js';
import { pool } from '../../config/database.js';

export const waveWebhookRouter = Router();
export function validWaveSignature(header, raw, secret = env.WAVE_WEBHOOK_SECRET, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = header.split(',').map((item) => item.trim()); const timestamp = parts.find((item) => item.startsWith('t='))?.slice(2); const signatures = parts.filter((item) => item.startsWith('v1=')).map((item) => item.slice(3));
  if (!timestamp || !signatures.length || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}${raw.toString('utf8')}`).digest('hex');
  return signatures.some((signature) => signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
}
waveWebhookRouter.post('/', async (request, response, next) => {
  try {
    const raw = request.body; if (!Buffer.isBuffer(raw) || !validWaveSignature(request.get('Wave-Signature'), raw)) return response.status(401).send('Invalid Wave signature');
    const event = JSON.parse(raw.toString('utf8')); if (!event?.id || !event?.type) return response.status(400).send('Invalid Wave event');
    const stored = await pool.query(`INSERT INTO wave_webhook_events (wave_event_id,event_type,signature_valid,payload,processed_at) VALUES ($1,$2,true,$3,now()) ON CONFLICT (wave_event_id) DO NOTHING RETURNING id`, [event.id, event.type, event]);
    if (stored.rowCount && event?.data?.client_reference && event?.data?.transaction_id) await pool.query('UPDATE wave_transactions SET wave_reference = $1, wave_status = $2, raw_response = $3 WHERE client_reference = $4 AND wave_reference IS NULL', [event.data.transaction_id, event.data.payment_status ?? event.data.checkout_status ?? event.type, event, event.data.client_reference]);
    // No wallet credit here: static checkout link cannot safely bind a Wave payment to a PX deposit.
    return response.status(200).send('OK');
  } catch (error) { return next(error); }
});
