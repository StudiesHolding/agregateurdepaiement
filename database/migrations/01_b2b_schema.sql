-- Création des tables pour le Dashboard Entreprise (B2B)

-- 1. companies
CREATE TABLE IF NOT EXISTS `sl_companies` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) DEFAULT NULL,
    `address` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. company_admins
CREATE TABLE IF NOT EXISTS `sl_company_admins` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `company_id` INT(11) NOT NULL,
    `user_id` BIGINT(20) UNSIGNED DEFAULT NULL COMMENT 'Lien vers kyd4_users si applicable',
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_email` (`email`),
    KEY `idx_company_id` (`company_id`),
    CONSTRAINT `fk_company_admins_company` FOREIGN KEY (`company_id`) REFERENCES `sl_companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. employees (Collaborateurs)
CREATE TABLE IF NOT EXISTS `sl_employees` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `company_id` INT(11) NOT NULL,
    `first_name` VARCHAR(255) NOT NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `department` VARCHAR(255) DEFAULT NULL,
    `position` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_email_company` (`email`, `company_id`),
    KEY `idx_company_id` (`company_id`),
    CONSTRAINT `fk_employees_company` FOREIGN KEY (`company_id`) REFERENCES `sl_companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. company_packages (Packages possédés par une entreprise)
CREATE TABLE IF NOT EXISTS `sl_company_packages` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `company_id` INT(11) NOT NULL,
    `package_id` INT(11) NOT NULL COMMENT 'Référence à sl_formation_packages',
    `licenses_total` INT(11) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_company_package` (`company_id`, `package_id`),
    KEY `idx_company_id` (`company_id`),
    KEY `idx_package_id` (`package_id`),
    CONSTRAINT `fk_cp_company` FOREIGN KEY (`company_id`) REFERENCES `sl_companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cp_package` FOREIGN KEY (`package_id`) REFERENCES `sl_formation_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. licenses (Représente les licences disponibles)
CREATE TABLE IF NOT EXISTS `sl_licenses` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `company_package_id` INT(11) NOT NULL,
    `status` ENUM('available', 'reserved', 'active') NOT NULL DEFAULT 'available',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_company_package_id` (`company_package_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_licenses_cp` FOREIGN KEY (`company_package_id`) REFERENCES `sl_company_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. license_assignments (Historique des assignations)
CREATE TABLE IF NOT EXISTS `sl_license_assignments` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `license_id` INT(11) NOT NULL,
    `employee_id` INT(11) NOT NULL,
    `assigned_by` INT(11) NOT NULL COMMENT 'ID de l admin d entreprise',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_license` (`license_id`),
    KEY `idx_employee_id` (`employee_id`),
    CONSTRAINT `fk_la_license` FOREIGN KEY (`license_id`) REFERENCES `sl_licenses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_la_employee` FOREIGN KEY (`employee_id`) REFERENCES `sl_employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_la_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `sl_company_admins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. access_requests (Demandes d’accès LMS)
CREATE TABLE IF NOT EXISTS `sl_access_requests` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `license_id` INT(11) NOT NULL,
    `employee_id` INT(11) NOT NULL,
    `status` ENUM('pending', 'processing', 'activated', 'rejected') NOT NULL DEFAULT 'pending',
    `requested_by` INT(11) NOT NULL COMMENT 'ID de l admin d entreprise',
    `processed_by` BIGINT(20) UNSIGNED DEFAULT NULL COMMENT 'ID de l admin plateforme',
    `processed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_license_request` (`license_id`),
    KEY `idx_employee_id` (`employee_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_ar_license` FOREIGN KEY (`license_id`) REFERENCES `sl_licenses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ar_employee` FOREIGN KEY (`employee_id`) REFERENCES `sl_employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ar_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `sl_company_admins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. company_notifications (Notifications pour le dashboard entreprise)
CREATE TABLE IF NOT EXISTS `sl_company_notifications` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `company_id` INT(11) NOT NULL,
    `user_id` INT(11) DEFAULT NULL COMMENT 'ID de l admin d entreprise spécifique, NULL = toute l entreprise',
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `read_status` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_company_id` (`company_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_read_status` (`read_status`),
    CONSTRAINT `fk_cn_company` FOREIGN KEY (`company_id`) REFERENCES `sl_companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cn_user` FOREIGN KEY (`user_id`) REFERENCES `sl_company_admins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
