-- =============================================================================
-- MIGRATION: Ajouter les colonnes manquantes pour le modèle Order
-- Date: 2026-02-26
-- Purpose: Résoudre les erreurs "Unknown column" lors des requêtes API
-- =============================================================================

-- =============================================================================
-- CETTE MIGRATION UTILISE UNE PROCÉDURE POUR VÉRIFIER L'EXISTENCE DES COLONNES
-- =============================================================================

DELIMITER //

-- Procédure pour ajouter une colonne si elle n'existe pas
DROP PROCEDURE IF EXISTS add_column_if_not_exists //
CREATE PROCEDURE add_column_if_not_exists(
    IN table_name VARCHAR(255),
    IN column_name VARCHAR(255),
    IN column_definition VARCHAR(500)
)
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO column_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = table_name 
    AND COLUMN_NAME = column_name;
    
    IF column_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', table_name, ' ADD COLUMN ', column_name, ' ', column_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Column ', column_name, ' added to ', table_name) AS result;
    ELSE
        SELECT CONCAT('Column ', column_name, ' already exists in ', table_name) AS result;
    END IF;
END //

DELIMITER ;

-- =============================================================================
-- EXÉCUTION DES MIGRATIONS
-- =============================================================================

-- IMPORTANT: Exécutez cette migration avec:
-- mysql -u <user> -p <database> < apps/backend/scripts/migration-fix-missing-columns.sql

-- === Client Information ===

-- customer_surname (customer_last_name dans l'ancienne migration)
CALL add_column_if_not_exists('aggp_orders', 'customer_surname', 'VARCHAR(255) DEFAULT NULL AFTER customer_name');

-- customer_phone (peut déjà exister de l'ancienne migration)
CALL add_column_if_not_exists('aggp_orders', 'customer_phone', 'VARCHAR(50) DEFAULT NULL AFTER customer_surname');

-- customer_city (peut déjà exister)
CALL add_column_if_not_exists('aggp_orders', 'customer_city', 'VARCHAR(100) DEFAULT NULL AFTER customer_phone');

-- customer_country - COLONNE MANQUANTE CRITIQUE!
CALL add_column_if_not_exists('aggp_orders', 'customer_country', 'VARCHAR(100) DEFAULT NULL AFTER customer_city');

-- === LMS Fields ===

CALL add_column_if_not_exists('aggp_orders', 'lms_item_id', 'VARCHAR(255) DEFAULT NULL AFTER customer_country');

CALL add_column_if_not_exists('aggp_orders', 'lms_item_type', 'ENUM("course", "package", "subscription") DEFAULT NULL AFTER lms_item_id');

-- === Formation Info ===

CALL add_column_if_not_exists('aggp_orders', 'formation_id', 'BIGINT UNSIGNED DEFAULT NULL AFTER lms_item_type');

CALL add_column_if_not_exists('aggp_orders', 'formation_name', 'VARCHAR(500) DEFAULT NULL AFTER formation_id');

CALL add_column_if_not_exists('aggp_orders', 'formation_price', 'DECIMAL(15,2) DEFAULT NULL AFTER formation_name');

-- === Purchase Type ===

CALL add_column_if_not_exists('aggp_orders', 'purchase_type', 'ENUM("self", "gift") DEFAULT "self" AFTER formation_price');

-- === Beneficiary (for gifts) ===

CALL add_column_if_not_exists('aggp_orders', 'beneficiary_email', 'VARCHAR(255) DEFAULT NULL AFTER purchase_type');

CALL add_column_if_not_exists('aggp_orders', 'beneficiary_first_name', 'VARCHAR(255) DEFAULT NULL AFTER beneficiary_email');

CALL add_column_if_not_exists('aggp_orders', 'beneficiary_last_name', 'VARCHAR(255) DEFAULT NULL AFTER beneficiary_first_name');

CALL add_column_if_not_exists('aggp_orders', 'beneficiary_phone', 'VARCHAR(50) DEFAULT NULL AFTER beneficiary_last_name');

CALL add_column_if_not_exists('aggp_orders', 'beneficiary_relationship', 'VARCHAR(50) DEFAULT NULL AFTER beneficiary_phone');

CALL add_column_if_not_exists('aggp_orders', 'beneficiary_country', 'VARCHAR(100) DEFAULT NULL AFTER beneficiary_relationship');

-- === Payment Info ===

CALL add_column_if_not_exists('aggp_orders', 'paid_at', 'DATETIME DEFAULT NULL AFTER beneficiary_country');

CALL add_column_if_not_exists('aggp_orders', 'payment_intent_id', 'VARCHAR(255) DEFAULT NULL AFTER paid_at');

CALL add_column_if_not_exists('aggp_orders', 'payment_provider', 'VARCHAR(50) DEFAULT NULL AFTER payment_intent_id');

CALL add_column_if_not_exists('aggp_orders', 'transaction_reference', 'VARCHAR(255) DEFAULT NULL AFTER payment_provider');

-- === Validation ===

CALL add_column_if_not_exists('aggp_orders', 'validated_at', 'DATETIME DEFAULT NULL AFTER transaction_reference');

CALL add_column_if_not_exists('aggp_orders', 'validated_by', 'BIGINT UNSIGNED DEFAULT NULL AFTER validated_at');

CALL add_column_if_not_exists('aggp_orders', 'admin_notes', 'TEXT DEFAULT NULL AFTER validated_by');

CALL add_column_if_not_exists('aggp_orders', 'rejection_reason', 'TEXT DEFAULT NULL AFTER admin_notes');

-- === Completion ===

CALL add_column_if_not_exists('aggp_orders', 'completed_at', 'DATETIME DEFAULT NULL AFTER rejection_reason');

CALL add_column_if_not_exists('aggp_orders', 'completed_by', 'BIGINT UNSIGNED DEFAULT NULL AFTER completed_at');

CALL add_column_if_not_exists('aggp_orders', 'campus_username', 'VARCHAR(100) DEFAULT NULL AFTER completed_by');

CALL add_column_if_not_exists('aggp_orders', 'credentials_sent_at', 'DATETIME DEFAULT NULL AFTER campus_username');

CALL add_column_if_not_exists('aggp_orders', 'credentials_sent_to', 'VARCHAR(255) DEFAULT NULL AFTER credentials_sent_at');

-- =============================================================================
-- VÉRIFICATION FINALE
-- =============================================================================

-- Voir toutes les colonnes de la table orders
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'aggp_orders'
ORDER BY ORDINAL_POSITION;

-- Nettoyage: Supprimer la procédure
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

SELECT 'Migration terminée avec succès!' AS status;
