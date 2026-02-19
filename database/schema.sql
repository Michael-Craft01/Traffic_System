CREATE DATABASE IF NOT EXISTS traffic_system;
USE traffic_system;

CREATE TABLE IF NOT EXISTS traffic_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_count INT NOT NULL,
    congestion_status ENUM('CLEAR', 'MODERATE', 'CONGESTED') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO traffic_logs (vehicle_count, congestion_status) VALUES (0, 'CLEAR');
