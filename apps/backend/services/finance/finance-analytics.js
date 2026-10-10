import { QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { PaymentProvider } from "../../models/index.js";
import { estimateFees } from "../providers/provider-catalog.js";
import { parseJson } from "../../utils/json-column.js";
import { classify, CATEGORIES } from "./failure-taxonomy.js";
import { convert, fxGrid } from "./fx-client.js";

/**
 * Analyse financière de l'agrégateur (ADR-0019, D4-D5)
 * ====================================================
 * Provenance des revenus (brut, frais estimés, net ; par pays, prestataire, moyen, produit, canal), entonnoir du
 * canal de paiement et échecs expliqués. Les montants restent exacts PAR DEVISE ; l'équivalent dans une devise de
 * référence utilise la grille de taux de la plateforme (jamais une somme de devises différentes).
 */

export const ABANDON_AFTER_MINUTES = 30;
const DAY = 86_400_000;

export const PRODUCT_LABELS = {
    course: "Formation", admission: "Frais de dossier", b2b: "Licences entreprise", thematique: "Thématique entreprise", auction: "Enchère", other: "Autre",
};
export const CHANNEL_LABELS = { direct: "Catalogue", trainer_link: "Lien formateur", institution_link: "Lien établissement", unknown: "Non renseigné" };
export const METHOD_LABELS = { card: "Carte bancaire", mobile_money: "Mobile Money", unknown: "Non renseigné" };

/** Période demandée : 7d | 30d | 90d | 12m, ou from/to (AAAA-MM-JJ). Renvoie aussi la période précédente. */
export function resolvePeriod({ range = "30d", from, to } = {}, now = new Date()) {
    let end = to ? new Date(`${to}T23:59:59.999Z`) : now;
    let start;
    if (from) start = new Date(`${from}T00:00:00.000Z`);
    else {
        const days = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[range] ?? 30;
        start = new Date(end.getTime() - days * DAY);
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw new Error("Période invalide.");
    if (end.getTime() - start.getTime() > 400 * DAY) throw new Error("Période trop longue (400 jours au plus).");
    const span = end.getTime() - start.getTime();
    return { start, end, previous: { start: new Date(start.getTime() - span), end: start } };
}

export function productOf(orderMeta, intentMeta, lmsItemType) {
    const m = { ...(intentMeta ?? {}), ...(orderMeta ?? {}) };
    if (m.source === "AUCTION") return "auction";
    if (m.purchase_type === "ADMISSION_FEE") return "admission";
    if (m.thematique_id || lmsItemType === "thematique") return "thematique";
    if (m.is_b2b || m.b2b_purchase || m.purchase_type === "B2B_PACKAGE" || lmsItemType === "package") return "b2b";
    if (m.purchase_type === "B2C_COURSE" || lmsItemType === "course") return "course";
    return "other";
}

/** Moyen de paiement : enregistré depuis ADR-0019 ; sinon déduit d'un prestataire qui n'en propose qu'un. */
export function methodOf(meta, provider) {
    if (meta?.payment_method === "card" || meta?.payment_method === "mobile_money") return meta.payment_method;
    if (provider && provider.supportCard && !provider.supportMobileMoney) return "card";
    if (provider && provider.supportMobileMoney && !provider.supportCard) return "mobile_money";
    return "unknown";
}

const bump = (map, key, label, amountRef, extra = {}) => {
    const e = (map[key] ??= { key, label, gross: 0, count: 0, ...extra });
    e.gross += amountRef ?? 0;
    e.count += 1;
    return e;
};
const sortShare = (map, total) => Object.values(map).sort((a, b) => b.gross - a.gross || b.count - a.count).map((e) => ({ ...e, gross: round(e.gross), share: total ? e.gross / total : 0 }));
const round = (v) => Math.round(v * 100) / 100;

/**
 * Agrège les intentions de paiement d'une période (fonction pure).
 * @param rows intentions avec { amount, currency, status, createdAt, updatedAt, intentMeta, orderMeta, country, lmsItemType, formationName, providerId, attempts }
 */
export function aggregateRevenue(rows, { providers = new Map(), grid = null, ref = "XOF" } = {}) {
    const byCurrency = {};
    const breakdown = { country: {}, provider: {}, method: {}, product: {}, channel: {} };
    const series = {};
    const formations = {};
    const discounts = { total: 0, count: 0, byFunder: {} };
    let refGross = 0;
    let refFees = 0;
    let unconverted = 0;
    let count = 0;

    for (const r of rows) {
        if (r.status !== "succeeded") continue;
        count += 1;
        const amount = Number(r.amount);
        const provider = providers.get(Number(r.providerId)) ?? null;
        const meta = { ...(r.intentMeta ?? {}), ...(r.orderMeta ?? {}) };
        const method = methodOf(meta, provider);
        // Moyen inconnu (paiements antérieurs à ADR-0019) : Mobile Money si le prestataire le propose, sinon carte.
        const feeMethod = method === "unknown" ? (provider?.supportMobileMoney ? "mobile_money" : "card") : method;
        const fees = provider ? estimateFees(provider.metadata, feeMethod, amount, r.currency) : 0;
        const c = (byCurrency[r.currency] ??= { currency: r.currency, gross: 0, fees: 0, net: 0, count: 0 });
        c.gross += amount; c.fees += fees; c.net += amount - fees; c.count += 1;

        const amountRef = convert(amount, r.currency, ref, grid);
        const feesRef = convert(fees, r.currency, ref, grid);
        if (amountRef === null) { unconverted += 1; } else { refGross += amountRef; refFees += feesRef ?? 0; }

        const country = (r.country || meta.country_code || "").toUpperCase() || "??";
        bump(breakdown.country, country, country, amountRef);
        bump(breakdown.provider, provider?.code ?? "unknown", provider?.name ?? "Non renseigné", amountRef);
        bump(breakdown.method, method, METHOD_LABELS[method], amountRef);
        const product = productOf(r.orderMeta, r.intentMeta, r.lmsItemType);
        bump(breakdown.product, product, PRODUCT_LABELS[product], amountRef);
        const channel = meta.channel && CHANNEL_LABELS[meta.channel] ? meta.channel : "unknown";
        bump(breakdown.channel, channel, CHANNEL_LABELS[channel], amountRef);

        const day = new Date(r.updatedAt ?? r.createdAt).toISOString().slice(0, 10);
        const s = (series[day] ??= { date: day, gross: 0, count: 0 });
        s.gross += amountRef ?? 0; s.count += 1;

        const name = r.formationName || meta.formation_name || meta.company_name || null;
        if (name) bump(formations, name, name, amountRef);

        const discount = Number(meta.coupon_discount ?? 0);
        if (discount > 0) {
            const dRef = convert(discount, r.currency, ref, grid) ?? 0;
            discounts.total += dRef; discounts.count += 1;
            const funder = meta.coupon_funder || "unknown";
            discounts.byFunder[funder] = round((discounts.byFunder[funder] ?? 0) + dRef);
        }
    }

    const currencies = Object.values(byCurrency).map((c) => ({ ...c, gross: round(c.gross), fees: round(c.fees), net: round(c.net), avg: c.count ? round(c.gross / c.count) : 0 })).sort((a, b) => b.count - a.count);
    return {
        referenceCurrency: ref,
        totals: {
            count,
            byCurrency: currencies,
            reference: { gross: round(refGross), fees: round(refFees), net: round(refGross - refFees), avg: count - unconverted ? round(refGross / (count - unconverted)) : 0, unconverted },
        },
        series: Object.values(series).sort((a, b) => a.date.localeCompare(b.date)).map((s) => ({ ...s, gross: round(s.gross) })),
        breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, sortShare(v, refGross)])),
        topFormations: sortShare(formations, refGross).slice(0, 10),
        discounts: { ...discounts, total: round(discounts.total) },
    };
}

/**
 * Entonnoir et échecs (fonction pure).
 * @param rows intentions (voir aggregateRevenue) ; `lastFailure` = dernière tentative échouée { errorCode, errorMessage, responsePayload, providerId, status }
 */
export function aggregateFailures(rows, { providers = new Map(), grid = null, ref = "XOF", now = new Date() } = {}) {
    const funnel = { created: 0, attempted: 0, succeeded: 0, failed: 0, abandoned: 0, pending: 0 };
    const categories = {};
    const byProvider = {};
    const byCountry = {};
    const byMethod = {};
    const payTimes = [];
    let multiAttempt = 0;
    let recovered = 0;

    for (const r of rows) {
        funnel.created += 1;
        const attempts = Number(r.attempts ?? 0);
        if (attempts > 0) funnel.attempted += 1;
        if (attempts > 1) multiAttempt += 1;
        const meta = { ...(r.intentMeta ?? {}), ...(r.orderMeta ?? {}) };
        const provider = providers.get(Number(r.providerId ?? r.lastFailure?.providerId)) ?? null;
        const country = (r.country || meta.country_code || "").toUpperCase() || "??";
        const method = methodOf(meta, provider);
        const pkey = provider?.code ?? "unknown";
        const p = (byProvider[pkey] ??= { key: pkey, label: provider?.name ?? "Avant choix du prestataire", total: 0, succeeded: 0, failed: 0, abandoned: 0 });
        const c = (byCountry[country] ??= { key: country, label: country, total: 0, succeeded: 0, failed: 0, abandoned: 0 });
        const m = (byMethod[method] ??= { key: method, label: METHOD_LABELS[method], total: 0, succeeded: 0, failed: 0, abandoned: 0 });
        for (const x of [p, c, m]) x.total += 1;

        if (r.status === "succeeded") {
            funnel.succeeded += 1;
            for (const x of [p, c, m]) x.succeeded += 1;
            if (attempts > 1) recovered += 1;
            const secs = (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 1000;
            if (secs >= 0 && secs < 7 * 86400) payTimes.push(secs);
            continue;
        }
        const ageMin = (now.getTime() - new Date(r.createdAt).getTime()) / 60000;
        const failed = r.status === "failed" || r.status === "canceled";
        if (!failed && ageMin < ABANDON_AFTER_MINUTES) { funnel.pending += 1; continue; }

        const f = r.lastFailure;
        const cls = failed || f ? classify({ errorCode: f?.errorCode, errorMessage: f?.errorMessage, response: f?.responsePayload, status: r.status }) : classify({ abandoned: true });
        if (cls.category === "abandoned") { funnel.abandoned += 1; for (const x of [p, c, m]) x.abandoned += 1; }
        else { funnel.failed += 1; for (const x of [p, c, m]) x.failed += 1; }

        const amountRef = convert(Number(r.amount), r.currency, ref, grid) ?? 0;
        const e = (categories[cls.category] ??= { category: cls.category, label: cls.label, explanation: cls.explanation, action: cls.action, owner: cls.owner, tone: cls.tone, count: 0, amountAtRisk: 0, providers: {}, examples: [] });
        e.count += 1;
        e.amountAtRisk += amountRef;
        e.providers[provider?.name ?? "Avant choix du prestataire"] = (e.providers[provider?.name ?? "Avant choix du prestataire"] ?? 0) + 1;
        if (e.examples.length < 5) {
            e.examples.push({ reference: r.reference ?? null, provider: provider?.name ?? null, amount: Number(r.amount), currency: r.currency, at: r.createdAt, errorCode: f?.errorCode ?? null, errorMessage: f?.errorMessage ?? null, country });
        }
    }

    const lost = funnel.failed + funnel.abandoned;
    const decided = funnel.succeeded + lost;
    payTimes.sort((a, b) => a - b);
    const rate = (o) => ({ ...o, successRate: o.succeeded + o.failed + o.abandoned ? o.succeeded / (o.succeeded + o.failed + o.abandoned) : null });
    return {
        referenceCurrency: ref,
        abandonAfterMinutes: ABANDON_AFTER_MINUTES,
        funnel,
        rates: { success: decided ? funnel.succeeded / decided : null, abandonment: decided ? funnel.abandoned / decided : null, failure: decided ? funnel.failed / decided : null },
        medianTimeToPaySeconds: payTimes.length ? payTimes[Math.floor(payTimes.length / 2)] : null,
        failover: { intentsWithSeveralAttempts: multiAttempt, recoveredByFailover: recovered },
        categories: Object.values(categories).sort((a, b) => b.count - a.count).map((e) => ({ ...e, amountAtRisk: round(e.amountAtRisk), share: lost ? e.count / lost : 0 })),
        byProvider: Object.values(byProvider).map(rate).sort((a, b) => b.total - a.total),
        byCountry: Object.values(byCountry).map(rate).sort((a, b) => b.total - a.total),
        byMethod: Object.values(byMethod).map(rate).sort((a, b) => b.total - a.total),
        catalog: CATEGORIES,
    };
}

// ── Lecture des données ──────────────────────────────────────────────────────

async function loadIntents(start, end) {
    const rows = await sequelize.query(
        `SELECT pi.id, pi.amount, pi.currency, pi.status, pi.created_at AS createdAt, pi.updated_at AS updatedAt, pi.metadata AS intentMeta,
                o.reference, o.metadata AS orderMeta, o.customer_country AS country, o.lms_item_type AS lmsItemType, o.formation_name AS formationName,
                (SELECT pa.providerId FROM aggp_payment_attempts pa WHERE pa.paymentIntentId = pi.id AND pa.status = 'succeeded' ORDER BY pa.id DESC LIMIT 1) AS providerId,
                (SELECT COUNT(*) FROM aggp_payment_attempts pa WHERE pa.paymentIntentId = pi.id) AS attempts
         FROM aggp_payment_intents pi
         LEFT JOIN aggp_orders o ON o.id = pi.order_id
         WHERE pi.created_at >= :start AND pi.created_at < :end`,
        { replacements: { start, end }, type: QueryTypes.SELECT },
    );
    const failedIds = rows.filter((r) => r.status !== "succeeded").map((r) => r.id);
    const failures = failedIds.length
        ? await sequelize.query(
            `SELECT pa.paymentIntentId AS intentId, pa.providerId, pa.errorCode, pa.errorMessage, pa.responsePayload, pa.status
             FROM aggp_payment_attempts pa
             WHERE pa.paymentIntentId IN (:ids) AND pa.status IN ('failed','canceled')
             ORDER BY pa.id ASC`,
            { replacements: { ids: failedIds }, type: QueryTypes.SELECT },
        )
        : [];
    const last = new Map(failures.map((f) => [Number(f.intentId), { ...f, responsePayload: parseJson(f.responsePayload) }]));
    return rows.map((r) => ({
        ...r, amount: Number(r.amount), attempts: Number(r.attempts), intentMeta: parseJson(r.intentMeta) ?? {}, orderMeta: parseJson(r.orderMeta) ?? {},
        lastFailure: last.get(Number(r.id)) ?? null,
    }));
}

async function context(ref) {
    const [providers, grid] = await Promise.all([PaymentProvider.findAll(), fxGrid()]);
    const reference = grid?.rates?.[ref] ? ref : grid ? grid.pivot : ref;
    return { providers: new Map(providers.map((p) => [Number(p.id), p])), grid, ref: reference };
}

export async function revenueReport(query = {}) {
    const period = resolvePeriod(query);
    const ctx = await context(String(query.ref ?? "XOF").toUpperCase());
    const [current, previous] = await Promise.all([loadIntents(period.start, period.end), loadIntents(period.previous.start, period.previous.end)]);
    const report = aggregateRevenue(current, ctx);
    const prev = aggregateRevenue(previous, ctx);
    return {
        period: { start: period.start, end: period.end },
        fx: ctx.grid ? { asOf: ctx.grid.asOf, source: ctx.grid.source, pivot: ctx.grid.pivot, available: true } : { available: false },
        ...report,
        previous: { gross: prev.totals.reference.gross, count: prev.totals.count },
    };
}

export async function failuresReport(query = {}) {
    const period = resolvePeriod(query);
    const ctx = await context(String(query.ref ?? "XOF").toUpperCase());
    const rows = await loadIntents(period.start, period.end);
    return { period: { start: period.start, end: period.end }, ...aggregateFailures(rows, ctx) };
}
