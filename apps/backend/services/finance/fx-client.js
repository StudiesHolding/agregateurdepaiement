/**
 * Grille de taux de Studies Learning (une seule pour toute la plateforme, ADR-0013) lue depuis le backend métier
 * (`GET /api/v1/fx`, pivot XOF, datée). Mise en cache une heure ; sans grille, les montants restent par devise.
 */
let cache = null;
const TTL = 60 * 60 * 1000;

export async function fxGrid({ fetchImpl = fetch, baseUrl = process.env.SL_BACKEND_URL || "http://localhost:4000", now = Date.now() } = {}) {
    if (cache && now - cache.at < TTL) return cache.grid;
    try {
        const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/v1/fx`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
        const body = await res.json();
        if (!res.ok || !body?.data?.currencies) throw new Error("grille absente");
        const rates = Object.fromEntries(body.data.currencies.map((c) => [c.code, Number(c.ratePerPivot)]));
        cache = { at: now, grid: { pivot: body.data.pivot, asOf: body.data.asOf, source: body.data.source, rates } };
        return cache.grid;
    } catch {
        return cache?.grid ?? null;
    }
}

/** Convertit avec la grille (unités de devise pour 1 pivot). null si une devise manque. */
export function convert(amount, from, to, grid) {
    if (from === to) return Number(amount);
    const a = grid?.rates?.[from];
    const b = grid?.rates?.[to];
    if (!a || !b) return null;
    return (Number(amount) / a) * b;
}

export const _resetFxCache = () => { cache = null; };
