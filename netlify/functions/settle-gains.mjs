import { settleDueGains } from '../../apps/api/src/jobs/settle-gains.js';

// Toutes les heures à :15 UTC. Ne ferme pas le pool : une fonction Netlify peut être réutilisée.
// Le traitement est idempotent : une échéance ne peut jamais être créditée deux fois.
export default async () => {
  const settled = await settleDueGains();
  console.info(`PX_MINERALS_GAINS_SETTLED count=${settled}`);
  return Response.json({ settled });
};

export const config = { schedule: '15 * * * *' };
