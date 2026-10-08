/**
 * Résolution de la règle de taxe du pays de l'acheteur (ADR-0012, D16).
 *
 * `selectTaxRule` est pure (testée) : parmi les règles actives d'un pays, celle dont la période couvre la date
 * de la commande ; la plus récente l'emporte. Sans règle : aucune taxe (le moteur trace alors `tax: null`).
 * `resolveTaxRule` lit la table `aggp_tax_rules` avec un cache court (les règles changent rarement).
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map();

/** @returns {{ country, ratePercent, inclusive, scope, label } | null} règle au format du moteur de prix */
export function selectTaxRule(rules, country, at = new Date()) {
  const code = String(country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const when = at.getTime();
  const match = rules
    .filter((r) => r.isActive && r.countryCode === code)
    .filter((r) => new Date(r.validFrom).getTime() <= when && (r.validTo == null || new Date(r.validTo).getTime() > when))
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];
  if (!match) return null;
  return {
    country: code,
    ratePercent: String(match.ratePercent),
    inclusive: Boolean(match.inclusive),
    scope: match.scope ?? "all",
    label: match.label ?? null,
  };
}

/** Règle applicable au pays de l'acheteur, à la date donnée (lecture base, cache 60 s). */
export async function resolveTaxRule(country, at = new Date(), { TaxRule } = {}) {
  const code = String(country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const now = Date.now();
  const hit = cache.get(code);
  let rules = hit && now - hit.at < CACHE_TTL_MS ? hit.rules : null;
  if (!rules) {
    const model = TaxRule ?? (await import("../../models/tax-rule.model.js")).TaxRule;
    rules = (await model.findAll({ where: { countryCode: code, isActive: true }, raw: true }));
    cache.set(code, { at: now, rules });
  }
  return selectTaxRule(rules, code, at);
}

/** Vide le cache (après modification d'une règle depuis le dashboard). */
export function clearTaxRuleCache() {
  cache.clear();
}
