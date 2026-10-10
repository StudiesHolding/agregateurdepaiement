-- ADR-0018, D5.2 : connexion de l'équipe Studies Learning à l'administration du PSP.
-- Chaque assertion émise par le backend métier n'ouvre qu'une session (rejeu impossible). Idempotent.
CREATE TABLE IF NOT EXISTS aggp_admin_sso_assertions (
  jti         VARCHAR(64)      NOT NULL,
  user_id     BIGINT UNSIGNED  NOT NULL,
  expires_at  DATETIME         NOT NULL,
  ip_address  VARCHAR(45)      NULL,
  used_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (jti),
  KEY idx_admin_sso_user (user_id, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
