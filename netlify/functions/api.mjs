import serverless from 'serverless-http';
import { createApp } from '../../apps/api/src/app.js';

// Netlify exécute l’API à la demande ; les routes Express existantes restent inchangées.
const app = createApp();

export const handler = serverless(app);
