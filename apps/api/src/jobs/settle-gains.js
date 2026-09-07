import { pool, closeDatabase } from '../config/database.js';
import { applyWalletMutation } from '../modules/wallet/ledger.js';

/** Credits each due gain once. Safe to run repeatedly or from multiple workers. */
export async function settleDueGains() {
  let settled = 0;
  while (true) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const due = await client.query(`SELECT ge.id, ge.investment_id, ge.amount_xof, ge.scheduled_at, i.user_id
        FROM investment_gain_events ge JOIN investments i ON i.id = ge.investment_id
        WHERE ge.status = 'pending' AND ge.scheduled_at <= now() AND i.status = 'active'
        ORDER BY ge.scheduled_at ASC LIMIT 1 FOR UPDATE OF ge SKIP LOCKED`);
      if (!due.rowCount) { await client.query('COMMIT'); return settled; }
      const gain = due.rows[0];
      await applyWalletMutation(client, { userId: gain.user_id, type: 'gain', bucket: 'available', amountXof: Number(gain.amount_xof), reference: `GAIN-${gain.id}`, idempotencyKey: gain.id, reason: 'Gain d’investissement', metadata: { investmentId: gain.investment_id, gainEventId: gain.id } });
      await client.query(`UPDATE investment_gain_events SET status = 'completed', credited_at = now() WHERE id = $1`, [gain.id]);
      const remaining = await client.query(`SELECT count(*)::int AS count FROM investment_gain_events WHERE investment_id = $1 AND status = 'pending'`, [gain.investment_id]);
      await client.query(`UPDATE investments SET gains_received_xof = gains_received_xof + $1, next_gain_at = (SELECT min(scheduled_at) FROM investment_gain_events WHERE investment_id = $2 AND status = 'pending'), status = CASE WHEN $3 = 0 THEN 'completed' ELSE 'active' END WHERE id = $2`, [gain.amount_xof, gain.investment_id, remaining.rows[0].count]);
      await client.query('COMMIT'); settled += 1;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

if (process.argv[1]?.endsWith('settle-gains.js')) {
  settleDueGains().then((count) => { console.log(`Settled ${count} gain event(s).`); }).finally(closeDatabase);
}
