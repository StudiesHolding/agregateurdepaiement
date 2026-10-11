import { QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { parseJson } from "../../utils/json-column.js";

/**
 * Rapprochement (ADR-0019, D6) — paiements ↔ inscriptions ↔ accès livrés ↔ notifications
 * ===================================================================================
 * Chaque écart est un problème concret pour un client ou pour la caisse. Fonction pure + lecture des données.
 */

export const RULES = Object.freeze({
    paid_order_not_confirmed: {
        label: "Paiement confirmé, achat non à jour", severity: "danger",
        explanation: "Le prestataire a confirmé le paiement mais l’achat n’est pas passé à « payé » : le client a payé sans être servi.",
        action: "Ouvrir l’achat et relancer son traitement ; vérifier son journal.",
    },
    access_not_delivered: {
        label: "Accès non livré après paiement", severity: "danger",
        explanation: "Paiement confirmé depuis plus de 30 minutes, mais aucune inscription ou livraison n’est enregistrée.",
        action: "Vérifier le provisionnement de l’achat (inscription au campus, licences) et relancer l’étape en échec.",
    },
    order_paid_without_payment: {
        label: "Achat « payé » sans paiement confirmé", severity: "danger",
        explanation: "L’inscription ou l’achat de licences est marqué payé alors qu’aucun paiement confirmé ne lui correspond.",
        action: "Contrôler l’origine du changement d’état (journal) ; si aucune preuve de paiement, suspendre l’accès.",
    },
    stuck_attempt: {
        label: "Tentative bloquée", severity: "warning",
        explanation: "Une tentative est restée « en cours » plus de 2 heures : le prestataire n’a jamais notifié l’issue.",
        action: "Vérifier le statut de la transaction chez le prestataire puis rejouer la notification si elle existe.",
    },
    webhook_unprocessed: {
        label: "Notification non traitée", severity: "warning",
        explanation: "Une notification de prestataire attend depuis plus de 10 minutes (vérification impossible, référence inconnue…).",
        action: "Ouvrir les webhooks, lire le motif et rejouer une fois la cause corrigée.",
    },
    webhook_bad_signature: {
        label: "Notification à signature invalide", severity: "danger",
        explanation: "Une notification a été rejetée car sa signature ne correspond pas : tentative de falsification ou secret mal configuré.",
        action: "Vérifier le secret des webhooks du prestataire ; si la configuration est bonne, traiter comme un incident de sécurité.",
    },
});

const DELIVERED_STATUSES = new Set(["completed", "validated"]);
const PAID_STATUSES = new Set(["payment_confirmed", "validated", "completed"]);

export function isDelivered(order) {
    if (DELIVERED_STATUSES.has(order.status)) return true;
    const m = order.meta ?? {};
    return !!(m.moodle_enrollment_id || m.enrolled_at || m.keycloak_activated_at || m.provisioned_at || m.licenses_assigned_at);
}

/**
 * @param {{ intents: Array, orders: Array, attempts: Array, webhooks: Array, now?: Date }} data
 * @returns {Array<{ rule: string, label: string, severity: string, explanation: string, action: string, items: Array }>}
 */
export function reconcile({ intents = [], orders = [], attempts = [], webhooks = [], now = new Date() }) {
    const issues = Object.fromEntries(Object.keys(RULES).map((k) => [k, []]));
    const age = (d) => (now.getTime() - new Date(d).getTime()) / 60000;
    const succeededByOrder = new Map();
    for (const i of intents) if (i.status === "succeeded") succeededByOrder.set(Number(i.orderId), i);

    for (const o of orders) {
        const paid = succeededByOrder.get(Number(o.id));
        const ref = { reference: o.reference, orderId: o.id, amount: Number(o.totalAmount), currency: o.currency, at: o.paidAt ?? o.updatedAt ?? o.createdAt, status: o.status };
        if (paid && !PAID_STATUSES.has(o.status)) issues.paid_order_not_confirmed.push({ ...ref, at: paid.updatedAt });
        if (paid && PAID_STATUSES.has(o.status) && !isDelivered(o) && age(paid.updatedAt) > 30) issues.access_not_delivered.push({ ...ref, at: paid.updatedAt });
        if (!paid && PAID_STATUSES.has(o.status)) issues.order_paid_without_payment.push(ref);
    }
    for (const a of attempts) {
        if ((a.status === "processing" || a.status === "pending") && age(a.createdAt) > 120) {
            issues.stuck_attempt.push({ reference: a.reference ?? a.transactionNumber, transactionNumber: a.transactionNumber, provider: a.provider ?? null, at: a.createdAt, status: a.status });
        }
    }
    for (const w of webhooks) {
        if (w.signatureValid === false || w.signatureValid === 0) issues.webhook_bad_signature.push({ webhookId: w.id, provider: w.provider ?? null, at: w.createdAt, reason: w.errorMessage ?? null });
        else if (!w.processed && age(w.createdAt) > 10) issues.webhook_unprocessed.push({ webhookId: w.id, provider: w.provider ?? null, at: w.createdAt, reason: w.errorMessage ?? null });
    }
    return Object.entries(issues)
        .map(([rule, items]) => ({ rule, ...RULES[rule], count: items.length, items: items.slice(0, 50) }))
        .filter((g) => g.count > 0)
        .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "danger" ? -1 : 1));
}

export async function reconciliationReport({ days = 30, now = new Date() } = {}) {
    const since = new Date(now.getTime() - Math.min(Math.max(Number(days) || 30, 1), 180) * 86_400_000);
    const [intents, orders, attempts, webhooks] = await Promise.all([
        sequelize.query("SELECT id, order_id AS orderId, status, updated_at AS updatedAt FROM aggp_payment_intents WHERE created_at >= :since", { replacements: { since }, type: QueryTypes.SELECT }),
        sequelize.query("SELECT id, reference, status, total_amount AS totalAmount, currency, paid_at AS paidAt, created_at AS createdAt, updated_at AS updatedAt, metadata FROM aggp_orders WHERE created_at >= :since", { replacements: { since }, type: QueryTypes.SELECT }),
        sequelize.query("SELECT a.transactionNumber, a.status, a.createdAt, p.name AS provider, o.reference FROM aggp_payment_attempts a LEFT JOIN aggp_payment_providers p ON p.id = a.providerId LEFT JOIN aggp_payment_intents i ON i.id = a.paymentIntentId LEFT JOIN aggp_orders o ON o.id = i.order_id WHERE a.createdAt >= :since AND a.status IN ('pending','processing')", { replacements: { since }, type: QueryTypes.SELECT }),
        sequelize.query("SELECT w.id, w.processed, w.signatureValid, w.errorMessage, w.createdAt, p.name AS provider FROM aggp_webhook_events w LEFT JOIN aggp_payment_providers p ON p.id = w.provider_id WHERE w.createdAt >= :since AND (w.processed = 0 OR w.signatureValid = 0)", { replacements: { since }, type: QueryTypes.SELECT }),
    ]);
    const groups = reconcile({ intents, orders: orders.map((o) => ({ ...o, meta: parseJson(o.metadata) ?? {} })), attempts, webhooks, now });
    return { since, days: Number(days) || 30, groups, total: groups.reduce((n, g) => n + g.count, 0) };
}
