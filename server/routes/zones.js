const router = require('express').Router();
const pool = require('../db/pool');
const { HttpError, str, intId, requireAdmin } = require('../http');

const LIST_SQL = `
  SELECT z.zone_id AS id, z.zone_name AS name, z.description,
         COUNT(s.slot_id) AS total,
         COALESCE(SUM(s.state = 'Open' AND b.booking_id IS NULL), 0) AS available,
         COALESCE(SUM(b.booking_id IS NOT NULL), 0) AS booked,
         COALESCE(SUM(s.state = 'Maintenance'), 0) AS maintenance
  FROM parking_zones z
  LEFT JOIN parking_slots s ON s.zone_id = z.zone_id
  LEFT JOIN bookings b ON b.slot_id = s.slot_id AND b.status = 'Active'
  GROUP BY z.zone_id
  ORDER BY z.zone_name`;

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(LIST_SQL);
  res.json(rows.map((r) => ({ ...r, total: +r.total, available: +r.available, booked: +r.booked, maintenance: +r.maintenance })));
});

router.post('/', requireAdmin, async (req, res) => {
  const name = str(req.body.name, 'Zone name', { max: 60 });
  const description = str(req.body.description, 'Description', { max: 200, optional: true });
  try {
    const [r] = await pool.query('INSERT INTO parking_zones (zone_name, description) VALUES (?, ?)', [name, description]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, `A zone named "${name}" already exists.`);
    throw e;
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const id = intId(req.params.id);
  const name = str(req.body.name, 'Zone name', { max: 60 });
  const description = str(req.body.description, 'Description', { max: 200, optional: true });
  try {
    const [r] = await pool.query('UPDATE parking_zones SET zone_name = ?, description = ? WHERE zone_id = ?', [name, description, id]);
    if (!r.affectedRows) throw new HttpError(404, 'Zone not found.');
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, `A zone named "${name}" already exists.`);
    throw e;
  }
});

// Spots in a deleted zone are kept and simply become "unzoned".
router.delete('/:id', requireAdmin, async (req, res) => {
  const [r] = await pool.query('DELETE FROM parking_zones WHERE zone_id = ?', [intId(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Zone not found.');
  res.json({ ok: true });
});

module.exports = router;
