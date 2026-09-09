import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { pool } from '../../config/database.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './mailer.js';
import { generateNumericCode, hashSecret, passwordIsValid, verifySecret } from './passwords.js';
import { clearSessionCookie, createSession, requireAuthenticatedUser, revokeSession, sessionContext, sessionCookieName, setSessionCookie } from './session.js';
import { markSecondFactorVerified } from './session.js';
import * as OTPAuth from 'otpauth';
import { applyWalletMutation } from '../wallet/ledger.js';
import { notify } from '../notifications/service.js';

export const authRouter = Router();
const sensitiveLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Les fonctions Netlify transmettent l’adresse visiteur dans ces en-têtes, pas dans request.ip.
  keyGenerator: (request) => request.get('x-nf-client-connection-ip')
    ?? request.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'netlify-anonymous'
});
const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
  username: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/), birthDate: z.coerce.date(),
  waveNumber: z.string().trim().min(8).max(32), email: z.string().trim().email().max(320),
  password: z.string(), passwordConfirmation: z.string(), acceptedTerms: z.literal(true), referralCode: z.string().trim().max(32).optional(), avatarKey: z.enum(['crystal','iron','gold','cobalt','lithium','diamond']).optional()
}).superRefine((value, context) => {
  if (!passwordIsValid(value.password)) context.addIssue({ code: 'custom', path: ['password'], message: 'Le mot de passe doit contenir au moins 10 caractères, une lettre et un chiffre.' });
  if (value.password !== value.passwordConfirmation) context.addIssue({ code: 'custom', path: ['passwordConfirmation'], message: 'Les mots de passe ne correspondent pas.' });
  if (value.birthDate > new Date()) context.addIssue({ code: 'custom', path: ['birthDate'], message: 'Date de naissance invalide.' });
});

function parse(schema, payload, response) {
  const result = schema.safeParse(payload);
  if (!result.success) { response.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Informations invalides.', details: result.error.flatten() } }); return null; }
  return result.data;
}

async function issueCode(table, userId, email, sender) {
  const code = generateNumericCode();
  const codeHash = await hashSecret(code);
  await pool.query(`UPDATE ${table} SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [userId]);
  await pool.query(`INSERT INTO ${table} (user_id, code_hash, expires_at) VALUES ($1, $2, now() + interval '15 minutes')`, [userId, codeHash]);
  await sender({ email, code });
}

authRouter.post('/register', sensitiveLimit, async (request, response, next) => {
  const input = parse(registerSchema, request.body, response); if (!input) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const referral = input.referralCode ? await client.query('SELECT user_id FROM referral_codes WHERE code = $1', [input.referralCode]) : null;
    if (input.referralCode && referral.rowCount !== 1) { await client.query('ROLLBACK'); return response.status(422).json({ error: { code: 'INVALID_REFERRAL', message: 'Code de parrainage invalide.' } }); }
    const passwordHash = await hashSecret(input.password);
    const user = await client.query(
      `INSERT INTO users (first_name, last_name, username, email, password_hash, birth_date, wave_number, client_code, avatar_key)
       VALUES ($1,$2,$3,lower($4),$5,$6,$7,$8,$9) RETURNING id, email`,
      [input.firstName, input.lastName, input.username, input.email, passwordHash, input.birthDate, input.waveNumber, `PX-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`, input.avatarKey ?? 'crystal']
    );
    await client.query('INSERT INTO wallets (user_id) VALUES ($1)', [user.rows[0].id]);
    const bonusTransactionId = await applyWalletMutation(client, { userId: user.rows[0].id, type: 'bonus', bucket: 'available', amountXof: 1500, deltas: { available: 1500 }, reason: 'Bonus de bienvenue à l’inscription', metadata: { kind: 'signup_bonus' } });
    await client.query('INSERT INTO signup_bonus_grants (user_id, amount_xof, transaction_id) VALUES ($1, 1500, $2)', [user.rows[0].id, bonusTransactionId]);
    if (referral) {
      const direct = referral.rows[0].user_id;
      await client.query('INSERT INTO referrals (referrer_id, referred_user_id, level) VALUES ($1, $2, 1)', [direct, user.rows[0].id]);
      const ancestors = await client.query('SELECT referrer_id, level FROM referrals WHERE referred_user_id = $1 ORDER BY level LIMIT 2', [direct]);
      for (const ancestor of ancestors.rows) await client.query('INSERT INTO referrals (referrer_id, referred_user_id, level) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [ancestor.referrer_id, user.rows[0].id, ancestor.level + 1]);
    }
    await client.query('COMMIT');
    await issueCode('email_verifications', user.rows[0].id, user.rows[0].email, sendVerificationEmail);
    return response.status(201).json({ message: 'Compte créé. Vérifiez votre e-mail.', email: user.rows[0].email });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return response.status(409).json({ error: { code: 'ACCOUNT_EXISTS', message: 'Cet e-mail ou ce pseudo est déjà utilisé.' } });
    return next(error);
  } finally { client.release(); }
});

authRouter.get('/username-availability', async (request, response, next) => {
  try { const username = z.string().regex(/^[A-Za-z0-9_-]{3,32}$/).safeParse(request.query.username); if (!username.success) return response.status(422).json({ available: false }); const result = await pool.query('SELECT 1 FROM users WHERE username = $1', [username.data]); return response.json({ available: result.rowCount === 0 }); } catch (error) { return next(error); }
});

const codeSchema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) });
const bootstrapAdminSchema = z.object({
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
  username: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/), email: z.string().trim().email().max(320),
  waveNumber: z.string().trim().min(8).max(32), password: z.string(), passwordConfirmation: z.string()
}).superRefine((value, context) => {
  if (!passwordIsValid(value.password)) context.addIssue({ code: 'custom', path: ['password'], message: 'Le mot de passe doit contenir au moins 10 caractères, une lettre et un chiffre.' });
  if (value.password !== value.passwordConfirmation) context.addIssue({ code: 'custom', path: ['passwordConfirmation'], message: 'Les mots de passe ne correspondent pas.' });
});

authRouter.post('/bootstrap-admin', sensitiveLimit, async (request, response, next) => {
  const input = parse(bootstrapAdminSchema, request.body, response); if (!input) return;
  const suppliedToken = request.get('x-admin-setup-token') ?? '';
  const expectedToken = env.ADMIN_SETUP_TOKEN ?? '';
  const tokenValid = suppliedToken.length === expectedToken.length && expectedToken.length > 0 && timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(expectedToken));
  if (!tokenValid) return response.status(403).json({ error: { code: 'SETUP_FORBIDDEN', message: 'Secret de configuration invalide.' } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if ((await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")).rowCount) {
      await client.query('ROLLBACK'); return response.status(409).json({ error: { code: 'ADMIN_EXISTS', message: 'Le premier administrateur existe déjà.' } });
    }
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const user = await client.query(
      `INSERT INTO users (role,first_name,last_name,username,email,password_hash,birth_date,wave_number,client_code,status,email_verified_at)
       VALUES ('admin',$1,$2,$3,lower($4),$5,'1970-01-01',$6,$7,'active',now()) RETURNING id`,
      [input.firstName, input.lastName, input.username, input.email, await hashSecret(input.password), input.waveNumber, `PX-ADMIN-${randomUUID().slice(0, 8).toUpperCase()}`]
    );
    await client.query('INSERT INTO admin_totp_credentials (user_id,secret) VALUES ($1,$2)', [user.rows[0].id, secret]);
    await client.query('COMMIT');
    return response.status(201).json({ message: 'Administrateur créé.', totpSecret: secret });
  } catch (error) { await client.query('ROLLBACK'); if (error.code === '23505') return response.status(409).json({ error: { code: 'ACCOUNT_EXISTS', message: 'Cet e-mail ou ce pseudo est déjà utilisé.' } }); return next(error); } finally { client.release(); }
});

authRouter.post('/verify-email', sensitiveLimit, async (request, response, next) => {
  const input = parse(codeSchema, request.body, response); if (!input) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const verification = await client.query(`SELECT ev.*, u.email FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = lower($1) AND ev.consumed_at IS NULL ORDER BY ev.created_at DESC LIMIT 1 FOR UPDATE`, [input.email]);
    const verificationRow = verification.rows[0];
    const codeMatches = verification.rowCount === 1 && await verifySecret(input.code, verificationRow.code_hash);
    if (verification.rowCount !== 1 || verificationRow.expires_at < new Date() || verificationRow.attempts >= 5 || !codeMatches) {
      const reason = verification.rowCount !== 1 ? 'missing'
        : verificationRow.expires_at < new Date() ? 'expired'
          : verificationRow.attempts >= 5 ? 'max_attempts' : 'mismatch';
      console.info(`PX_MINERALS_VERIFICATION_REJECTED reason=${reason}`);
      if (verification.rowCount) await client.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [verification.rows[0].id]);
      await client.query('COMMIT'); return response.status(422).json({ error: { code: 'INVALID_CODE', message: 'Code invalide ou expiré.' } });
    }
    const userId = verification.rows[0].user_id;
    await client.query('UPDATE email_verifications SET consumed_at = now() WHERE id = $1', [verification.rows[0].id]);
    await client.query("UPDATE users SET status = 'active', email_verified_at = now(), updated_at = now() WHERE id = $1", [userId]);
    await client.query('INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)', [userId, `PX${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`]);
    await notify(client, { userId, title: 'Compte activé', message: 'Votre e-mail a été vérifié. Votre portefeuille et votre bonus de bienvenue sont disponibles.', link: '#dashboard' });
    await client.query('COMMIT');
    return response.json({ message: 'E-mail vérifié. Votre compte est actif.' });
  } catch (error) { await client.query('ROLLBACK'); return next(error); } finally { client.release(); }
});

authRouter.post('/resend-verification', sensitiveLimit, async (request, response, next) => {
  const input = parse(z.object({ email: z.string().email() }), request.body, response); if (!input) return;
  try { const user = await pool.query("SELECT id, email FROM users WHERE email = lower($1) AND status = 'pending_email'", [input.email]); if (user.rowCount) await issueCode('email_verifications', user.rows[0].id, user.rows[0].email, sendVerificationEmail); return response.status(202).json({ message: 'Si le compte est en attente, un code a été envoyé.' }); } catch (error) { return next(error); }
});

authRouter.post('/login', sensitiveLimit, async (request, response, next) => {
  const input = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), request.body, response); if (!input) return;
  try {
    const found = await pool.query('SELECT id, password_hash, status, role FROM users WHERE email = lower($1)', [input.email]);
    if (found.rowCount !== 1 || !(await verifySecret(input.password, found.rows[0].password_hash))) return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou mot de passe incorrect.' } });
    if (found.rows[0].status !== 'active') return response.status(403).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'Veuillez vérifier votre e-mail ou contacter le support.' } });
    const context = found.rows[0].role === 'admin' ? 'admin' : 'client';
    const token = await createSession(found.rows[0].id, request); setSessionCookie(response, token, context);
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [found.rows[0].id]);
    return response.json({ message: 'Connexion réussie.' });
  } catch (error) { return next(error); }
});

authRouter.post('/logout', async (request, response, next) => { try { const context = sessionContext(request); await revokeSession(request.cookies[sessionCookieName(context)]); clearSessionCookie(response, context); return response.status(204).send(); } catch (error) { return next(error); } });
authRouter.post('/admin/verify-2fa', sensitiveLimit, requireAuthenticatedUser, async (request, response, next) => {
  const code = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(request.body); if (!code.success) return response.status(422).json({ error: { code: 'INVALID_2FA_CODE', message: 'Code invalide.' } });
  if (request.user.role !== 'admin') return response.status(403).json({ error: { code: 'ADMIN_ONLY', message: 'Accès administrateur requis.' } });
  try { const credential = await pool.query('SELECT secret FROM admin_totp_credentials WHERE user_id = $1', [request.user.id]); if (!credential.rowCount) return response.status(403).json({ error: { code: '2FA_NOT_CONFIGURED', message: '2FA administrateur non configuré.' } }); const totp = new OTPAuth.TOTP({ issuer: 'PX MINERALS', algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(credential.rows[0].secret) }); if (totp.validate({ token: code.data.code, window: 1 }) === null) return response.status(401).json({ error: { code: 'INVALID_2FA_CODE', message: 'Code 2FA incorrect.' } }); await markSecondFactorVerified(request.cookies[sessionCookieName('admin')]); await pool.query('INSERT INTO security_logs (user_id,event_type,result,ip_address,user_agent) VALUES ($1,$2,$3,$4,$5)', [request.user.id,'admin_2fa_verified','success',request.ip,request.get('user-agent')]); return response.status(204).send(); } catch (error) { return next(error); }
});
authRouter.get('/me', requireAuthenticatedUser, (request, response) => response.json({ user: request.user }));

authRouter.post('/forgot-password', sensitiveLimit, async (request, response, next) => {
  const input = parse(z.object({ email: z.string().email() }), request.body, response); if (!input) return;
  try { const user = await pool.query("SELECT id, email FROM users WHERE email = lower($1) AND status = 'active'", [input.email]); if (user.rowCount) await issueCode('password_resets', user.rows[0].id, user.rows[0].email, sendPasswordResetEmail); return response.status(202).json({ message: 'Si ce compte existe, un code a été envoyé.' }); } catch (error) { return next(error); }
});

authRouter.post('/reset-password', sensitiveLimit, async (request, response, next) => {
  const input = parse(z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/), password: z.string(), passwordConfirmation: z.string() }).superRefine((v, ctx) => { if (!passwordIsValid(v.password)) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Mot de passe insuffisant.' }); if (v.password !== v.passwordConfirmation) ctx.addIssue({ code: 'custom', path: ['passwordConfirmation'], message: 'Les mots de passe ne correspondent pas.' }); }), request.body, response); if (!input) return;
  const client = await pool.connect();
  try { await client.query('BEGIN'); const reset = await client.query(`SELECT pr.*, u.id AS user_id FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.email = lower($1) AND pr.consumed_at IS NULL ORDER BY pr.created_at DESC LIMIT 1 FOR UPDATE`, [input.email]); if (reset.rowCount !== 1 || reset.rows[0].expires_at < new Date() || reset.rows[0].attempts >= 5 || !(await verifySecret(input.code, reset.rows[0].code_hash))) { if (reset.rowCount) await client.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [reset.rows[0].id]); await client.query('COMMIT'); return response.status(422).json({ error: { code: 'INVALID_CODE', message: 'Code invalide ou expiré.' } }); } await client.query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [await hashSecret(input.password), reset.rows[0].user_id]); await client.query('UPDATE password_resets SET consumed_at = now() WHERE id = $1', [reset.rows[0].id]); await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [reset.rows[0].user_id]); await client.query('COMMIT'); return response.json({ message: 'Mot de passe modifié. Connectez-vous à nouveau.' }); } catch (error) { await client.query('ROLLBACK'); return next(error); } finally { client.release(); }
});
