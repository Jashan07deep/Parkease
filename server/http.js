const crypto = require('crypto');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// --- tiny validators -------------------------------------------------------
const str = (v, field, { max = 100, min = 1, optional = false } = {}) => {
  if (v === undefined || v === null || String(v).trim() === '') {
    if (optional) return null;
    throw new HttpError(400, `${field} is required.`);
  }
  const s = String(v).trim();
  if (s.length < min || s.length > max) throw new HttpError(400, `${field} must be ${min}-${max} characters.`);
  return s;
};
const oneOf = (v, field, allowed) => {
  if (!allowed.includes(v)) throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}.`);
  return v;
};
const coord = (v, field, lim) => {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || Math.abs(n) > lim)
    throw new HttpError(400, `${field} is not a valid coordinate.`);
  return n;
};
const intId = (v, field = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${field} is invalid.`);
  return n;
};

// --- admin sessions (in-memory, fine for a single-process project) ----------
const sessions = new Map(); // token -> expiry ms
const SESSION_MS = 8 * 60 * 60 * 1000;

const issueToken = () => {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
};
const isAdminToken = (token) => {
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
};
const requireAdmin = (req, _res, next) => {
  if (!isAdminToken(req.get('x-admin-token'))) throw new HttpError(401, 'Admin access required.');
  next();
};
const pinMatches = (given) => {
  const expected = process.env.ADMIN_PIN || '';
  if (!expected) return false;
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};

module.exports = { HttpError, str, oneOf, coord, intId, issueToken, isAdminToken, requireAdmin, pinMatches };
