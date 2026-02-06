-- =====================================================
-- HIMALAYAN MESH PROTOCOL - PostgreSQL Database Schema
-- =====================================================
-- Created for: Border Communication System
-- Database: himalayan_mesh
-- Version: 2.0.0
-- =====================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS message_routes CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS location_history CASCADE;
DROP TABLE IF EXISTS soldiers CASCADE;

-- =====================================================
-- SOLDIERS TABLE
-- =====================================================
CREATE TABLE soldiers (
    id SERIAL PRIMARY KEY,
    soldier_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    post VARCHAR(100) NOT NULL,
    
    -- Position data
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    altitude INTEGER DEFAULT 0,
    
    -- Cryptographic keys
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    
    -- Status information
    battery_level INTEGER DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'low-battery', 'offline', 'emergency')),
    signal_strength INTEGER DEFAULT 100 CHECK (signal_strength >= 0 AND signal_strength <= 100),
    
    -- Connection tracking
    connected_to TEXT[], -- Array of soldier IDs
    
    -- Timestamps
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- MongoDB reference
    mongo_id VARCHAR(24)
);

-- Index for faster lookups
CREATE INDEX idx_soldiers_soldier_id ON soldiers(soldier_id);
CREATE INDEX idx_soldiers_status ON soldiers(status);
CREATE INDEX idx_soldiers_unit ON soldiers(unit);
CREATE INDEX idx_soldiers_battery ON soldiers(battery_level);
CREATE INDEX idx_soldiers_last_seen ON soldiers(last_seen);

-- =====================================================
-- LOCATION HISTORY TABLE (for GPS trail visualization)
-- =====================================================
CREATE TABLE location_history (
    id SERIAL PRIMARY KEY,
    soldier_id VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    altitude INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_soldier FOREIGN KEY (soldier_id) REFERENCES soldiers(soldier_id) ON DELETE CASCADE
);

CREATE INDEX idx_location_soldier_id ON location_history(soldier_id);
CREATE INDEX idx_location_timestamp ON location_history(timestamp);

-- Auto-delete old location history (keep last 50 per soldier)
CREATE OR REPLACE FUNCTION cleanup_location_history()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM location_history
    WHERE id IN (
        SELECT id FROM location_history
        WHERE soldier_id = NEW.soldier_id
        ORDER BY timestamp DESC
        OFFSET 50
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_location_history
AFTER INSERT ON location_history
FOR EACH ROW
EXECUTE FUNCTION cleanup_location_history();

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(50) UNIQUE NOT NULL,
    from_soldier VARCHAR(50) NOT NULL,
    to_soldier VARCHAR(50) NOT NULL,
    
    -- Encrypted content
    encrypted_content TEXT NOT NULL,
    encrypted_aes_key TEXT NOT NULL,
    signature TEXT NOT NULL,
    
    -- Image support
    image_data TEXT, -- Base64 encrypted image
    has_image BOOLEAN DEFAULT FALSE,
    
    -- Message metadata
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    message_type VARCHAR(30) DEFAULT 'general' CHECK (message_type IN ('patrol-update', 'enemy-alert', 'medical-emergency', 'supply-request', 'weather-alert', 'general')),
    
    -- Routing information
    hop_count INTEGER DEFAULT 0,
    delivered BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP,
    failed_attempts INTEGER DEFAULT 0,
    
    -- Expiration
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- MongoDB reference
    mongo_id VARCHAR(24)
);

-- Indexes for performance
CREATE INDEX idx_messages_message_id ON messages(message_id);
CREATE INDEX idx_messages_from ON messages(from_soldier);
CREATE INDEX idx_messages_to ON messages(to_soldier);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_priority ON messages(priority);
CREATE INDEX idx_messages_expires_at ON messages(expires_at);

-- =====================================================
-- MESSAGE ROUTES TABLE (stores path information)
-- =====================================================
CREATE TABLE message_routes (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(50) NOT NULL,
    soldier_id VARCHAR(50) NOT NULL,
    hop_number INTEGER NOT NULL,
    battery_level INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_message FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE
);

CREATE INDEX idx_routes_message_id ON message_routes(message_id);
CREATE INDEX idx_routes_soldier_id ON message_routes(soldier_id);

-- =====================================================
-- AUTO-DELETE EXPIRED MESSAGES
-- =====================================================
CREATE OR REPLACE FUNCTION delete_expired_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM messages WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE TIMESTAMP TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_soldiers_updated_at
BEFORE UPDATE ON soldiers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE soldiers IS 'Stores soldier registration and real-time status information';
COMMENT ON TABLE messages IS 'Encrypted message storage with routing metadata';
COMMENT ON TABLE location_history IS 'GPS trail history for each soldier (last 50 positions)';
COMMENT ON TABLE message_routes IS 'Detailed routing path for each message through the mesh network';

COMMENT ON COLUMN soldiers.private_key IS 'WARNING: In production, private keys should ONLY be stored on client device';
COMMENT ON COLUMN messages.encrypted_content IS 'AES-256-CBC encrypted message content';
COMMENT ON COLUMN messages.encrypted_aes_key IS 'RSA-2048 encrypted AES key';
COMMENT ON COLUMN messages.signature IS 'SHA-256 digital signature for message authentication';