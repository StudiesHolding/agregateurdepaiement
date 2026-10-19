-- =====================================================================
-- 012 — Règles de taxe par pays (ADR-0012, D16 — Studies-learning/docs/04-adr)
-- ---------------------------------------------------------------------
-- Une règle par pays et par période : taux, prix TTC ou HT, portée (toutes les ventes, ou B2B seulement),
-- mention légale. Le moteur de prix (`services/pricing/price-engine.js`) applique la règle résolue pour le pays
-- de l'acheteur à la date de la commande ; base, taux et montant sont tracés sur chaque ligne.
-- La TVA B2B MONDIALE (19,25 %, décision d'Albert du 08/10/2026) n'est PAS ici : c'est un réglage plateforme
-- (`tax.b2b.vat`, backend métier) modifiable par le super admin. Cette table porte les règles propres à un pays
-- (ex. TVA sur les ventes B2C d'un pays), prioritaires sur les règles mondiales de même portée.
-- Additif et rejouable.
-- =====================================================================

CREATE TABLE IF NOT EXISTS `aggp_tax_rules` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `countryCode`   CHAR(2)         NOT NULL,
  `ratePercent`   DECIMAL(6,3)    NOT NULL DEFAULT 0,
  `inclusive`     TINYINT(1)      NOT NULL DEFAULT 0,
  `scope`         ENUM('all','b2b','b2c') NOT NULL DEFAULT 'all',
  `label`         VARCHAR(120)    NULL,
  `validFrom`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `validTo`       DATETIME        NULL,
  `isActive`      TINYINT(1)      NOT NULL DEFAULT 1,
  `createdAt`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tax_rules_country_validity` (`countryCode`, `isActive`, `validFrom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mise à niveau d'une table créée par une version antérieure de ce script.
ALTER TABLE `aggp_tax_rules` MODIFY `scope` ENUM('all','b2b','b2c') NOT NULL DEFAULT 'all';
DELETE FROM `aggp_tax_rules` WHERE `countryCode` = 'CM' AND `scope` = 'b2b' AND `label` LIKE 'TVA Cameroun%';
