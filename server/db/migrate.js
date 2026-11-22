// Non-destructive upgrade for an existing parkease_db: adds password support. Safe to run more than once.
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const db = process.env.DB_NAME || 'parkease_db';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: db,
  });
  const [cols] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'password_hash'", [db]);
  if (!cols.length) {
    await conn.query('ALTER TABLE students ADD COLUMN password_hash VARCHAR(200) NULL AFTER email');
    console.log('students.password_hash added');
  }
  await conn.query(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL, student_id VARCHAR(20) NOT NULL, expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_hash), KEY idx_session_student (student_id),
    CONSTRAINT fk_session_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await conn.end();
  console.log('Migration complete. Existing spots, zones and bookings were not touched.');
})().catch((e) => { console.error('db:migrate failed:', e.message); process.exit(1); });
