/**
 * Taux de change de la plateforme (ADR-0013 du backend métier, D4 et D5).
 *
 * Source UNIQUE : le backend métier (`GET /api/internal/fx`, clé interne) — grille tarifaire de la direction, pivot
 * XOF, parités fixes exactes avec l'euro, taux flottants administrés par le super admin, majoration de change.
 * L'agrégateur ne code aucun taux.
 *
 * Sécurité du prix (même règle que la TVA) : si les taux n'ont jamais pu être lus, la résolution échoue (503) — aucun
 * montant n'est jamais converti avec un taux inventé. En cas de panne passagère, le dernier jeu de taux connu reste
 * utilisé. Tous les calculs se font sur les fractions EXACTES (`ratio`), jamais sur les décimales arrondies.
 */
import axios from "axios";

const CACHE_TTL_MS = 60_000;
const TIMEOUT_MS = 5_000;
const BPS = 10_000n;
let cache = null; // { at, snapshot }

export class FxRatesUnavailableError extends Error {
  constructor() {
    super("Taux de change indisponibles : réessayez dans un instant.");
    this.name = "FxRatesUnavailableError";
    this.statusCode = 503;
  }
}

export class UnsupportedCurrencyError extends Error {
  constructor(currency) {
    super(`Devise non prise en charge : « ${currency} ».`);
    this.name = "UnsupportedCurrencyError";
    this.statusCode = 409;
  }
}

const DIGITS = /^\d{1,40}$/;

/** Vérifie et normalise le jeu de taux reçu (pure, testée) : une réponse incomplète ou incohérente est refusée. */
export function parseSnapshot(data) {
  if (!data || data.pivot !== "XOF" || !Array.isArray(data.currencies) || data.currencies.length === 0) {
    throw new FxRatesUnavailableError();
  }
  const currencies = new Map();
  for (const c of data.currencies) {
    const num = String(c?.ratio?.num ?? "");
    const den = String(c?.ratio?.den ?? "");
    if (!/^[A-Z]{3}$/.test(c?.code ?? "") || !DIGITS.test(num) || !DIGITS.test(den) || num === "0" || /^0+$/.test(den)) {
      throw new FxRatesUnavailableError();
    }
    if (!Number.isInteger(c.exponent) || c.exponent < 0 || c.exponent > 3) throw new FxRatesUnavailableError();
    currencies.set(c.code, { code: c.code, exponent: c.exponent, fixed: Boolean(c.fixed), num: BigInt(num), den: BigInt(den) });
  }
  if (!currencies.has("XOF")) throw new FxRatesUnavailableError();
  const percent = String(data.markup?.percent ?? "0");
  if (!/^\d{1,2}(\.\d{1,3})?$/.test(percent)) throw new FxRatesUnavailableError();
  const [whole, frac = ""] = percent.split(".");
  const markupBps = BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2)) + (Number(frac[2] ?? 0) >= 5 ? 1n : 0n);
  return {
    asOf: String(data.asOf ?? ""),
    source: String(data.source ?? ""),
    markupBps,
    markupOnBase: Boolean(data.markup?.applyToBaseCurrency),
    currencies,
  };
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Taux de règlement EXACT « unités de `to` pour 1 unité de `from` » (pure, testée), au format attendu par
 * `quote({ settlement: { currency, rate } })` du moteur de prix.
 * `withMarkup` : majoration de change (montant présenté et facturé à l'acheteur) — appliquée si les devises
 * diffèrent, ou dans la même devise si le réglage le prévoit (comme la grille). Jamais pour une conversion interne.
 */
export function settlementRate(snapshot, from, to, { withMarkup = false } = {}) {
  const source = snapshot.currencies.get(String(from ?? "").toUpperCase());
  const target = snapshot.currencies.get(String(to ?? "").toUpperCase());
  if (!source) throw new UnsupportedCurrencyError(from);
  if (!target) throw new UnsupportedCurrencyError(to);
  const applyMarkup = withMarkup && (source.code !== target.code || snapshot.markupOnBase);
  const markup = applyMarkup ? BPS + snapshot.markupBps : BPS;
  // 1 XOF = s.num/s.den source et t.num/t.den cible → 1 source = (t.num × s.den) / (t.den × s.num) cible.
  let num = target.num * source.den * markup;
  let den = target.den * source.num * BPS;
  const g = gcd(num, den);
  num /= g;
  den /= g;
  return { num, den, markupApplied: applyMarkup, asOf: snapshot.asOf };
}

async function fetchSnapshotOverHttp() {
  const base = (process.env.SL_BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
  const res = await axios.get(`${base}/api/internal/fx`, {
    timeout: TIMEOUT_MS,
    headers: { "X-Internal-Api-Key": process.env.INTERNAL_API_KEY ?? "" },
    validateStatus: () => true,
  });
  if (res.status !== 200) throw new FxRatesUnavailableError();
  return parseSnapshot(res.data?.data);
}

/** Jeu de taux en vigueur (cache 60 s ; dernier jeu connu en cas de panne passagère). */
export async function resolveFxRates(deps = {}) {
  const now = deps.now?.() ?? Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.snapshot;
  const fetchSnapshot = deps.fetchSnapshot ?? fetchSnapshotOverHttp;
  try {
    const snapshot = await fetchSnapshot();
    cache = { at: now, snapshot };
    return snapshot;
  } catch (error) {
    if (cache) {
      console.error("[FxRates] backend métier injoignable : dernier jeu de taux connu utilisé", error?.message ?? error);
      return cache.snapshot;
    }
    throw error instanceof FxRatesUnavailableError ? error : new FxRatesUnavailableError();
  }
}

/** Vide le cache (tests, ou après une modification connue des taux). */
export function clearFxCache() {
  cache = null;
}
