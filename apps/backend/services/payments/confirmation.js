import crypto from "node:crypto";

/**
 * Confirmation d'un paiement (ADR-0004, ADR-0019 D5) — fonctions pures
 * ====================================================================
 * Un webhook n'est qu'un SIGNAL : son contenu ne prouve rien (n'importe qui peut écrire à l'URL publique).
 * La preuve vient de la réponse du prestataire interrogé par nous (session Stripe, vérification KkiaPay, CinetPay),
 * qui doit en plus correspondre À CETTE tentative : même référence, même montant, même devise.
 */

const ZERO_DECIMAL = new Set(["XOF", "XAF", "GNF", "RWF", "UGX", "KMF", "JPY", "KRW", "VND", "BIF", "DJF", "MGA", "PYG", "VUV", "XPF", "CLP"]);

/** Montant Stripe (unités mineures) → montant de la devise. */
export function fromStripeAmount(amount, currency) {
    const c = String(currency ?? "").toUpperCase();
    return ZERO_DECIMAL.has(c) ? Number(amount) : Number(amount) / 100;
}

const close = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;

/**
 * Vérifie que la réponse du prestataire confirme bien CETTE tentative.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function bindConfirmation(providerCode, response, { transactionNumber, amount, currency }) {
    const expectedCurrency = String(currency ?? "").toUpperCase();
    if (!response) return { ok: false, reason: "Réponse du prestataire vide" };

    if (providerCode === "stripe") {
        const ref = response.client_reference_id ?? response.metadata?.transactionNumber ?? null;
        if (ref !== transactionNumber && response.id !== transactionNumber) return { ok: false, reason: "La session Stripe ne correspond pas à cette tentative" };
        if (response.currency && String(response.currency).toUpperCase() !== expectedCurrency) return { ok: false, reason: `Devise confirmée ${String(response.currency).toUpperCase()}, attendue ${expectedCurrency}` };
        if (response.amount_total != null && !close(fromStripeAmount(response.amount_total, response.currency ?? expectedCurrency), amount)) {
            return { ok: false, reason: `Montant confirmé ${fromStripeAmount(response.amount_total, response.currency ?? expectedCurrency)}, attendu ${amount}` };
        }
        return { ok: true };
    }

    if (providerCode === "kkiapay") {
        const partner = response.partnerId ?? response.partner_id ?? null;
        if (partner && partner !== transactionNumber) return { ok: false, reason: "La transaction KkiaPay ne correspond pas à cette tentative" };
        if (response.amount == null) return { ok: false, reason: "Montant absent de la confirmation KkiaPay" };
        if (!close(response.amount, amount)) return { ok: false, reason: `Montant confirmé ${response.amount}, attendu ${amount}` };
        return { ok: true };
    }

    if (providerCode === "cinetpay") {
        const data = response.data ?? {};
        if (data.currency && String(data.currency).toUpperCase() !== expectedCurrency) return { ok: false, reason: `Devise confirmée ${String(data.currency).toUpperCase()}, attendue ${expectedCurrency}` };
        if (data.amount != null && !close(data.amount, amount)) return { ok: false, reason: `Montant confirmé ${data.amount}, attendu ${amount}` };
        return { ok: true };
    }

    return { ok: false, reason: `Prestataire ${providerCode} sans vérification serveur` };
}

/**
 * Signature KkiaPay (défense en profondeur) : obligatoire dès que KKIAPAY_WEBHOOK_SECRET est configuré.
 * Comparaison en temps constant ; rien n'est écrit dans les journaux.
 * @returns {{ checked: boolean, valid: boolean }}
 */
const same = (x, y) => {
    const a = Buffer.from(String(x));
    const b = Buffer.from(String(y));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export function checkKkiapaySignature(signature, secret, payload) {
    if (!secret) return { checked: false, valid: true };
    if (typeof signature !== "string" || !signature) return { checked: true, valid: false };
    // En-tête « x-kkiapay-secret » : le secret configuré lui-même, ou son HMAC du corps selon l'intégration.
    const hmac = crypto.createHmac("sha256", secret).update(JSON.stringify(payload ?? {})).digest("hex");
    return { checked: true, valid: same(signature, secret) || same(signature, hmac) };
}

/** Identifiant à interroger chez le prestataire pour vérifier un webhook. */
export function verificationId(providerCode, payload, attempt) {
    if (providerCode === "stripe") return payload?.data?.object?.id ?? attempt?.transactionNumber ?? null;
    if (providerCode === "kkiapay") return payload?.transactionId ?? payload?.transaction_id ?? null;
    return attempt?.transactionNumber ?? null;
}
