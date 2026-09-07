import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function passwordIsValid(password) {
  return typeof password === 'string' && password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function hashSecret(secret) {
  const salt = randomBytes(16).toString('base64url');
  const hash = await scrypt(secret, salt, KEY_LENGTH);
  return `scrypt$${salt}$${Buffer.from(hash).toString('base64url')}`;
}

export async function verifySecret(secret, stored) {
  const [algorithm, salt, encodedHash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, 'base64url');
  const actual = Buffer.from(await scrypt(secret, salt, expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generateNumericCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateSessionToken() {
  return randomBytes(48).toString('base64url');
}
