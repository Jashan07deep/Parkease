-- ParkEase schema (MySQL 8 / MariaDB 10.5+)
-- Run with:  npm run db:init   (from /server)
-- WARNING: this recreates the tables. Existing data in them is dropped.

CREATE DATABASE IF NOT EXISTS parkease_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parkease_db;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS parking_slots;
DROP TABLE IF EXISTS parking_zones;
DROP TABLE IF EXISTS students;

-- A student / user record. The student ID is the natural key.
CREATE TABLE students (
  student_id   VARCHAR(20)  NOT NULL,
  full_name    VARCHAR(80)  NOT NULL,
  department   VARCHAR(80)  NULL,
  email        VARCHAR(120) NULL,
  password_hash VARCHAR(200) NULL,                -- scrypt: salt:hash (hex). NULL = account not claimed yet
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id),
  UNIQUE KEY uq_students_email (email)
) ENGINE=InnoDB;

-- Optional grouping of spots, e.g. "Main Gate", "Library Lot". Created by the admin.
CREATE TABLE parking_zones (
  zone_id      INT          NOT NULL AUTO_INCREMENT,
  zone_name    VARCHAR(60)  NOT NULL,
  description  VARCHAR(200) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (zone_id),
  UNIQUE KEY uq_zone_name (zone_name)
) ENGINE=InnoDB;

-- Every spot is placed on the map by the admin and given a name by hand.
CREATE TABLE parking_slots (
  slot_id      INT          NOT NULL AUTO_INCREMENT,
  slot_name    VARCHAR(40)  NOT NULL,
  zone_id      INT          NULL,
  vehicle_type ENUM('Any','Two-wheeler','Four-wheeler') NOT NULL DEFAULT 'Any',
  latitude     DECIMAL(10,7) NOT NULL,
  longitude    DECIMAL(10,7) NOT NULL,
  state        ENUM('Open','Maintenance') NOT NULL DEFAULT 'Open',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (slot_id),
  UNIQUE KEY uq_slot_name (slot_name),
  CONSTRAINT fk_slot_zone FOREIGN KEY (zone_id) REFERENCES parking_zones (zone_id) ON DELETE SET NULL,
  CONSTRAINT chk_lat CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_lng CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

-- Booking history. "Booked" is not stored on the slot, it is derived from an Active booking.
-- The two generated columns + UNIQUE keys make the database itself refuse:
--   * two active bookings for the same slot
--   * two active bookings for the same student
CREATE TABLE bookings (
  booking_id     VARCHAR(12)  NOT NULL,
  student_id     VARCHAR(20)  NOT NULL,
  slot_id        INT          NULL,
  slot_name      VARCHAR(40)  NOT NULL,           -- snapshot so history survives if a spot is deleted
  vehicle_no     VARCHAR(20)  NOT NULL,
  vehicle_type   ENUM('Two-wheeler','Four-wheeler') NOT NULL,
  status         ENUM('Active','Completed','Cancelled') NOT NULL DEFAULT 'Active',
  booked_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at       TIMESTAMP    NULL,
  active_slot    INT         GENERATED ALWAYS AS (IF(status = 'Active', slot_id, NULL)) STORED,
  active_student VARCHAR(20) GENERATED ALWAYS AS (IF(status = 'Active', student_id, NULL)) STORED,
  PRIMARY KEY (booking_id),
  UNIQUE KEY uq_one_active_per_slot (active_slot),
  UNIQUE KEY uq_one_active_per_student (active_student),
  KEY idx_booking_student (student_id, booked_at),
  CONSTRAINT fk_booking_student FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_booking_slot    FOREIGN KEY (slot_id)    REFERENCES parking_slots (slot_id)
) ENGINE=InnoDB;

-- Login sessions. Only a SHA-256 of the token is stored, so a leaked table cannot be replayed.
CREATE TABLE sessions (
  token_hash   CHAR(64)    NOT NULL,
  student_id   VARCHAR(20) NOT NULL,
  expires_at   TIMESTAMP   NOT NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_session_student (student_id),
  CONSTRAINT fk_session_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE
) ENGINE=InnoDB;
