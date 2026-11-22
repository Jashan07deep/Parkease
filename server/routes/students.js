const router = require('express').Router();
const pool = require('../db/pool');
const { HttpError, str } = require('../http');

const ID_RE = /^[A-Za-z0-9_-]{3,20}$/;
const studentId = (v) => {
  const s = str(v, 'Student ID', { max: 20 }).toUpperCase();
  if (!ID_RE.test(s)) throw new HttpError(400, 'Student ID may only contain letters, numbers, - and _ (3-20 chars).');
  return s;
};

router.get('/:id', async (req, res) => {
  const [[row]] = await pool.query(
    'SELECT student_id AS studentId, full_name AS fullName, department, email FROM students WHERE student_id = ?',
    [studentId(req.params.id)]);
  if (!row) throw new HttpError(404, 'No student with that ID.');
  res.json(row);
});

// Create or update (sign-in and profile edit share this endpoint)
router.put('/:id', async (req, res) => {
  const id = studentId(req.params.id);
  const fullName = str(req.body.fullName, 'Full name', { max: 80 });
  const department = str(req.body.department, 'Department', { max: 80, optional: true });
  const email = str(req.body.email, 'Email', { max: 120, optional: true });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email looks invalid.');
  try {
    await pool.query(
      `INSERT INTO students (student_id, full_name, department, email) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), department = VALUES(department), email = VALUES(email)`,
      [id, fullName, department, email]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That email is already used by another student.');
    throw e;
  }
  res.json({ studentId: id, fullName, department, email });
});

module.exports = router;
