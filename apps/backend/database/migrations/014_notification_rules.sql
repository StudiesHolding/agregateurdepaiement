-- ADR-0019, D7 : règles de notification de l'espace finance et journal d'envoi. Idempotent.
CREATE TABLE IF NOT EXISTS aggp_notification_rules (
  id               BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  event            VARCHAR(60)      NOT NULL,
  name             VARCHAR(120)     NULL,
  enabled          TINYINT(1)       NOT NULL DEFAULT 1,
  severity         ENUM('info','warning','danger') NOT NULL DEFAULT 'info',
  params           LONGTEXT         NULL,
  channels         LONGTEXT         NOT NULL,
  recipients       LONGTEXT         NULL,
  quiet_hours      LONGTEXT         NULL,
  timezone         VARCHAR(60)      NOT NULL DEFAULT 'Africa/Douala',
  cooldown_minutes INT              NOT NULL DEFAULT 60,
  updated_by       VARCHAR(255)     NULL,
  created_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notification_rules_event (event, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aggp_notification_deliveries (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  rule_id     BIGINT UNSIGNED  NULL,
  event       VARCHAR(60)      NOT NULL,
  dedupe_key  VARCHAR(190)     NOT NULL,
  channel     ENUM('inApp','email','sound') NOT NULL,
  recipient   VARCHAR(255)     NULL,
  status      ENUM('sent','skipped','failed') NOT NULL,
  title       VARCHAR(255)     NOT NULL,
  detail      VARCHAR(500)     NULL,
  payload     LONGTEXT         NULL,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notification_deliveries_dedupe (rule_id, dedupe_key, created_at),
  KEY idx_notification_deliveries_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
