/**
 * Migration: Create order_audit_logs table
 * 
 * Purpose: Track all actions on orders (validation, completion, emails sent, etc.)
 * Safety: Creates NEW table - no impact on existing data
 * 
 * Run with: node apps/backend/scripts/run-migration.js
 * Or directly in MySQL: mysql -u user -p database < this_file.sql
 */

-- =====================================================
-- TABLE: aggp_order_audit_logs
-- =====================================================

CREATE TABLE IF NOT EXISTS aggp_order_audit_logs (
    -- Primary Key
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    -- Order Reference (denormalized for faster queries)
    order_id BIGINT UNSIGNED NOT NULL,
    order_reference VARCHAR(100) NOT NULL,
    
    -- Action Type
    action VARCHAR(50) NOT NULL COMMENT 'ORDER_CREATED, PAYMENT_RECEIVED, ORDER_VALIDATED, etc.',
    action_label VARCHAR(255) NOT NULL COMMENT 'Human-readable label for UI',
    
    -- Actor (who performed the action)
    actor_type ENUM('system', 'admin', 'webhook', 'api') DEFAULT 'system',
    actor_id BIGINT UNSIGNED NULL,
    actor_email VARCHAR(255) NULL COMMENT 'Email or identifier of the actor',
    
    -- State Changes (JSON for before/after)
    previous_state JSON NULL COMMENT 'State before the action',
    new_state JSON NULL COMMENT 'State after the action',
    
    -- Connection Context
    ip_address VARCHAR(45) NULL COMMENT 'IPv4 or IPv6 address',
    user_agent VARCHAR(500) NULL COMMENT 'Browser/client user agent',
    
    -- Email Tracking
    email_sent_to VARCHAR(255) NULL COMMENT 'Email recipient if email was sent',
    email_sent_at DATETIME NULL COMMENT 'When email was sent',
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    INDEX idx_order_id (order_id),
    INDEX idx_order_reference (order_reference),
    INDEX idx_action (action),
    INDEX idx_actor_id (actor_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit trail for order lifecycle - who did what and when';

-- =====================================================
-- ALTER TABLE: aggp_orders - Add new columns for new workflow
-- =====================================================

-- These columns are ADDITIVE only - no data loss
-- All new columns allow NULL by default

-- Customer info (extending existing)
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS customer_surname VARCHAR(255) NULL AFTER customer_name,
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50) NULL AFTER customer_surname,
    ADD COLUMN IF NOT EXISTS customer_city VARCHAR(100) NULL AFTER customer_phone;

-- Purchase type (self or gift)
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS purchase_type ENUM('self', 'gift') DEFAULT 'self' 
    COMMENT 'Purchase for self or gift for another person' 
    AFTER customer_city;

-- Beneficiary info (if purchase_type = 'gift')
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS beneficiary_first_name VARCHAR(255) NULL AFTER purchase_type,
    ADD COLUMN IF NOT EXISTS beneficiary_last_name VARCHAR(255) NULL AFTER beneficiary_first_name,
    ADD COLUMN IF NOT EXISTS beneficiary_email VARCHAR(255) NULL AFTER beneficiary_last_name,
    ADD COLUMN IF NOT EXISTS beneficiary_phone VARCHAR(50) NULL AFTER beneficiary_email,
    ADD COLUMN IF NOT EXISTS beneficiary_relationship VARCHAR(50) NULL 
    COMMENT 'Family, friend, colleague, other' 
    AFTER beneficiary_phone;

-- Formation info (extending existing)
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS formation_id BIGINT UNSIGNED NULL AFTER beneficiary_relationship,
    ADD COLUMN IF NOT EXISTS formation_name VARCHAR(500) NULL AFTER formation_id,
    ADD COLUMN IF NOT EXISTS formation_price DECIMAL(15,2) NULL AFTER formation_name;

-- Validation timestamps
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS paid_at DATETIME NULL AFTER formation_price,
    ADD COLUMN IF NOT EXISTS validated_at DATETIME NULL AFTER paid_at,
    ADD COLUMN IF NOT EXISTS validated_by BIGINT UNSIGNED NULL AFTER validated_at,
    ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL AFTER validated_by,
    ADD COLUMN IF NOT EXISTS completed_by BIGINT UNSIGNED NULL AFTER completed_at;

-- Credentials (temporary storage for sending - NOT stored long term for security)
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS campus_username VARCHAR(100) NULL AFTER completed_by,
    ADD COLUMN IF NOT EXISTS credentials_sent_at DATETIME NULL AFTER campus_username,
    ADD COLUMN IF NOT EXISTS credentials_sent_to VARCHAR(255) NULL AFTER credentials_sent_at;

-- Notes
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS admin_notes TEXT NULL AFTER credentials_sent_to,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL AFTER admin_notes;

-- Payment references
ALTER TABLE aggp_orders 
    ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255) NULL AFTER rejection_reason,
    ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) NULL AFTER payment_intent_id,
    ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(255) NULL AFTER payment_provider;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if table was created
-- SELECT COUNT(*) FROM information_schema.tables 
-- WHERE table_schema = DATABASE() AND table_name = 'aggp_order_audit_logs';

-- Check if columns were added
-- SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE 
-- FROM information_schema.columns 
-- WHERE table_name = 'aggp_orders' AND COLUMN_NAME LIKE 'purchase_type';

-- =====================================================
-- ROLLBACK (if needed - run ONLY if migration fails)
-- =====================================================

-- DROP TABLE IF EXISTS aggp_order_audit_logs;

-- ALTER TABLE aggp_orders 
--     DROP COLUMN IF EXISTS customer_surname,
--     DROP COLUMN IF EXISTS customer_phone,
--     DROP COLUMN IF EXISTS customer_city,
--     DROP COLUMN IF EXISTS purchase_type,
--     DROP COLUMN IF EXISTS beneficiary_first_name,
--     DROP COLUMN IF EXISTS beneficiary_last_name,
--     DROP COLUMN IF EXISTS beneficiary_email,
--     DROP COLUMN IF EXISTS beneficiary_phone,
--     DROP COLUMN IF EXISTS beneficiary_relationship,
--     DROP COLUMN IF EXISTS formation_id,
--     DROP COLUMN IF EXISTS formation_name,
--     DROP COLUMN IF EXISTS formation_price,
--     DROP COLUMN IF EXISTS paid_at,
--     DROP COLUMN IF EXISTS validated_at,
--     DROP COLUMN IF EXISTS validated_by,
--     DROP COLUMN IF EXISTS completed_at,
--     DROP COLUMN IF EXISTS completed_by,
--     DROP COLUMN IF EXISTS campus_username,
--     DROP COLUMN IF EXISTS credentials_sent_at,
--     DROP COLUMN IF EXISTS credentials_sent_to,
--     DROP COLUMN IF EXISTS admin_notes,
--     DROP COLUMN IF EXISTS rejection_reason,
--     DROP COLUMN IF EXISTS payment_intent_id,
--     DROP COLUMN IF EXISTS payment_provider,
--     DROP COLUMN IF EXISTS transaction_reference;
