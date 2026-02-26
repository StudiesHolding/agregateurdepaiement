-- Migration: Ajouter les champs LMS au modèle Order
-- Date: 2026-02-26

-- Vérifier si la colonne existe avant de l'ajouter
-- Cette migration ajoute les colonnes manquantes pour le workflow LMS complet

-- === Client Information ===
ALTER TABLE `aggp_orders` 
    ADD COLUMN IF NOT EXISTS `customer_first_name` VARCHAR(255) DEFAULT NULL AFTER `customer_name`,
    ADD COLUMN IF NOT EXISTS `customer_last_name` VARCHAR(255) DEFAULT NULL AFTER `customer_first_name`,
    ADD COLUMN IF NOT EXISTS `customer_phone` VARCHAR(50) DEFAULT NULL AFTER `customer_last_name`,
    ADD COLUMN IF NOT EXISTS `customer_city` VARCHAR(100) DEFAULT NULL AFTER `customer_phone`;

-- === LMS Formation ===
ALTER TABLE `aggp_orders` 
    ADD COLUMN IF NOT EXISTS `formation_id` INT DEFAULT NULL AFTER `lms_item_type`,
    ADD COLUMN IF NOT EXISTS `formation_name` VARCHAR(500) DEFAULT NULL AFTER `formation_id`,
    ADD COLUMN IF NOT EXISTS `formation_price` DECIMAL(15,2) DEFAULT NULL AFTER `formation_name`;

-- === Purchase Type ===
ALTER TABLE `aggp_orders` 
    ADD COLUMN IF NOT EXISTS `purchase_type` ENUM('self', 'gift') DEFAULT 'self' AFTER `formation_price`;

-- === Beneficiary (for gifts) ===
ALTER TABLE `aggp_orders` 
    ADD COLUMN IF NOT EXISTS `beneficiary_email` VARCHAR(255) DEFAULT NULL AFTER `purchase_type`,
    ADD COLUMN IF NOT EXISTS `beneficiary_first_name` VARCHAR(255) DEFAULT NULL AFTER `beneficiary_email`,
    ADD COLUMN IF NOT EXISTS `beneficiary_last_name` VARCHAR(255) DEFAULT NULL AFTER `beneficiary_first_name`;

-- === Validation ===
ALTER TABLE `aggp_orders` 
    ADD COLUMN IF NOT EXISTS `validated_at` DATETIME DEFAULT NULL AFTER `beneficiary_last_name`,
    ADD COLUMN IF NOT EXISTS `validated_by` BIGINT UNSIGNED DEFAULT NULL AFTER `validated_at`,
    ADD COLUMN IF NOT EXISTS `admin_notes` TEXT DEFAULT NULL AFTER `validated_by`,
    ADD COLUMN IF NOT EXISTS `rejection_reason` VARCHAR(500) DEFAULT NULL AFTER `admin_notes`;

-- === Completion ===
ALTER TABLE `aggp_orders` 
    ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL AFTER `rejection_reason`,
    ADD COLUMN IF NOT EXISTS `completed_by` BIGINT UNSIGNED DEFAULT NULL AFTER `completed_at`,
    ADD COLUMN IF NOT EXISTS `campus_username` VARCHAR(255) DEFAULT NULL AFTER `completed_by`,
    ADD COLUMN IF NOT EXISTS `credentials_sent_at` DATETIME DEFAULT NULL AFTER `campus_username`,
    ADD COLUMN IF NOT EXISTS `credentials_sent_to` VARCHAR(255) DEFAULT NULL AFTER `credentials_sent_at`;

-- Mettre à jour les timestamps explicites
ALTER TABLE `aggp_orders` 
    MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Vérification
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'aggp_orders'
AND COLUMN_NAME IN (
    'customer_first_name', 'customer_last_name', 'customer_phone', 'customer_city',
    'formation_id', 'formation_name', 'formation_price', 'purchase_type',
    'beneficiary_email', 'beneficiary_first_name', 'beneficiary_last_name',
    'validated_at', 'validated_by', 'admin_notes', 'rejection_reason',
    'completed_at', 'completed_by', 'campus_username', 'credentials_sent_at', 'credentials_sent_to'
)
ORDER BY ORDINAL_POSITION;
