import { pool, closeDatabase } from '../config/database.js';
import { applyWalletMutation } from '../modules/wallet/ledger.js';

/** Credits each due gain once. Safe to run repeatedly or from multiple workers. */
export async function settleDueGains({ userId = null, reconcile = true } = {}) {
  let settled = 0;
  while (true) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Reconcile every active product against its full daily schedule. This
      // restores a missing day even when an older deployment created only a
      // partial schedule, and stays safe because each date is unique.
      if (reconcile) {
      await client.query('SAVEPOINT gain_schedule_reconciliation');
      try {
      await client.query(`WITH scheduled AS (
          SELECT i.id, i.purchased_at, i.duration_days, i.daily_gain_xof,
            LEAST(i.duration_days, FLOOR(GREATEST(i.gains_received_xof, 0)::numeric /
              NULLIF(i.daily_gain_xof, 0))::int) AS already_credited
          FROM investments i
          WHERE i.status = 'active'
        )
        INSERT INTO investment_gain_events (investment_id, scheduled_at, amount_xof, status, credited_at)
        SELECT scheduled.id, scheduled.purchased_at + (series.day_number * interval '1 day'), scheduled.daily_gain_xof,
          CASE WHEN series.day_number <= scheduled.already_credited THEN 'completed'::operation_status ELSE 'pending'::operation_status END,
          CASE WHEN series.day_number <= scheduled.already_credited THEN scheduled.purchased_at + (series.day_number * interval '1 day') ELSE NULL END
        FROM scheduled CROSS JOIN LATERAL generate_series(1, scheduled.duration_days) AS series(day_number)
        ON CONFLICT (investment_id, scheduled_at) DO NOTHING`);
        await client.query('RELEASE SAVEPOINT gain_schedule_reconciliation');
      } catch (reconciliationError) {
        // A malformed legacy position must never block due gain events that
        // are already correctly scheduled for every other account.
        await client.query('ROLLBACK TO SAVEPOINT gain_schedule_reconciliation');
        console.warn('PX_MINERALS_GAIN_SCHEDULE_RECONCILIATION_DEFERRED', reconciliationError.message);
      }
      }
      const due = await client.query(`SELECT ge.id, ge.investment_id, ge.amount_xof, ge.scheduled_at, i.user_id
        FROM investment_gain_events ge JOIN investments i ON i.id = ge.investment_id
        WHERE ge.status = 'pending' AND ge.scheduled_at <= now() AND i.status = 'active'
          ${userId ? 'AND i.user_id = $1' : ''}
        ORDER BY ge.scheduled_at ASC LIMIT 1 FOR UPDATE OF ge SKIP LOCKED`, userId ? [userId] : []);
      if (!due.rowCount) { await client.query('COMMIT'); return settled; }
      const gain = due.rows[0];
      await applyWalletMutation(client, { userId: gain.user_id, type: 'gain', bucket: 'available', amountXof: Number(gain.amount_xof), reference: `GAIN-${gain.id}`, idempotencyKey: gain.id, reason: 'Gain d’investissement', metadata: { investmentId: gain.investment_id, gainEventId: gain.id } });
      await client.query(`UPDATE investment_gain_events SET status = 'completed', credited_at = now() WHERE id = $1`, [gain.id]);
      const remaining = await client.query(`SELECT count(*)::int AS count FROM investment_gain_events WHERE investment_id = $1 AND status = 'pending'`, [gain.investment_id]);
      await client.query(`UPDATE investments SET gains_received_xof = gains_received_xof + $1, next_gain_at = (SELECT min(scheduled_at) FROM investment_gain_events WHERE investment_id = $2 AND status = 'pending'), status = CASE WHEN $3 = 0 THEN 'completed' ELSE 'active' END WHERE id = $2`, [gain.amount_xof, gain.investment_id, remaining.rows[0].count]);
      await client.query('UPDATE wallets SET total_gains_received = total_gains_received + $1, updated_at = now() WHERE user_id = $2', [gain.amount_xof, gain.user_id]);
      await client.query('COMMIT'); settled += 1;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

if (process.argv[1]?.endsWith('settle-gains.js')) {
  settleDueGains().then((count) => { console.log(`Settled ${count} gain event(s).`); }).finally(closeDatabase);
}
