import { env } from '../../config/env.js';

async function sendWithBrevo({ email, subject, htmlContent, textContent }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': env.EMAIL_API_KEY },
    body: JSON.stringify({ sender: { email: env.EMAIL_FROM, name: 'PX MINERALS' }, to: [{ email }], subject, htmlContent, textContent })
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error({ status: response.status, detail: detail.slice(0, 500) }, 'Brevo delivery failed');
    throw new Error('EMAIL_DELIVERY_FAILED');
  }
}

async function deliver({ email, subject, htmlContent, textContent, code }) {
  if (!env.EMAIL_PROVIDER || !env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    if (env.NODE_ENV === 'production') throw new Error('EMAIL_NOT_CONFIGURED');
    console.info({ email, code }, 'Development verification code (never enabled in production)');
    return { delivery: 'development-log' };
  }
  if (env.EMAIL_PROVIDER.toLowerCase() === 'brevo') return sendWithBrevo({ email, subject, htmlContent, textContent });
  throw new Error('EMAIL_PROVIDER_NOT_IMPLEMENTED');
}

export async function sendVerificationEmail({ email, code }) {
  return deliver({
    email, code, subject: 'PX MINERALS — Vérifiez votre adresse e-mail',
    textContent: `Votre code de vérification PX MINERALS est : ${code}. Il expire dans 15 minutes. Ne le partagez avec personne.`,
    htmlContent: `<div style="font-family:Arial,sans-serif;color:#10254c"><h2>PX MINERALS</h2><p>Votre code de vérification est :</p><p style="font-size:28px;font-weight:700;letter-spacing:5px">${code}</p><p>Il expire dans 15 minutes. Ne le partagez avec personne.</p></div>`
  });
}

export async function sendPasswordResetEmail({ email, code }) {
  return deliver({
    email, code, subject: 'PX MINERALS — Réinitialisation de votre mot de passe',
    textContent: `Votre code de réinitialisation PX MINERALS est : ${code}. Il expire dans 15 minutes. Ne le partagez avec personne.`,
    htmlContent: `<div style="font-family:Arial,sans-serif;color:#10254c"><h2>PX MINERALS</h2><p>Votre code de réinitialisation est :</p><p style="font-size:28px;font-weight:700;letter-spacing:5px">${code}</p><p>Il expire dans 15 minutes. Ne le partagez avec personne.</p></div>`
  });
}
