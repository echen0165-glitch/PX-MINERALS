import { settleDueGains } from '../../apps/api/src/jobs/settle-gains.js';
import { schedule } from '@netlify/functions';

// Toutes les heures à :15 UTC. Ne ferme pas le pool : une fonction Netlify peut être réutilisée.
// Le traitement est idempotent : une échéance ne peut jamais être créditée deux fois.
export const handler = schedule('15 * * * *', async () => {
  const settled = await settleDueGains();
  console.info(`PX_MINERALS_GAINS_SETTLED count=${settled}`);
  return { statusCode: 200, body: JSON.stringify({ settled }) };
});
