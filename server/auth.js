const crypto = require('crypto');
const pool = require('./db/pool');
const { HttpError } = require('./http');

const SESSION_DAYS = 30;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// --- passwords (scrypt, per-user random salt) -------------------------------
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
};
const verifyPassword = (password, stored) => {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
};
const checkPasswordRules = (pw) => {
  if (typeof pw !== 'string' || pw.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (pw.length > 100) throw new HttpError(400, 'Password is too long.');
};

// --- sessions ----------------------------------------------------------------
const createSession = async (studentId) => {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO sessions (token_hash, student_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [sha256(token), studentId, SESSION_DAYS]);
  pool.query('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {}); // opportunistic cleanup
  return token;
};
const destroySession = (token) => pool.query('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);

const bearer = (req) => {
  const h = req.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};

const lookup = async (token) => {
  if (!token) return null;
  const [[row]] = await pool.query(
    `SELECT s.student_id AS studentId, s.full_name AS fullName, s.department, s.email
     FROM sessions x JOIN students s ON s.student_id = x.student_id
     WHERE x.token_hash = ? AND x.expires_at > NOW()`, [sha256(token)]);
  return row || null;
};

// attaches req.student when a valid token is present; never rejects
const optionalStudent = async (req, _res, next) => { req.student = await lookup(bearer(req)); next(); };
const requireStudent = async (req, _res, next) => {
  req.student = await lookup(bearer(req));
  if (!req.student) throw new HttpError(401, 'Please sign in.');
  next();
};

module.exports = { hashPassword, verifyPassword, checkPasswordRules, createSession, destroySession, bearer, optionalStudent, requireStudent };
