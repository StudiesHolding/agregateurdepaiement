import { Op, QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { AdminNotification, NotificationDelivery, NotificationRule } from "../../models/index.js";
import { MailService } from "../mail.service.js";
import { convert, fxGrid } from "../finance/fx-client.js";
import { reconciliationReport } from "../finance/reconciliation.js";
import { revenueReport, failuresReport } from "../finance/finance-analytics.js";
import { DEFAULT_RULES, DEFAULT_TIMEZONE, EVENTS, effectiveChannels, localTime, normalizeRule } from "./notification-catalog.js";
import { renderTeamAlert } from "./team-alert-email.js";

/**
 * Moteur de notifications (ADR-0019, D7)
 * ======================================
 *  - emit(event, alert) : événements instantanés ;
 *  - runWatchers(now) : surveillances périodiques (pic d'échecs, prestataire dégradé, notifications en attente,
 *    écarts de rapprochement, résumé quotidien) ;
 *  - anti-répétition par règle et par clé (cooldown), heures calmes, journal de chaque envoi.
 * Une alerte = { title, lines[], severity?, href?, key?, payload? }. Jamais d'exception vers l'appelant.
 */

const IN_APP_TYPE = { info: "INFO", warning: "WARNING", danger: "DANGER" };
const dashboardUrl = (href) => `${(process.env.PSP_DASHBOARD_URL || "http://localhost:3001").replace(/\/$/, "")}${href ?? "/"}`;

export async function ensureDefaultRules() {
    if (await NotificationRule.count()) return;
    for (const d of DEFAULT_RULES) {
        // Une règle invalide n'empêche jamais la création des suivantes.
        try {
            const fields = normalizeRule({ event: d.event, channels: d.channels, params: d.params ?? {}, recipients: { emails: [] }, timezone: DEFAULT_TIMEZONE, cooldownMinutes: 60 });
            await NotificationRule.create({ ...fields, enabled: d.enabled ?? true, updatedBy: "système (règles par défaut)" });
        } catch (err) {
            console.error(`[notifications] règle par défaut ${d.event} :`, err.message);
        }
    }
}

async function recentlySent(rule, key, now) {
    // Le résumé quotidien ne part qu'une fois par jour, quel que soit le réglage d'anti-répétition.
    const minutes = rule.event === "digest.daily" ? 23 * 60 : rule.cooldownMinutes;
    if (!minutes) return false;
    const since = new Date(now.getTime() - minutes * 60_000);
    return (await NotificationDelivery.count({ where: { ruleId: rule.id, dedupeKey: key, status: "sent", createdAt: { [Op.gte]: since } } })) > 0;
}

const log = (rule, event, key, channel, recipient, status, title, detail, payload) =>
    NotificationDelivery.create({ ruleId: rule?.id ?? null, event, dedupeKey: key.slice(0, 190), channel, recipient, status, title: title.slice(0, 255), detail: detail ? String(detail).slice(0, 500) : null, payload: payload ?? null })
        .catch((err) => console.error("[notifications] journal indisponible :", err.message));

/** Envoie une alerte selon une règle (canaux, heures calmes, destinataires) et journalise chaque envoi. */
export async function deliver(rule, event, alert, { now = new Date(), force = false } = {}) {
    const severity = alert.severity ?? rule.severity ?? EVENTS[event]?.severity ?? "info";
    const key = alert.key ?? event;
    // Anti-répétition : rien n'est renvoyé ni journalisé (les surveillances repassent toutes les deux minutes).
    if (!force && (await recentlySent(rule, key, now))) return { skipped: true };
    const channels = effectiveChannels(rule, severity, now);
    const results = [];
    if (channels.inApp || channels.sound) {
        try {
            await AdminNotification.create({
                type: IN_APP_TYPE[severity] ?? "INFO", title: alert.title.slice(0, 255), message: alert.lines.filter(Boolean).join(" "),
                orderReference: alert.orderReference ?? null,
                metadata: { event, ruleId: rule.id, href: alert.href ?? null, sound: !!channels.sound, inApp: !!channels.inApp },
            });
            await log(rule, event, key, channels.inApp ? "inApp" : "sound", null, "sent", alert.title, null, alert.payload);
            results.push("inApp");
        } catch (err) {
            await log(rule, event, key, "inApp", null, "failed", alert.title, err.message, alert.payload);
        }
    }
    if (rule.channels?.email && !channels.email) await log(rule, event, key, "email", null, "skipped", alert.title, "Heures calmes", alert.payload);
    if (channels.email) {
        const emails = rule.recipients?.emails ?? [];
        if (!emails.length) await log(rule, event, key, "email", null, "skipped", alert.title, "Aucun destinataire e-mail configuré", alert.payload);
        for (const to of emails) {
            const html = renderTeamAlert({ title: alert.title, lines: alert.lines, severity, actionUrl: dashboardUrl(alert.href) });
            const info = await MailService.sendEmail({ to, subject: `[Studies Learning · Paiements] ${alert.title}`, html });
            await log(rule, event, key, "email", to, info ? "sent" : "failed", alert.title, info ? null : "Échec de l’envoi (serveur de messagerie)", alert.payload);
            if (info) results.push("email");
        }
    }
    return { sent: results };
}

/** Émet un événement instantané vers toutes les règles actives qui le suivent. Ne lève jamais. */
export async function emit(event, alert, { now = new Date(), amount = null, currency = null } = {}) {
    try {
        const rules = await NotificationRule.findAll({ where: { event, enabled: true } });
        for (const rule of rules) {
            if (event === "payment.succeeded" && Number(rule.params?.minAmount) > 0) {
                const grid = await fxGrid();
                const inRuleCurrency = currency === rule.params.currency ? Number(amount) : convert(Number(amount), currency, rule.params.currency, grid);
                if (inRuleCurrency === null || inRuleCurrency < Number(rule.params.minAmount)) continue;
            }
            await deliver(rule, event, alert, { now });
        }
    } catch (err) {
        console.error(`[notifications] ${event} non émis :`, err.message);
    }
}

// ── Surveillances ────────────────────────────────────────────────────────────

const pct = (v) => `${Math.round(v * 100)} %`;

async function attemptsWindow(minutes, now) {
    const since = new Date(now.getTime() - minutes * 60_000);
    return sequelize.query(
        `SELECT p.id, p.name, COUNT(a.id) AS total, SUM(a.status = 'succeeded') AS ok, SUM(a.status IN ('failed','canceled')) AS ko
         FROM aggp_payment_attempts a JOIN aggp_payment_providers p ON p.id = a.providerId
         WHERE a.createdAt >= :since AND a.status IN ('succeeded','failed','canceled')
         GROUP BY p.id, p.name`,
        { replacements: { since }, type: QueryTypes.SELECT },
    );
}

export const WATCHERS = {
    async "failures.spike"(rule, now) {
        const rows = await attemptsWindow(rule.params.windowMinutes, now);
        const total = rows.reduce((n, r) => n + Number(r.total), 0);
        const ko = rows.reduce((n, r) => n + Number(r.ko ?? 0), 0);
        if (total < rule.params.minAttempts || ko / total < rule.params.failureRate / 100) return [];
        return [{
            title: `Pic d’échecs : ${pct(ko / total)} des paiements échouent`,
            lines: [`${ko} échec(s) sur ${total} tentative(s) en ${rule.params.windowMinutes} minutes (seuil ${rule.params.failureRate} %).`, "Consultez « Échecs et frictions » pour la cause principale et la marche à suivre."],
            href: "/failures", key: `spike:${Math.floor(now.getTime() / (rule.params.windowMinutes * 60_000))}`,
        }];
    },
    async "provider.degraded"(rule, now) {
        const rows = await attemptsWindow(rule.params.windowMinutes, now);
        return rows
            .filter((r) => Number(r.total) >= rule.params.minAttempts && Number(r.ok ?? 0) / Number(r.total) < rule.params.successRate / 100)
            .map((r) => ({
                title: `${r.name} dégradé : ${pct(Number(r.ok ?? 0) / Number(r.total))} de succès`,
                lines: [`${r.ok ?? 0} succès sur ${r.total} tentative(s) en ${rule.params.windowMinutes} minutes (seuil ${rule.params.successRate} %).`, "S’il est en cause, passez-le en maintenance : les bascules prendront le relais."],
                href: "/providers", key: `degraded:${r.id}`,
            }));
    },
    async "webhook.backlog"(rule, now) {
        const since = new Date(now.getTime() - rule.params.olderThanMinutes * 60_000);
        const [row] = await sequelize.query("SELECT COUNT(*) AS n FROM aggp_webhook_events WHERE processed = 0 AND (signatureValid IS NULL OR signatureValid = 1) AND createdAt < :since AND createdAt > :floor", { replacements: { since, floor: new Date(now.getTime() - 7 * 86_400_000) }, type: QueryTypes.SELECT });
        const n = Number(row?.n ?? 0);
        if (n < rule.params.minCount) return [];
        return [{ title: `${n} notification(s) de prestataire en attente`, lines: [`En attente depuis plus de ${rule.params.olderThanMinutes} minutes : des paiements peuvent ne pas être confirmés.`, "Ouvrez « Webhooks », lisez le motif et rejouez une fois la cause corrigée."], href: "/webhooks", key: `backlog:${n}` }];
    },
    async "reconciliation.gap"(rule, now) {
        const r = await reconciliationReport({ days: 7, now });
        const danger = r.groups.filter((g) => g.severity === "danger");
        if (!danger.length) return [];
        const total = danger.reduce((n, g) => n + g.count, 0);
        return [{ title: `${total} écart(s) de rapprochement`, lines: danger.map((g) => `${g.label} : ${g.count}`), href: "/reconciliation", key: `recon:${danger.map((g) => `${g.rule}=${g.count}`).join(",")}` }];
    },
    async "digest.daily"(rule, now) {
        const hour = String(rule.params.hour).padStart(2, "0");
        if (!localTime(now, rule.timezone).startsWith(`${hour}:`)) return [];
        const day = new Intl.DateTimeFormat("fr-CA", { timeZone: rule.timezone }).format(now);
        const [rev, fail] = await Promise.all([revenueReport({ range: "1d" }), failuresReport({ range: "1d" })]);
        const money = (v, c) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);
        return [{
            title: `Résumé du ${new Intl.DateTimeFormat("fr-FR", { timeZone: rule.timezone, day: "numeric", month: "long" }).format(now)}`,
            lines: [
                `Encaissé sur 24 h : ${money(rev.totals.reference.gross, rev.referenceCurrency)} (${rev.totals.count} paiement(s)), net estimé ${money(rev.totals.reference.net, rev.referenceCurrency)}.`,
                fail.rates.success == null ? "Aucun achat tranché sur 24 h." : `Succès des paiements : ${pct(fail.rates.success)} ; abandons ${pct(fail.rates.abandonment ?? 0)}.`,
                fail.categories[0] ? `Première cause de perte : ${fail.categories[0].label} (${fail.categories[0].count}).` : null,
            ],
            href: "/", key: `digest:${day}`,
        }];
    },
};

/** Évalue toutes les surveillances actives. */
export async function runWatchers(now = new Date()) {
    const rules = await NotificationRule.findAll({ where: { enabled: true, event: { [Op.in]: Object.keys(WATCHERS) } } });
    for (const rule of rules) {
        try {
            const alerts = await WATCHERS[rule.event](rule, now);
            for (const a of alerts) await deliver(rule, rule.event, a, { now });
        } catch (err) {
            console.error(`[notifications] surveillance ${rule.event} :`, err.message);
        }
    }
}

let timer = null;
export function startNotificationWatchers(intervalMs = 2 * 60_000) {
    if (timer || process.env.NODE_ENV === "test") return;
    ensureDefaultRules().catch((err) => console.error("[notifications] règles par défaut :", err.message));
    timer = setInterval(() => { runWatchers().catch((err) => console.error("[notifications]", err.message)); }, intervalMs);
    timer.unref?.();
}
