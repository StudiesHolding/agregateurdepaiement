-- Colonne SSO Keycloak pour le parcours MOODLE_HEADLESS (J1 ATDD)
-- NULL = compte créé, activation SSO en attente via magic-link

ALTER TABLE `kyd4_users`
  ADD COLUMN `keycloak_id` VARCHAR(255) NULL DEFAULT NULL
    COMMENT 'ID Keycloak — NULL tant que SSO non activé';

CREATE INDEX IF NOT EXISTS `idx_kyd4_users_keycloak_id` ON `kyd4_users` (`keycloak_id`);
