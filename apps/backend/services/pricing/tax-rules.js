/**
 * Règles de taxe applicables à un achat (ADR-0012, D16).
 *
 * Deux sources, dans cet ordre (le moteur prend la première règle de la catégorie de chaque ligne) :
 *   1. les règles du PAYS de l'acheteur (table `aggp_tax_rules`, portée all | b2b | b2c, période de validité) ;
 *   2. la TVA B2B MONDIALE (19,25 % par défaut), réglage plateforme `tax.b2b.vat` modifiable par le super admin
 *      dans l'espace d'administration, lue sur le backend métier (`GET /api/internal/tax-rules`).
 *
 * Sécurité du prix : si la TVA B2B n'a jamais pu être lue (backend indisponible, aucun cache), la résolution
 * échoue — un devis B2B n'est jamais calculé avec une taxe fausse. Le dernier taux connu reste utilisé en cas de
 * panne passagère.
 */
import axios from "axios";

const CACHE_TTL_MS = 60_000;
const TIMEOUT_MS = 5_000;
const countryCache = new Map();
let globalCache = null; // { at, rules }

export class TaxRulesUnavailableError extends Error {
  constructor() {
    super("Taux de TVA B2B indisponible : réessayez dans un instant.");
    this.name = "TaxRulesUnavailableError";
    this.statusCode = 503;
  }
}

/** Règles du pays en vigueur à la date donnée, au format du moteur (pure, testée). */
export function selectCountryRules(rows, country, at = new Date()) {
  const code = String(country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return [];
  const when = at.getTime();
  const inForce = rows
    .filter((r) => r.isActive && r.countryCode === code)
    .filter((r) => new Date(r.validFrom).getTime() <= when && (r.validTo == null || new Date(r.validTo).getTime() > when))
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
  // Une règle par portée : la plus récente.
  const byScope = new Map();
  for (const r of inForce) if (!byScope.has(r.scope ?? "all")) byScope.set(r.scope ?? "all", r);
  return [...byScope.values()].map((r) => ({
    country: code,
    ratePercent: String(r.ratePercent),
    inclusive: Boolean(r.inclusive),
    scope: r.scope ?? "all",
    label: r.label ?? null,
  }));
}

/** Lecture de la TVA B2B mondiale sur le backend métier (clé interne). */
async function fetchGlobalRulesOverHttp() {
  const base = (process.env.SL_BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
  const res = await axios.get(`${base}/api/internal/tax-rules`, {
    timeout: TIMEOUT_MS,
    headers: { "X-Internal-Api-Key": process.env.INTERNAL_API_KEY ?? "" },
    validateStatus: () => true,
  });
  const b2b = res.status === 200 ? res.data?.data?.b2b : null;
  if (!b2b || !/^\d{1,3}(\.\d{1,3})?$/.test(String(b2b.ratePercent))) throw new TaxRulesUnavailableError();
  return [{ country: null, ratePercent: String(b2b.ratePercent), inclusive: Boolean(b2b.inclusive), scope: "b2b", label: b2b.label ?? "TVA B2B" }];
}

/**
 * Règles applicables (pays d'abord, puis mondiales).
 * @param {string|null} country pays de l'acheteur (ISO 3166 alpha-2), facultatif
 */
export async function resolveTaxRules(country, at = new Date(), deps = {}) {
  const now = Date.now();
  const fetchGlobal = deps.fetchGlobal ?? fetchGlobalRulesOverHttp;

  let global;
  if (globalCache && now - globalCache.at < CACHE_TTL_MS) {
    global = globalCache.rules;
  } else {
    try {
      global = await fetchGlobal();
      globalCache = { at: now, rules: global };
    } catch (error) {
      if (!globalCache) throw error instanceof TaxRulesUnavailableError ? error : new TaxRulesUnavailableError();
      global = globalCache.rules; // panne passagère : dernier taux connu
    }
  }

  let countryRules = [];
  const code = String(country ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) {
    const hit = countryCache.get(code);
    let rows = hit && now - hit.at < CACHE_TTL_MS ? hit.rows : null;
    if (!rows) {
      const model = deps.TaxRule ?? (await import("../../models/tax-rule.model.js")).TaxRule;
      rows = await model.findAll({ where: { countryCode: code, isActive: true }, raw: true });
      countryCache.set(code, { at: now, rows });
    }
    countryRules = selectCountryRules(rows, code, at);
  }

  return [...countryRules, ...global];
}

/** Vide les caches (après modification d'une règle). */
export function clearTaxRuleCache() {
  countryCache.clear();
  globalCache = null;
}
