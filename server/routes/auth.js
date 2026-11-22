const router = require('express').Router();
const pool = require('../db/pool');
const { HttpError, str } = require('../http');
const A = require('../auth');

const ID_RE = /^[A-Za-z0-9_-]{3,20}$/;
const studentId = (v) => {
  const s = str(v, 'Student ID', { max: 20 }).toUpperCase();
  if (!ID_RE.test(s)) throw new HttpError(400, 'Student ID may only contain letters, numbers, - and _ (3-20 characters).');
  return s;
};
const optionalEmail = (v) => {
  const email = str(v, 'Email', { max: 120, optional: true });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email looks invalid.');
  return email;
};

// brute-force guard: 8 failed logins per 10 min per (ip + student id)
const fails = new Map();
const key = (req, id) => `${req.ip}|${id}`;
const locked = (k) => { const now = Date.now(); const l = (fails.get(k) || []).filter((t) => now - t < 600000); fails.set(k, l); return l.length >= 8; };

router.post('/register', async (req, res) => {
  const id = studentId(req.body.studentId);
  const fullName = str(req.body.fullName, 'Full name', { max: 80 });
  const department = str(req.body.department, 'Department', { max: 80, optional: true });
  const email = optionalEmail(req.body.email);
  A.checkPasswordRules(req.body.password);
  const hash = A.hashPassword(req.body.password);

  const [[existing]] = await pool.query('SELECT password_hash FROM students WHERE student_id = ?', [id]);
  try {
    if (!existing) {
      await pool.query('INSERT INTO students (student_id, full_name, department, email, password_hash) VALUES (?,?,?,?,?)',
        [id, fullName, department, email, hash]);
    } else if (!existing.password_hash) {
      // Account created before passwords existed: the first person to set a password claims it.
      await pool.query('UPDATE students SET full_name=?, department=?, email=?, password_hash=? WHERE student_id=? AND password_hash IS NULL',
        [fullName, department, email, hash, id]);
    } else {
      throw new HttpError(409, 'That student ID is already registered. Sign in instead.');
    }
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That email is already used by another student.');
    throw e;
  }
  res.status(201).json({ token: await A.createSession(id), student: { studentId: id, fullName, department, email } });
});

router.post('/login', async (req, res) => {
  const id = studentId(req.body.studentId);
  const k = key(req, id);
  if (locked(k)) throw new HttpError(429, 'Too many wrong attempts. Try again in a few minutes.');
  const [[row]] = await pool.query(
    'SELECT student_id AS studentId, full_name AS fullName, department, email, password_hash AS hash FROM students WHERE student_id = ?', [id]);
  // same message and same work for "no such ID" and "wrong password", so IDs cannot be probed
  const ok = A.verifyPassword(String(req.body.password ?? ''), row?.hash ?? 'aa:' + '00'.repeat(64));
  if (!row || !ok) {
    fails.get(k).push(Date.now());
    throw new HttpError(401, 'Student ID or password is incorrect.');
  }
  fails.delete(k);
  const { hash, ...student } = row;
  res.json({ token: await A.createSession(id), student });
});

router.post('/logout', async (req, res) => {
  const t = A.bearer(req);
  if (t) await A.destroySession(t);
  res.json({ ok: true });
});

router.get('/me', A.requireStudent, (req, res) => res.json(req.student));

router.put('/me', A.requireStudent, async (req, res) => {
  const fullName = str(req.body.fullName, 'Full name', { max: 80 });
  const department = str(req.body.department, 'Department', { max: 80, optional: true });
  const email = optionalEmail(req.body.email);
  try {
    await pool.query('UPDATE students SET full_name=?, department=?, email=? WHERE student_id=?', [fullName, department, email, req.student.studentId]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That email is already used by another student.');
    throw e;
  }
  res.json({ studentId: req.student.studentId, fullName, department, email });
});

router.put('/password', A.requireStudent, async (req, res) => {
  const [[row]] = await pool.query('SELECT password_hash AS hash FROM students WHERE student_id = ?', [req.student.studentId]);
  if (!A.verifyPassword(String(req.body.currentPassword ?? ''), row?.hash)) throw new HttpError(403, 'Current password is wrong.');
  A.checkPasswordRules(req.body.newPassword);
  await pool.query('UPDATE students SET password_hash = ? WHERE student_id = ?', [A.hashPassword(req.body.newPassword), req.student.studentId]);
  // sign out every other device
  await pool.query('DELETE FROM sessions WHERE student_id = ? AND token_hash <> SHA2(?, 256)', [req.student.studentId, A.bearer(req)]);
  res.json({ ok: true });
});

module.exports = router;
