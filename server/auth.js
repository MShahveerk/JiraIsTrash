import crypto from 'node:crypto';

const PASSCODE = process.env.APP_PASSCODE || '';
const SECRET = process.env.SESSION_SECRET || PASSCODE || 'forgeboard-dev-secret';
const COOKIE = 'fb_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export const authEnabled = () => Boolean(PASSCODE);

function sessionToken() {
  return crypto.createHmac('sha256', SECRET).update('forgeboard-session-v1').digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export function isAuthed(req) {
  if (!authEnabled()) return true;
  const cookie = parseCookies(req.headers.cookie || '')[COOKIE];
  return Boolean(cookie) && safeEqual(cookie, sessionToken());
}

export function checkPasscode(input) {
  return authEnabled() && safeEqual(String(input || ''), PASSCODE);
}

export function setSessionCookie(req, res) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const flags = [
    `${COOKIE}=${sessionToken()}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE}`,
  ];
  if (secure) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Authentication required' });
}
