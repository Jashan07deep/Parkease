const crypto = require('crypto');
const router = require('express').Router();
const pool = require('../db/pool');
const { HttpError, str, oneOf, intId, isAdminToken } = require('../http');
const { requireStudent, optionalStudent } = require('../auth');

const SELECT = `
  SELECT b.booking_id AS id, b.student_id AS studentId, st.full_name AS studentName,
         b.slot_id AS slotId, b.slot_name AS slotName, z.zone_name AS zoneName,
         b.vehicle_no AS vehicleNo, b.vehicle_type AS vehicleType, b.status,
         b.booked_at AS bookedAt, b.ended_at AS endedAt
  FROM bookings b
  JOIN students st ON st.student_id = b.student_id
  LEFT JOIN parking_slots s ON s.slot_id = b.slot_id
  LEFT JOIN parking_zones z ON z.zone_id = s.zone_id`;

const newId = () => 'PK' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);

// A signed-in student gets their own bookings. An admin token with ?all=1 gets everyone's.
router.get('/', optionalStudent, async (req, res) => {
  if (req.query.all && isAdminToken(req.get('x-admin-token'))) {
    const [rows] = await pool.query(`${SELECT} ORDER BY b.booked_at DESC LIMIT 500`);
    return res.json(rows);
  }
  if (!req.student) throw new HttpError(401, 'Please sign in.');
  const [rows] = await pool.query(`${SELECT} WHERE b.student_id = ? ORDER BY b.booked_at DESC LIMIT 200`, [req.student.studentId]);
  res.json(rows);
});

router.post('/', requireStudent, async (req, res) => {
  const studentId = req.student.studentId;
  const slotId = intId(req.body.slotId, 'slotId');
  const vehicleNo = str(req.body.vehicleNo, 'Vehicle number', { max: 20 }).toUpperCase().replace(/\s+/g, ' ');
  const vehicleType = oneOf(req.body.vehicleType, 'vehicleType', ['Two-wheeler', 'Four-wheeler']);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Row lock: two students clicking the same spot are serialised here.
    const [[slot]] = await conn.query(
      'SELECT slot_id, slot_name, vehicle_type, state FROM parking_slots WHERE slot_id = ? FOR UPDATE', [slotId]);
    if (!slot) throw new HttpError(404, 'Spot not found.');
    if (slot.state !== 'Open') throw new HttpError(409, `${slot.slot_name} is under maintenance.`);
    if (slot.vehicle_type !== 'Any' && slot.vehicle_type !== vehicleType)
      throw new HttpError(409, `${slot.slot_name} is reserved for ${slot.vehicle_type.toLowerCase()}s.`);

    const id = newId();
    try {
      await conn.query(
        `INSERT INTO bookings (booking_id, student_id, slot_id, slot_name, vehicle_no, vehicle_type)
         VALUES (?,?,?,?,?,?)`, [id, studentId, slot.slot_id, slot.slot_name, vehicleNo, vehicleType]);
    } catch (e) {
      // The UNIQUE keys on the generated columns are the final safety net.
      if (e.code === 'ER_DUP_ENTRY' && /uq_one_active_per_student/.test(e.message))
        throw new HttpError(409, 'You already have an active booking. Cancel or complete it first.');
      if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, `${slot.slot_name} was just taken by someone else.`);
      throw e;
    }
    await conn.commit();
    res.status(201).json({ id, slotName: slot.slot_name });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// cancel = changed my mind, complete = I have left. Both free the spot.
// Allowed for the booking's owner (signed in) or an admin.
const end = (status) => async (req, res) => {
  const id = str(req.params.id, 'Booking ID', { max: 12 });
  const admin = isAdminToken(req.get('x-admin-token'));
  if (!admin && !req.student) throw new HttpError(401, 'Please sign in.');
  const [[b]] = await pool.query('SELECT student_id, status FROM bookings WHERE booking_id = ?', [id]);
  if (!b) throw new HttpError(404, 'Booking not found.');
  if (!admin && b.student_id !== req.student.studentId) throw new HttpError(403, 'That booking belongs to another student.');
  if (b.status !== 'Active') throw new HttpError(409, `Booking is already ${b.status.toLowerCase()}.`);
  await pool.query("UPDATE bookings SET status = ?, ended_at = NOW() WHERE booking_id = ? AND status = 'Active'", [status, id]);
  res.json({ ok: true });
};
router.post('/:id/cancel', optionalStudent, end('Cancelled'));
router.post('/:id/complete', optionalStudent, end('Completed'));

module.exports = router;
