const router = require('express').Router();
const pool = require('../db/pool');
const { HttpError, issueToken, isAdminToken, pinMatches, requireAdmin } = require('../http');

// very small brute-force guard: 8 attempts / 10 min / IP
const attempts = new Map();
const tooMany = (ip) => {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 600000);
  attempts.set(ip, list);
  return list.length >= 8;
};

router.post('/login', (req, res) => {
  if (!process.env.ADMIN_PIN) throw new HttpError(503, 'ADMIN_PIN is not set on the server (.env).');
  if (tooMany(req.ip)) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  if (!pinMatches(req.body?.pin ?? '')) {
    attempts.get(req.ip).push(Date.now());
    throw new HttpError(401, 'Wrong PIN.');
  }
  res.json({ token: issueToken() });
});

router.get('/session', (req, res) => {
  res.json({ admin: isAdminToken(req.get('x-admin-token')) });
});

// Numbers for the admin overview: totals plus bookings per day for the last 7 days.
router.get('/stats', requireAdmin, async (_req, res) => {
  const [[t]] = await pool.query(`
    SELECT (SELECT COUNT(*) FROM parking_slots) AS spots,
           (SELECT COUNT(*) FROM parking_slots WHERE state = 'Maintenance') AS closed,
           (SELECT COUNT(*) FROM bookings WHERE status = 'Active') AS active,
           (SELECT COUNT(*) FROM students) AS students,
           (SELECT COUNT(*) FROM bookings WHERE DATE(booked_at) = CURDATE()) AS today`);
  const [days] = await pool.query(`
    SELECT DATE_FORMAT(booked_at, '%Y-%m-%d') AS day, COUNT(*) AS n
    FROM bookings WHERE booked_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY day ORDER BY day`);
  res.json({ spots: +t.spots, closed: +t.closed, active: +t.active, students: +t.students, today: +t.today,
    perDay: days.map((d) => ({ day: d.day, n: +d.n })) });
});

module.exports = router;
