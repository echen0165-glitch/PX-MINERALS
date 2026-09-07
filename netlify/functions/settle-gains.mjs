import { settleDueGains } from '../../apps/api/src/jobs/settle-gains.js';
import { closeDatabase } from '../../apps/api/src/config/database.js';

// Toutes les heures à :15 UTC. Le traitement est idempotent : une échéance n’est jamais créditée deux fois.
export default async () => {
  try {
    const settled = await settleDueGains();
    return Response.json({ settled });
  } finally {
    await closeDatabase();
  }
};

export const config = { schedule: '15 * * * *' };
