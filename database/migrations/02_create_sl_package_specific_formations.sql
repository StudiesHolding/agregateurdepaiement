-- =====================================================
-- Table: sl_package_specific_formations
-- Description: Formations spécifiques liées aux packages de formation
-- Created: 2026-04-01
-- =====================================================

CREATE TABLE IF NOT EXISTS `sl_package_specific_formations` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `package_id` INT(11) NOT NULL COMMENT 'ID du package de formation (référence à course_packages)',
    `title` VARCHAR(255) NOT NULL COMMENT 'Titre de la formation spécifique',
    `description` TEXT COMMENT 'Description détaillée de la formation',
    `duration_hours` INT(11) COMMENT 'Durée de la formation en heures',
    `difficulty_level` ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner' COMMENT 'Niveau de difficulté',
    `objectives` TEXT COMMENT 'Objectifs pédagogiques de la formation',
    `prerequisites` TEXT COMMENT 'Prérequis pour suivre cette formation',
    `modules` LONGTEXT COMMENT 'Modules de la formation (JSON)',
    `custom_sections` LONGTEXT COMMENT 'Sections personnalisées (JSON)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_package_id` (`package_id`),
    KEY `idx_difficulty_level` (`difficulty_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Cette table est liée à course_packages via package_id
-- ALTER TABLE `sl_package_specific_formations` 
-- ADD CONSTRAINT `fk_spf_package` 
-- FOREIGN KEY (`package_id`) REFERENCES `course_packages`(`id`) ON DELETE CASCADE;