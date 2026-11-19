CREATE DATABASE IF NOT EXISTS parkease_db;
USE parkease_db;

CREATE TABLE students (
    student_id VARCHAR(20) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    vehicle_no VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type ENUM('Two-Wheeler', 'Four-Wheeler') NOT NULL
);

CREATE TABLE parking_spots (
    spot_id INT AUTO_INCREMENT PRIMARY KEY,
    spot_code VARCHAR(20) UNIQUE NOT NULL,
    zone_name VARCHAR(50) NOT NULL,
    vehicle_type ENUM('Two-Wheeler', 'Four-Wheeler') DEFAULT 'Four-Wheeler',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status ENUM('Available', 'Occupied') DEFAULT 'Available'
);

CREATE TABLE parking_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    spot_id INT NOT NULL,
    parked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vacated_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (spot_id) REFERENCES parking_spots(spot_id) ON DELETE CASCADE
);

DELIMITER //
CREATE TRIGGER trg_after_park_insert
AFTER INSERT ON parking_logs
FOR EACH ROW
BEGIN
    IF NEW.is_active = TRUE THEN
        UPDATE parking_spots SET status = 'Occupied' WHERE spot_id = NEW.spot_id;
    END IF;
END;//
DELIMITER ;

INSERT INTO students VALUES 
('STU101', 'Rohan Verma', 'HR26DK8821', 'Four-Wheeler'),
('STU102', 'Ananya Rao', 'DL3SCJ4410', 'Two-Wheeler'),
('STU103', 'Kabir Singh', 'HR51AB1234', 'Four-Wheeler');

INSERT INTO parking_spots (spot_code, zone_name, vehicle_type, latitude, longitude, status) VALUES
('A-01', 'Main Gate Zone', 'Four-Wheeler', 28.24860000, 77.06350000, 'Available'),
('A-02', 'Main Gate Zone', 'Four-Wheeler', 28.24872000, 77.06365000, 'Available'),
('B-01', 'Academic Block', 'Two-Wheeler', 28.24905000, 77.06400000, 'Available'),
('B-02', 'Academic Block', 'Four-Wheeler', 28.24920000, 77.06420000, 'Available'),
('L-01', 'Central Library', 'Two-Wheeler', 28.24830000, 77.06450000, 'Available');
