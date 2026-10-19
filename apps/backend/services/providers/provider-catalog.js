/**
 * Prestataires de paiement (ADR-0019, D3) — catalogue et réglages, fonctions pures
 * ================================================================================
 * Les IDENTIFIANTS d'un prestataire vivent dans l'environnement du serveur (gestionnaire de secrets), jamais en
 * base ni dans le tableau de bord : on n'expose que leur PRÉSENCE (oui / non), jamais leur valeur.
 * Les RÉGLAGES métier (maintenance, barème de frais, délai de reversement, note) vivent dans `metadata`.
 */

export const PROVIDER_CATALOG = Object.freeze({
    stripe: {
        name: "Stripe",
        methods: ["card"],
        credentials: [{ env: "STRIPE_SECRET_KEY", label: "Clé secrète" }],
        optional: [],
        webhookPath: "/api/webhooks/stripe",
        verification: "Session Checkout relue auprès de Stripe (référence, montant, devise).",
        mode: (env) => (env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : env.STRIPE_SECRET_KEY ? "test" : null),
    },
    cinetpay: {
        name: "CinetPay",
        methods: ["mobile_money", "card"],
        credentials: [{ env: "CINETPAY_API_KEY", label: "Clé d’API" }, { env: "CINETPAY_SITE_ID", label: "Identifiant du site" }],
        optional: [{ env: "CINETPAY_WEBHOOK_NOTIFY_URL", label: "Adresse de notification" }],
        webhookPath: "/api/webhooks/cinetpay",
        verification: "Transaction vérifiée auprès de l’API CinetPay (statut, montant, devise).",
        mode: () => null,
    },
    kkiapay: {
        name: "KkiaPay",
        methods: ["mobile_money"],
        credentials: [
            { env: "KKIAPAY_PUBLIC_KEY", label: "Clé publique" },
            { env: "KKIAPAY_PRIVATE_KEY", label: "Clé privée" },
            { env: "KKIAPAY_SECRET_KEY", label: "Clé secrète" },
        ],
        optional: [{ env: "KKIAPAY_WEBHOOK_SECRET", label: "Secret des webhooks (signature)" }],
        webhookPath: "/api/webhooks/kkiapay",
        verification: "Transaction vérifiée auprès de KkiaPay (montant, référence) ; signature si le secret est configuré.",
        mode: (env) => (env.KKIAPAY_SANDBOX === "false" ? "live" : "test"),
    },
});

export const isImplemented = (code) => Object.prototype.hasOwnProperty.call(PROVIDER_CATALOG, String(code ?? "").toLowerCase());

/** Préparation technique d'un prestataire : identifiants présents (sans valeur), mode, adresse de webhook. */
export function readiness(code, env = process.env) {
    const def = PROVIDER_CATALOG[String(code ?? "").toLowerCase()];
    if (!def) return { implemented: false, ready: false, credentials: [], optional: [], mode: null, webhookPath: null, verification: null };
    const credentials = def.credentials.map((c) => ({ ...c, present: !!env[c.env] }));
    const optional = def.optional.map((c) => ({ ...c, present: !!env[c.env] }));
    return {
        implemented: true,
        ready: credentials.every((c) => c.present),
        credentials, optional,
        mode: def.mode(env),
        webhookPath: def.webhookPath,
        verification: def.verification,
    };
}

const num = (v, { min = 0, max = Infinity, label }) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} invalide.`);
    return Math.round(n * 1000) / 1000;
};

/**
 * Valide les réglages modifiables d'un prestataire et renvoie les métadonnées fusionnées.
 * Champs : maintenance { active, reason, until }, fees { card|mobile_money: { percent, fixed, currency } },
 * settlementDays, note.
 */
export function mergeSettings(current = {}, input = {}) {
    const out = { ...(current ?? {}) };
    if (input.maintenance !== undefined) {
        const m = input.maintenance ?? {};
        const active = !!m.active;
        const reason = typeof m.reason === "string" ? m.reason.trim().slice(0, 200) : "";
        if (active && reason.length < 3) throw new Error("Indiquez le motif de la maintenance (il est affiché à l’équipe).");
        let until = null;
        if (m.until) {
            const d = new Date(m.until);
            if (Number.isNaN(d.getTime())) throw new Error("Date de fin de maintenance invalide.");
            until = d.toISOString();
        }
        out.maintenance = active ? { active: true, reason, until, since: current?.maintenance?.active ? current.maintenance.since : new Date().toISOString() } : { active: false };
    }
    if (input.fees !== undefined) {
        const fees = {};
        for (const method of ["card", "mobile_money"]) {
            const f = input.fees?.[method];
            if (!f) continue;
            const currency = String(f.currency ?? "").toUpperCase();
            if (f.fixed && !/^[A-Z]{3}$/.test(currency)) throw new Error("Devise des frais fixes invalide.");
            fees[method] = {
                percent: num(f.percent, { max: 25, label: "Pourcentage de frais" }),
                fixed: num(f.fixed, { max: 1_000_000, label: "Frais fixes" }),
                currency: currency || null,
            };
        }
        out.fees = fees;
    }
    if (input.settlementDays !== undefined) {
        const d = Number(input.settlementDays);
        if (!Number.isInteger(d) || d < 0 || d > 90) throw new Error("Délai de reversement invalide (0 à 90 jours).");
        out.settlementDays = d;
    }
    if (input.note !== undefined) out.note = String(input.note ?? "").trim().slice(0, 500) || null;
    return out;
}

/** Frais estimés d'un paiement selon le barème (pour le net). Frais fixes comptés seulement dans leur devise. */
export function estimateFees(metadata, method, amount, currency) {
    const f = metadata?.fees?.[method];
    if (!f) return 0;
    const fixed = f.fixed && f.currency === String(currency).toUpperCase() ? f.fixed : 0;
    return Math.round(((Number(amount) * (f.percent ?? 0)) / 100 + fixed) * 100) / 100;
}
