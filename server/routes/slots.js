const router = require('express').Router();
const pool = require('../db/pool');
const { HttpError, str, oneOf, coord, intId, requireAdmin, isAdminToken } = require('../http');
const { optionalStudent } = require('../auth');

const TYPES = ['Any', 'Two-wheeler', 'Four-wheeler'];
const STATES = ['Open', 'Maintenance'];

// "status" is what the UI shows: Available / Booked / Maintenance. It is derived, never stored.
const SELECT = `
  SELECT s.slot_id AS id, s.slot_name AS name, s.zone_id AS zoneId, z.zone_name AS zoneName,
         s.vehicle_type AS vehicleType, s.latitude AS lat, s.longitude AS lng, s.state,
         CASE WHEN s.state = 'Maintenance' THEN 'Maintenance'
              WHEN b.booking_id IS NOT NULL THEN 'Booked' ELSE 'Available' END AS status,
         b.student_id AS bookedBy
  FROM parking_slots s
  LEFT JOIN parking_zones z ON z.zone_id = s.zone_id
  LEFT JOIN bookings b ON b.slot_id = s.slot_id AND b.status = 'Active'`;

const fields = (body) => ({
  name: str(body.name, 'Spot name', { max: 40 }),
  zoneId: body.zoneId ? intId(body.zoneId, 'zoneId') : null,
  vehicleType: oneOf(body.vehicleType ?? 'Any', 'vehicleType', TYPES),
  lat: coord(body.lat, 'Latitude', 90),
  lng: coord(body.lng, 'Longitude', 180),
});

const handleDb = (e, name) => {
  if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, `A spot named "${name}" already exists.`);
  if (e.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(400, 'That zone does not exist.');
  throw e;
};

router.get('/', optionalStudent, async (req, res) => {
  const [rows] = await pool.query(`${SELECT} ORDER BY s.slot_name`);
  // Only the owner (and admin tools) need to know who booked; expose a boolean to everyone else.
  const me = req.student?.studentId || '';
  const isAdmin = isAdminToken(req.get('x-admin-token'));
  res.json(rows.map(({ bookedBy, ...s }) => ({ ...s, mine: !!me && bookedBy === me, ...(isAdmin ? { bookedBy } : {}) })));
});

router.post('/', requireAdmin, async (req, res) => {
  const f = fields(req.body);
  try {
    const [r] = await pool.query(
      'INSERT INTO parking_slots (slot_name, zone_id, vehicle_type, latitude, longitude) VALUES (?,?,?,?,?)',
      [f.name, f.zoneId, f.vehicleType, f.lat, f.lng]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { handleDb(e, f.name); }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const id = intId(req.params.id);
  const f = fields(req.body);
  const state = oneOf(req.body.state ?? 'Open', 'state', STATES);
  try {
    const [r] = await pool.query(
      'UPDATE parking_slots SET slot_name=?, zone_id=?, vehicle_type=?, latitude=?, longitude=?, state=? WHERE slot_id=?',
      [f.name, f.zoneId, f.vehicleType, f.lat, f.lng, state, id]);
    if (!r.affectedRows) throw new HttpError(404, 'Spot not found.');
    // keep the history snapshot of active bookings in sync with a rename
    await pool.query("UPDATE bookings SET slot_name = ? WHERE slot_id = ? AND status = 'Active'", [f.name, id]);
    res.json({ ok: true });
  } catch (e) { handleDb(e, f.name); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = intId(req.params.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[active]] = await conn.query("SELECT booking_id FROM bookings WHERE slot_id = ? AND status = 'Active' FOR UPDATE", [id]);
    if (active) throw new HttpError(409, 'This spot has an active booking. Cancel it first.');
    await conn.query('UPDATE bookings SET slot_id = NULL WHERE slot_id = ?', [id]); // history keeps slot_name
    const [r] = await conn.query('DELETE FROM parking_slots WHERE slot_id = ?', [id]);
    if (!r.affectedRows) throw new HttpError(404, 'Spot not found.');
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

module.exports = router;
