const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Jashan@07',
    database: 'parkease_db',
    waitForConnections: true,
    connectionLimit: 10
});

// 1. GET Right & Left side areas with live counts
app.get('/api/areas', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT a.area_id AS id, a.area_name AS name, a.location_desc AS location,
                   CAST(a.latitude AS FLOAT) AS latitude, CAST(a.longitude AS FLOAT) AS longitude,
                   COUNT(s.slot_id) AS total,
                   SUM(CASE WHEN s.status = 'Available' THEN 1 ELSE 0 END) AS available,
                   SUM(CASE WHEN s.status = 'Booked' THEN 1 ELSE 0 END) AS booked
            FROM parking_areas a
            LEFT JOIN parking_slots s ON a.area_id = s.area_id
            GROUP BY a.area_id
            ORDER BY FIELD(a.area_id, 'R', 'L')
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. GET all 100 slots (50 Right + 50 Left) with coordinates & active booking info
app.get('/api/slots', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT s.slot_id, s.area_id, s.side, a.area_name,
                   CAST(s.latitude AS FLOAT) AS latitude,
                   CAST(s.longitude AS FLOAT) AS longitude,
                   s.status, b.student_id, b.vehicle_no
            FROM parking_slots s
            JOIN parking_areas a ON s.area_id = a.area_id
            LEFT JOIN bookings b ON s.slot_id = b.slot_id AND b.status = 'Active'
            ORDER BY s.slot_id ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. GET all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT b.booking_id AS id, b.student_id AS student, a.area_name AS areaName,
                   s.area_id AS areaId, s.side, b.slot_id AS slot, b.vehicle_no AS vehicle,
                   b.vehicle_type AS type, b.status
            FROM bookings b
            JOIN parking_slots s ON b.slot_id = s.slot_id
            JOIN parking_areas a ON s.area_id = a.area_id
            ORDER BY b.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. POST book a slot with row lock so another student cannot take it
app.post('/api/bookings', async (req, res) => {
    const { student_id, vehicle_no, vehicle_type, slot_id } = req.body;
    const bookingId = 'PK' + String(Date.now()).slice(-6);
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [[slot]] = await conn.query(
            'SELECT status FROM parking_slots WHERE slot_id = ? FOR UPDATE',
            [slot_id]
        );

        if (!slot) {
            await conn.rollback();
            return res.status(404).json({ error: 'Slot not found.' });
        }

        if (slot.status !== 'Available') {
            await conn.rollback();
            return res.status(409).json({ error: `Slot ${slot_id} is already booked by another student.` });
        }

        await conn.query(`
            INSERT INTO students (student_id, vehicle_no)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE vehicle_no = VALUES(vehicle_no)
        `, [student_id, vehicle_no]);

        await conn.query(`
            INSERT INTO bookings (booking_id, student_id, slot_id, vehicle_no, vehicle_type, status)
            VALUES (?, ?, ?, ?, ?, 'Active')
        `, [bookingId, student_id, slot_id, vehicle_no, vehicle_type]);

        await conn.commit();
        res.json({ message: `Slot ${slot_id} booked for ${student_id}.`, bookingId, slot: slot_id });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// 5. POST cancel booking & release slot back to Available
app.post('/api/bookings/cancel', async (req, res) => {
    const { booking_id } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const [[booking]] = await conn.query('SELECT slot_id FROM bookings WHERE booking_id = ? FOR UPDATE', [booking_id]);
        if (booking) {
            await conn.query("UPDATE bookings SET status = 'Cancelled' WHERE booking_id = ?", [booking_id]);
            await conn.query("UPDATE parking_slots SET status = 'Available' WHERE slot_id = ?", [booking.slot_id]);
        }
        await conn.commit();
        res.json({ message: 'Booking cancelled and slot made available.' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// 6. POST save student profile
app.post('/api/profile', async (req, res) => {
    const { student_id, full_name, department, email } = req.body;
    try {
        await pool.query(`
            INSERT INTO students (student_id, full_name, department, email)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), department = VALUES(department), email = VALUES(email)
        `, [student_id || '24CSE1024', full_name, department, email]);
        res.json({ message: 'Profile saved to MySQL database.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update exact latitude & longitude of a parking spot
app.post('/api/slots/coordinates', async (req, res) => {
    const { slot_id, latitude, longitude } = req.body;
    try {
        await pool.query(
            'UPDATE parking_slots SET latitude = ?, longitude = ? WHERE slot_id = ?',
            [latitude, longitude, slot_id]
        );
        res.json({ message: `Updated coordinates for ${slot_id}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(5000, () => console.log('ParkEase MySQL Server running on http://localhost:5000'));