-- =====================================================================
-- 012 — Règles de taxe par pays (ADR-0012, D16 — Studies-learning/docs/04-adr)
-- ---------------------------------------------------------------------
-- Une règle par pays et par période : taux, prix TTC ou HT, portée (toutes les ventes, ou B2B seulement),
-- mention légale. Le moteur de prix (`services/pricing/price-engine.js`) applique la règle résolue pour le pays
-- de l'acheteur à la date de la commande ; base, taux et montant sont tracés sur chaque ligne.
-- Décision d'Albert (08/10/2026) : Cameroun, TVA 19,25 %, sur les formations B2B uniquement.
-- Additif et rejouable.
-- =====================================================================

CREATE TABLE IF NOT EXISTS `aggp_tax_rules` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `countryCode`   CHAR(2)         NOT NULL,
  `ratePercent`   DECIMAL(6,3)    NOT NULL DEFAULT 0,
  `inclusive`     TINYINT(1)      NOT NULL DEFAULT 0,
  `scope`         ENUM('all','b2b') NOT NULL DEFAULT 'all',
  `label`         VARCHAR(120)    NULL,
  `validFrom`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `validTo`       DATETIME        NULL,
  `isActive`      TINYINT(1)      NOT NULL DEFAULT 1,
  `createdAt`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tax_rules_country_validity` (`countryCode`, `isActive`, `validFrom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `aggp_tax_rules` (`countryCode`, `ratePercent`, `inclusive`, `scope`, `label`, `validFrom`)
SELECT 'CM', 19.250, 0, 'b2b', 'TVA Cameroun (19,25 %) — formations B2B', '2026-01-01 00:00:00'
WHERE NOT EXISTS (SELECT 1 FROM `aggp_tax_rules` WHERE `countryCode` = 'CM');
