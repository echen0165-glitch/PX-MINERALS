import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { pool } from '../../config/database.js';
import { generateSessionToken } from './passwords.js';

const CLIENT_SESSION_COOKIE = 'px_client_session';
const ADMIN_SESSION_COOKIE = 'px_admin_session';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const IDLE_TIMEOUT_MINUTES = 24 * 60;

const tokenHash = (token) => createHash('sha256').update(token).digest('base64url');

export async function createSession(userId, request) {
  const token = generateSessionToken();
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '14 days')`,
    [userId, tokenHash(token), request.get('user-agent') ?? null, request.ip]
  );
  return token;
}
export async function markSecondFactorVerified(token) { if (token) await pool.query('UPDATE sessions SET second_factor_verified_at = now() WHERE token_hash = $1', [tokenHash(token)]); }

export function sessionContext(request) {
  const explicit = request.get('x-px-context');
  if (explicit === 'admin' || explicit === 'client') return explicit;
  return request.baseUrl === '/api/admin'
    || request.originalUrl?.startsWith('/api/admin')
    || request.originalUrl?.startsWith('/api/auth/admin/') ? 'admin' : 'client';
}
export function sessionCookieName(context = 'client') { return context === 'admin' ? ADMIN_SESSION_COOKIE : CLIENT_SESSION_COOKIE; }
export function setSessionCookie(response, token, context = 'client') {
  response.cookie(sessionCookieName(context), token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
    path: '/'
  });
}

export function clearSessionCookie(response, context = 'client') {
  response.clearCookie(sessionCookieName(context), { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
}

export async function requireAuthenticatedUser(request, response, next) {
  try {
    const context = sessionContext(request);
    const token = request.cookies[sessionCookieName(context)];
    if (!token) {
      console.info('PX_MINERALS_SESSION_REJECTED reason=missing_cookie');
      return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } });
    }
    const result = await pool.query(
      `SELECT u.id, u.role, u.status, u.email, u.username, u.client_code, s.second_factor_verified_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
         AND s.last_seen_at > now() - interval '${IDLE_TIMEOUT_MINUTES} minutes'`,
      [tokenHash(token)]
    );
    if (result.rowCount !== 1 || result.rows[0].status !== 'active') {
      console.info(`PX_MINERALS_SESSION_REJECTED reason=${result.rowCount !== 1 ? 'invalid_or_expired' : 'inactive_account'}`);
      return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session invalide.' } });
    }
    request.user = result.rows[0];
    await pool.query('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [tokenHash(token)]);
    // Une activité légitime prolonge la durée du cookie : le client ne perd pas sa session pendant un simple rafraîchissement.
    setSessionCookie(response, token, context);
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function revokeSession(token) {
  if (token) await pool.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash(token)]);
}
