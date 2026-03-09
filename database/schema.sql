CREATE DATABASE IF NOT EXISTS traffic_system;
USE traffic_system;

-- Table for camera/sensor metadata
CREATE TABLE IF NOT EXISTS sensors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Refined table for traffic history
CREATE TABLE IF NOT EXISTS traffic_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(50),
    vehicle_count INT NOT NULL,
    congestion_status ENUM('CLEAR', 'MODERATE', 'CONGESTED') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id)
);

-- Pre-fill a sensor for testing
INSERT IGNORE INTO sensors (id, name, latitude, longitude) 
VALUES ('cam_main_01', 'Harare CBD North', 40.7128, -74.0060);
