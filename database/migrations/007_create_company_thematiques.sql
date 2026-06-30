-- Migration 007 — Création de la table sl_company_thematiques
-- 
-- Contexte DDD :
-- CompanyThematique représente le droit commercial détenu par une entreprise
-- sur une offre thématique. Ce n'est pas le catalogue métier (Authoring Engine).
-- C'est un enregistrement de vente : qui a acheté quoi, quand.
--
-- authoring_thematique_id référence sl_business_thematiques.id (PostgreSQL)
-- sans FK — la validité est assurée par l'Authoring Engine.
--
-- Pas de total_licenses / used_licenses ici : les licences sont gérées
-- au niveau package (sl_company_packages).

CREATE TABLE IF NOT EXISTS `sl_company_thematiques` (
    `id`                      INT(11) NOT NULL AUTO_INCREMENT,
    `company_id`              INT(11) NOT NULL,
    `authoring_thematique_id` INT(11) NOT NULL COMMENT 'ID métier externe référençant sl_business_thematiques.id (PostgreSQL — Authoring Engine)',
    `purchase_order_id`       VARCHAR(100) NOT NULL COMMENT 'Référence commande d\'origine (aggp_orders.reference)',
    `purchase_date`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expiry_date`             DATETIME DEFAULT NULL,
    `status`                  ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
    `created_at`              DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at`              DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_company_thematique` (`company_id`, `authoring_thematique_id`),
    KEY `idx_company_id` (`company_id`),
    KEY `idx_purchase_order_id` (`purchase_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;