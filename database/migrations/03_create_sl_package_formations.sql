-- =====================================================
-- Table: sl_package_formations
-- Description: Table de liaison entre packages et formations (globales ou spécifiques)
-- Created: 2026-04-01
-- =====================================================

CREATE TABLE IF NOT EXISTS `sl_package_formations` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `package_id` INT(11) DEFAULT NULL COMMENT 'ID du package (référence à course_packages)',
    `formation_type` ENUM('global', 'package_specific') DEFAULT 'global' COMMENT 'Type: globale (cours LearnPress) ou spécifique',
    `global_formation_id` INT(11) DEFAULT NULL COMMENT 'ID du cours global (lp_lessons ou posts)',
    `package_formation_id` INT(11) DEFAULT NULL COMMENT 'ID de la formation spécifique (sl_package_specific_formations)',
    `formation_id` INT(11) DEFAULT NULL COMMENT 'ID générique alternatif',
    `order` INT(11) DEFAULT 0 COMMENT 'Ordre d\'affichage dans le package',
    PRIMARY KEY (`id`),
    KEY `idx_package_id` (`package_id`),
    KEY `idx_formation_type` (`formation_type`),
    KEY `idx_global_formation_id` (`global_formation_id`),
    KEY `idx_package_formation_id` (`package_formation_id`),
    KEY `idx_formation_id` (`formation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;