import { AdminNotification, PaymentProvider } from "../../models/index.js";
import { AnalyticsService } from "../analytics.service.js";
import { ProviderRouterService } from "../provider-router.service.js";
import { inMaintenance } from "../routing/routing-engine.js";
import { readiness } from "../providers/provider-catalog.js";
import { failuresReport, revenueReport } from "./finance-analytics.js";
import { reconciliationReport } from "./reconciliation.js";

/**
 * Centre de pilotage (ADR-0019, D6) : l'essentiel en un écran et la liste de ce qu'il faut traiter maintenant,
 * chaque point avec son lien d'action.
 */
export function laneRisks(rules) {
    const lanes = new Map();
    for (const r of rules) {
        const key = `${r.countryCode}|${r.currency}|${r.paymentMethod ?? "any"}`;
        const usable = r.isActive && r.provider?.isActive && !inMaintenance(r.provider);
        const l = lanes.get(key) ?? { key, countryCode: r.countryCode, currency: r.currency, paymentMethod: r.paymentMethod ?? "any", usable: new Set() };
        if (usable) l.usable.add(Number(r.provider.id));
        lanes.set(key, l);
    }
    const all = [...lanes.values()];
    return { total: all.length, broken: all.filter((l) => l.usable.size === 0), noFallback: all.filter((l) => l.usable.size === 1) };
}

export async function overviewReport({ ref = "XOF" } = {}) {
    const [week, day, failures, recon, perf, providers, rules, alerts] = await Promise.all([
        revenueReport({ range: "7d", ref }),
        revenueReport({ range: "1d", ref }),
        failuresReport({ range: "1d", ref }),
        reconciliationReport({ days: 30 }),
        AnalyticsService.getProviderPerformance("24h"),
        PaymentProvider.findAll(),
        ProviderRouterService.loadRules(),
        AdminNotification.findAll({ where: { type: "DANGER", isRead: false }, order: [["createdAt", "DESC"]], limit: 20 }),
    ]);
    const lanes = laneRisks(rules);
    const health = providers.map((p) => {
        const s = perf.find((x) => Number(x.providerId) === Number(p.id)) ?? {};
        const r = readiness(p.code);
        const status = !r.ready ? "not_configured" : inMaintenance(p) ? "maintenance" : !p.isActive ? "inactive" : s.healthStatus ?? "idle";
        return { id: p.id, name: p.name, code: p.code, status, successRate: s.totalAttempts ? Number(s.successRate) : null, attempts: Number(s.totalAttempts ?? 0), mode: r.mode };
    });

    const todo = [];
    for (const g of recon.groups) todo.push({ severity: g.severity, title: `${g.label} (${g.count})`, detail: g.action, href: g.rule.startsWith("webhook") ? "/webhooks" : "/reconciliation" });
    for (const a of alerts) todo.push({ severity: "danger", title: a.title, detail: a.message, href: a.orderReference ? `/transactions?search=${encodeURIComponent(a.orderReference)}` : "/transactions" });
    for (const h of health) {
        if (h.status === "not_configured") todo.push({ severity: "danger", title: `${h.name} : identifiants manquants`, detail: "Le prestataire ne peut pas encaisser tant que ses identifiants ne sont pas dans l’environnement du serveur.", href: "/providers" });
        if (h.status === "critical" || h.status === "degraded") todo.push({ severity: h.status === "critical" ? "danger" : "warning", title: `${h.name} : ${h.status === "critical" ? "taux de succès critique" : "taux de succès dégradé"} (${h.successRate} %)`, detail: "Analyser les échecs ; si le prestataire est en cause, le passer en maintenance pour activer les bascules.", href: "/failures" });
    }
    if (lanes.broken.length) todo.push({ severity: "danger", title: `${lanes.broken.length} voie(s) sans prestataire disponible`, detail: lanes.broken.slice(0, 4).map((l) => `${l.countryCode} · ${l.currency} · ${l.paymentMethod}`).join(" ; "), href: "/routing" });
    if (lanes.noFallback.length) todo.push({ severity: "warning", title: `${lanes.noFallback.length} voie(s) sans bascule`, detail: "Une panne du prestataire unique bloquerait ces paiements : ajoutez un prestataire de bascule.", href: "/routing" });
    todo.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));

    return {
        referenceCurrency: week.referenceCurrency,
        fx: week.fx,
        revenue: {
            today: { gross: day.totals.reference.gross, net: day.totals.reference.net, count: day.totals.count },
            week: { gross: week.totals.reference.gross, net: week.totals.reference.net, count: week.totals.count, previousGross: week.previous.gross },
            series: week.series,
        },
        last24h: { funnel: failures.funnel, successRate: failures.rates.success, topCause: failures.categories[0] ? { label: failures.categories[0].label, count: failures.categories[0].count } : null },
        providers: health,
        lanes: { total: lanes.total, broken: lanes.broken.length, noFallback: lanes.noFallback.length },
        reconciliation: { total: recon.total },
        todo,
    };
}
