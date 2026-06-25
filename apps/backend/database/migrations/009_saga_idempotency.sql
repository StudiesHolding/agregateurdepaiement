-- ============================================================
-- Migration 009 : Table d'idempotence pour la Saga Orchestrator
-- 
-- Cette table garantit l'idempotence des événements de paiement
-- dans le module Saga (BullMQ). Chaque événement est identifié
-- par son eventId (UUID) et ne peut être traité qu'une seule fois.
--
-- Contexte : Strangler Fig Pattern — cohabitation avec l'ancien
-- système synchrone (B2BProvisioning, LmsBridge, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS `aggp_saga_idempotency` (
    `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    
    -- UUID de l'événement (généré par payment-event-dispatcher.service.js)
    `event_id` VARCHAR(36) NOT NULL,
    
    -- ID du payment intent (pour bloquer les doublons au niveau DB)
    `payment_intent_id` VARCHAR(255) DEFAULT NULL,
    
    -- Référence de la commande dans aggp_orders
    `order_reference` VARCHAR(100) NOT NULL,
    
    -- Source de l'événement (RETAIL, AUCTION, B2B_PACKAGE, MOODLE_HEADLESS)
    `source` VARCHAR(20) NOT NULL,
    
    -- Statut actuel de la saga
    `status` ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    
    -- JSON contenant les étapes complétées (ex: ["user_created", "moodle_enrolled"])
    `steps_completed` JSON DEFAULT NULL,
    
    -- Résultat final de la saga (JSON)
    `result` JSON DEFAULT NULL,
    
    -- Message d'erreur si FAILED
    `error_message` TEXT DEFAULT NULL,
    
    -- Nombre de tentatives
    `retry_count` INT NOT NULL DEFAULT 0,
    
    -- Horodatages
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `processed_at` TIMESTAMP NULL DEFAULT NULL,
    
    PRIMARY KEY (`id`),
    
    -- Index unique sur event_id (garantit l'idempotence)
    UNIQUE KEY `uq_event_id` (`event_id`),
    
    -- Index unique sur payment_intent_id (bloque les doublons de paiement)
    UNIQUE KEY `uq_payment_intent_id` (`payment_intent_id`),
    
    -- Index pour les recherches par commande
    INDEX `idx_order_reference` (`order_reference`),
    
    -- Index pour les reprises (CRON)
    INDEX `idx_status_created` (`status`, `created_at`),
    
    -- Index pour le reporting
    INDEX `idx_source` (`source`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_updated_at` (`updated_at`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Table d''idempotence pour la Saga Orchestrator (BullMQ)';