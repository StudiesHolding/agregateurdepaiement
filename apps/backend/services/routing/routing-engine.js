/**
 * Moteur de routage des paiements (ADR-0019, D2) — fonctions pures
 * =================================================================
 * Une RÈGLE relie un prestataire à un pays (ou « * » pour tous), une devise, un moyen de paiement (`card`,
 * `mobile_money` ou `any`) et une tranche de montant, avec une PRIORITÉ (plus petit = essayé d'abord).
 *
 * Résolution déterministe :
 *   1. on écarte ce qui ne peut pas servir (règle ou prestataire désactivé, maintenance, devise, pays, moyen, montant) ;
 *   2. on classe : pays exact avant « * », moyen exact avant `any`, puis priorité, puis ancienneté de la règle ;
 *   3. un prestataire n'apparaît qu'une fois (sa meilleure règle) ; les suivants servent de bascule.
 * Jamais de repli vers une autre devise : un client ne doit pas payer dans une monnaie qu'il n'a pas choisie.
 * Chaque règle examinée reçoit un motif lisible (simulateur, journal de décision).
 */

export const PAYMENT_METHODS = Object.freeze(["card", "mobile_money"]);
export const RULE_METHODS = Object.freeze(["any", ...PAYMENT_METHODS]);
export const METHOD_LABELS = Object.freeze({ card: "Carte bancaire", mobile_money: "Mobile Money", any: "Tous les moyens" });

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Prestataire en maintenance (métadonnées) : actif, et pas encore à échéance s'il y en a une. */
export function inMaintenance(provider, now = new Date()) {
    const m = provider?.metadata?.maintenance;
    if (!m?.active) return false;
    if (m.until && new Date(m.until) <= now) return false;
    return true;
}

function supportsMethod(provider, method) {
    return method === "card" ? !!provider.supportCard : !!provider.supportMobileMoney;
}

/** Motif d'exclusion d'une règle pour une demande, ou null si elle est utilisable. */
export function exclusionReason(rule, request, now = new Date()) {
    const p = rule.provider;
    if (!p) return "Prestataire introuvable";
    if (!rule.isActive) return "Règle désactivée";
    if (!p.isActive) return `${p.name} est désactivé`;
    if (inMaintenance(p, now)) return `${p.name} est en maintenance${p.metadata?.maintenance?.reason ? ` (${p.metadata.maintenance.reason})` : ""}`;
    if (String(rule.currency).toUpperCase() !== request.currency) return `Devise ${rule.currency}, demandée ${request.currency}`;
    if (rule.countryCode !== "*" && request.countryCode === null) return `Réservée au pays ${rule.countryCode} ; pays du client inconnu`;
    if (rule.countryCode !== "*" && String(rule.countryCode).toUpperCase() !== request.countryCode) return `Pays ${rule.countryCode}, demandé ${request.countryCode}`;
    const method = rule.paymentMethod ?? "any";
    if (method !== "any" && method !== request.paymentMethod) return `Réservée à ${METHOD_LABELS[method] ?? method}`;
    if (!supportsMethod(p, request.paymentMethod)) return `${p.name} ne propose pas ${METHOD_LABELS[request.paymentMethod]}`;
    const min = num(rule.minAmount);
    const max = num(rule.maxAmount);
    if (min !== null && request.amount < min) return `Montant inférieur au minimum (${min} ${rule.currency})`;
    if (max !== null && request.amount > max) return `Montant supérieur au maximum (${max} ${rule.currency})`;
    return null;
}

/** Valide et normalise une demande de routage ; lève une erreur lisible sinon. */
export function normalizeRequest(input) {
    // Pays inconnu : seules les règles « tous pays » s'appliquent (jamais de pays deviné).
    const rawCountry = String(input?.countryCode ?? "").trim().toUpperCase();
    const countryCode = rawCountry === "" ? null : rawCountry;
    const currency = String(input?.currency ?? "").trim().toUpperCase();
    const paymentMethod = String(input?.paymentMethod ?? "").trim();
    const amount = Number(input?.amount);
    if (countryCode !== null && !/^[A-Z]{2}$/.test(countryCode)) throw new Error("Pays invalide (code ISO à deux lettres attendu).");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Devise invalide (code ISO à trois lettres attendu).");
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error("Moyen de paiement invalide (card ou mobile_money).");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide.");
    return { countryCode, currency, paymentMethod, amount };
}

/**
 * Décide l'ordre des prestataires pour une demande.
 * @param {Array<object>} rules règles avec leur prestataire (`rule.provider`)
 * @param {{countryCode:string,currency:string,paymentMethod:string,amount:number}} request demande normalisée
 * @returns {{ candidates: Array<{rule: object, position: number, why: string}>, trace: Array<object> }}
 */
export function decide(rules, request, now = new Date()) {
    const usable = [];
    const trace = [];
    for (const rule of rules) {
        const reason = exclusionReason(rule, request, now);
        if (reason) trace.push({ ruleId: rule.id, provider: rule.provider?.name ?? "?", status: "excluded", reason });
        else usable.push(rule);
    }
    const rank = (r) => [r.countryCode === "*" ? 1 : 0, (r.paymentMethod ?? "any") === "any" ? 1 : 0, Number(r.priority ?? 0), Number(r.id ?? 0)];
    usable.sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
        return 0;
    });
    const seen = new Set();
    const candidates = [];
    for (const rule of usable) {
        const pid = rule.provider.id;
        if (seen.has(pid)) {
            trace.push({ ruleId: rule.id, provider: rule.provider.name, status: "shadowed", reason: "Une règle plus précise ou prioritaire du même prestataire est déjà retenue" });
            continue;
        }
        seen.add(pid);
        const why = [
            rule.countryCode === "*" ? "tous pays" : `pays ${rule.countryCode}`,
            (rule.paymentMethod ?? "any") === "any" ? "tous moyens" : METHOD_LABELS[rule.paymentMethod],
            `priorité ${rule.priority ?? 0}`,
        ].join(" · ");
        candidates.push({ rule, position: candidates.length + 1, why });
        trace.push({ ruleId: rule.id, provider: rule.provider.name, status: candidates.length === 1 ? "selected" : "fallback", reason: why });
    }
    return { candidates, trace };
}

/** Valide une règle saisie dans l'administration ; renvoie les champs normalisés ou lève une erreur lisible. */
export function normalizeRule(input, { partial = false } = {}) {
    const out = {};
    const has = (k) => input[k] !== undefined;
    if (!partial || has("countryCode")) {
        const c = String(input.countryCode ?? "").trim().toUpperCase();
        if (c !== "*" && !/^[A-Z]{2}$/.test(c)) throw new Error("Pays invalide : code ISO à deux lettres, ou « * » pour tous les pays.");
        out.countryCode = c;
    }
    if (!partial || has("currency")) {
        const c = String(input.currency ?? "").trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(c)) throw new Error("Devise invalide : code ISO à trois lettres.");
        out.currency = c;
    }
    if (!partial || has("paymentMethod")) {
        const m = String(input.paymentMethod ?? "any");
        if (!RULE_METHODS.includes(m)) throw new Error("Moyen invalide : any, card ou mobile_money.");
        out.paymentMethod = m;
    }
    if (!partial || has("minAmount")) {
        const v = num(input.minAmount) ?? 0;
        if (!Number.isFinite(v) || v < 0) throw new Error("Montant minimum invalide.");
        out.minAmount = v;
    }
    if (!partial || has("maxAmount")) {
        const v = num(input.maxAmount);
        if (v !== null && (!Number.isFinite(v) || v <= 0)) throw new Error("Montant maximum invalide.");
        out.maxAmount = v;
    }
    const min = out.minAmount ?? null;
    const max = out.maxAmount ?? null;
    if (min !== null && max !== null && max < min) throw new Error("Le montant maximum doit être supérieur au minimum.");
    if (!partial || has("priority")) {
        const p = Number(input.priority ?? 10);
        if (!Number.isInteger(p) || p < 0 || p > 1000) throw new Error("Priorité invalide (entier de 0 à 1000).");
        out.priority = p;
    }
    if (has("isActive")) out.isActive = !!input.isActive;
    return out;
}
