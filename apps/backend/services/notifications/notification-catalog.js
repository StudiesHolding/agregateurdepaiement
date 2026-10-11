/**
 * Catalogue des notifications de l'espace finance (ADR-0019, D7) — fonctions pures
 * ================================================================================
 * Deux familles :
 *  - INSTANTANÉES : émises au moment où l'événement se produit (paiement, confirmation suspecte, signature invalide…) ;
 *  - SURVEILLANCES : évaluées périodiquement sur une fenêtre (pic d'échecs, prestataire dégradé, notifications en
 *    attente, écarts de rapprochement, résumé quotidien).
 * Chaque événement déclare ses paramètres (seuils) et des valeurs par défaut raisonnables.
 */

export const SEVERITIES = ["info", "warning", "danger"];

export const EVENTS = Object.freeze({
    "payment.succeeded": {
        kind: "instant", label: "Paiement confirmé", severity: "info",
        description: "À chaque paiement confirmé, ou seulement au-delà d’un montant (ventes importantes).",
        params: { minAmount: { label: "Montant minimum (0 = tous)", type: "number", min: 0, default: 0 }, currency: { label: "Devise du seuil", type: "currency", default: "XOF" } },
    },
    "payment.failed": {
        kind: "instant", label: "Paiement échoué", severity: "warning",
        description: "Une tentative de paiement a échoué (motif classé et expliqué).",
        params: {},
    },
    "order.to_validate": {
        kind: "instant", label: "Inscription ou achat de licences à valider", severity: "warning",
        description: "Une inscription ou un achat de licences payé attend une validation manuelle de l’équipe.",
        params: {},
    },
    "confirmation.suspicious": {
        kind: "instant", label: "Confirmation de paiement suspecte", severity: "danger",
        description: "Le prestataire confirme un paiement qui ne correspond pas à l’achat (référence, montant ou devise).",
        params: {},
    },
    "webhook.bad_signature": {
        kind: "instant", label: "Notification à signature invalide", severity: "danger",
        description: "Une notification de prestataire a été rejetée : tentative de falsification ou secret mal configuré.",
        params: {},
    },
    "failures.spike": {
        kind: "watch", label: "Pic d’échecs", severity: "danger",
        description: "La part de paiements échoués dépasse un seuil sur une fenêtre glissante.",
        params: {
            windowMinutes: { label: "Fenêtre (minutes)", type: "number", min: 10, max: 1440, default: 60 },
            minAttempts: { label: "Tentatives minimum", type: "number", min: 1, max: 10000, default: 10 },
            failureRate: { label: "Part d’échecs (%)", type: "number", min: 1, max: 100, default: 30 },
        },
    },
    "provider.degraded": {
        kind: "watch", label: "Prestataire dégradé", severity: "danger",
        description: "Le taux de succès d’un prestataire passe sous un seuil sur une fenêtre glissante.",
        params: {
            windowMinutes: { label: "Fenêtre (minutes)", type: "number", min: 10, max: 1440, default: 60 },
            minAttempts: { label: "Tentatives minimum", type: "number", min: 1, max: 10000, default: 5 },
            successRate: { label: "Succès minimum (%)", type: "number", min: 1, max: 100, default: 70 },
        },
    },
    "webhook.backlog": {
        kind: "watch", label: "Notifications en attente", severity: "warning",
        description: "Des notifications de prestataires attendent leur traitement depuis trop longtemps.",
        params: {
            olderThanMinutes: { label: "En attente depuis (minutes)", type: "number", min: 5, max: 1440, default: 15 },
            minCount: { label: "Nombre minimum", type: "number", min: 1, max: 1000, default: 1 },
        },
    },
    "reconciliation.gap": {
        kind: "watch", label: "Écart de rapprochement", severity: "danger",
        description: "Un client a payé sans être servi, ou un achat est payé sans preuve de paiement.",
        params: {},
    },
    "digest.daily": {
        kind: "watch", label: "Résumé quotidien", severity: "info",
        description: "Chaque matin : encaissé de la veille, succès, premières causes d’échec, points à traiter.",
        params: { hour: { label: "Heure d’envoi (fuseau de la règle)", type: "number", min: 0, max: 23, default: 8 } },
    },
});

export const CHANNELS = ["inApp", "email", "sound"];
export const DEFAULT_TIMEZONE = "Africa/Douala";

/** Règles créées au premier démarrage : utiles d'emblée, sans destinataire e-mail tant qu'on n'en a pas choisi. */
export const DEFAULT_RULES = [
    { event: "confirmation.suspicious", channels: { inApp: true, email: true, sound: true } },
    { event: "webhook.bad_signature", channels: { inApp: true, email: true, sound: true } },
    { event: "failures.spike", channels: { inApp: true, email: true, sound: true } },
    { event: "provider.degraded", channels: { inApp: true, email: true, sound: false } },
    { event: "webhook.backlog", channels: { inApp: true, email: false, sound: false } },
    { event: "reconciliation.gap", channels: { inApp: true, email: true, sound: false } },
    { event: "order.to_validate", channels: { inApp: true, email: false, sound: true } },
    { event: "payment.failed", channels: { inApp: true, email: false, sound: false }, enabled: false },
    { event: "payment.succeeded", channels: { inApp: true, email: false, sound: true }, params: { minAmount: 500000, currency: "XOF" } },
    { event: "digest.daily", channels: { inApp: false, email: true, sound: false } },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valide une règle saisie ; renvoie les champs normalisés ou lève une erreur lisible. */
export function normalizeRule(input = {}, { partial = false } = {}) {
    const out = {};
    const has = (k) => input[k] !== undefined;
    let def = null;
    if (!partial || has("event")) {
        def = EVENTS[input.event];
        if (!def) throw new Error("Événement inconnu.");
        out.event = input.event;
    }
    if (has("name")) out.name = String(input.name ?? "").trim().slice(0, 120) || null;
    if (has("enabled")) out.enabled = !!input.enabled;
    if (!partial || has("severity")) {
        const s = input.severity ?? def?.severity ?? "info";
        if (!SEVERITIES.includes(s)) throw new Error("Gravité invalide.");
        out.severity = s;
    }
    if (!partial || has("channels")) {
        const c = input.channels ?? {};
        out.channels = Object.fromEntries(CHANNELS.map((k) => [k, !!c[k]]));
        if (!Object.values(out.channels).some(Boolean)) throw new Error("Choisissez au moins un canal.");
    }
    if (!partial || has("recipients")) {
        const emails = Array.from(new Set((input.recipients?.emails ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean)));
        const bad = emails.find((e) => !EMAIL.test(e));
        if (bad) throw new Error(`Adresse e-mail invalide : ${bad}`);
        if (emails.length > 30) throw new Error("30 destinataires au plus.");
        out.recipients = { emails };
    }
    if (!partial || has("params")) {
        const schema = (def ?? EVENTS[input.event] ?? {}).params ?? {};
        const params = {};
        for (const [k, spec] of Object.entries(schema)) {
            const v = input.params?.[k] ?? spec.default;
            if (spec.type === "currency") {
                const c = String(v ?? "").toUpperCase();
                if (!/^[A-Z]{3}$/.test(c)) throw new Error(`${spec.label} : devise invalide.`);
                params[k] = c;
            } else {
                const n = Number(v);
                if (!Number.isFinite(n) || (spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) throw new Error(`${spec.label} : valeur invalide.`);
                params[k] = n;
            }
        }
        out.params = params;
    }
    if (!partial || has("quietHours")) {
        const q = input.quietHours;
        if (q && (q.from || q.to)) {
            if (!HHMM.test(q.from ?? "") || !HHMM.test(q.to ?? "")) throw new Error("Heures calmes : format HH:MM attendu.");
            out.quietHours = { from: q.from, to: q.to, allowDanger: q.allowDanger !== false };
        } else out.quietHours = null;
    }
    if (!partial || has("timezone")) {
        const tz = String(input.timezone ?? DEFAULT_TIMEZONE);
        try { new Intl.DateTimeFormat("fr-FR", { timeZone: tz }); } catch { throw new Error("Fuseau horaire invalide."); }
        out.timezone = tz;
    }
    if (!partial || has("cooldownMinutes")) {
        const c = Number(input.cooldownMinutes ?? 60);
        if (!Number.isInteger(c) || c < 0 || c > 10080) throw new Error("Anti-répétition invalide (0 à 10 080 minutes).");
        out.cooldownMinutes = c;
    }
    return out;
}

/** Heure locale « HH:MM » dans un fuseau. */
export function localTime(now, timezone = DEFAULT_TIMEZONE) {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

/** Dans les heures calmes ? (plage pouvant passer minuit, ex. 22:00 → 07:00) */
export function inQuietHours(now, quietHours, timezone = DEFAULT_TIMEZONE) {
    if (!quietHours?.from || !quietHours?.to) return false;
    const t = localTime(now, timezone);
    const { from, to } = quietHours;
    return from <= to ? t >= from && t < to : t >= from || t < to;
}

/** Canaux effectivement utilisés : pendant les heures calmes, e-mail et son se taisent (sauf urgence si permis). */
export function effectiveChannels(rule, severity, now) {
    const c = { ...rule.channels };
    if (inQuietHours(now, rule.quietHours, rule.timezone) && !(severity === "danger" && rule.quietHours?.allowDanger)) {
        c.email = false;
        c.sound = false;
    }
    return c;
}
