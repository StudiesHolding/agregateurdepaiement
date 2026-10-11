import { isDelivered, reconcile } from "../../services/finance/reconciliation.js";

/** Rapprochement (ADR-0019, D6) : chaque écart entre paiement, inscription, accès et notification est signalé. */
describe("rapprochement", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const o = (over) => ({ id: 1, reference: "ORD-1", status: "pending", totalAmount: "60000", currency: "XOF", createdAt: "2026-10-10T10:00:00Z", meta: {}, ...over });

    it("paiement confirmé mais inscription en attente", () => {
        const g = reconcile({ intents: [{ orderId: 1, status: "succeeded", updatedAt: "2026-10-10T11:00:00Z" }], orders: [o({})], now });
        expect(g.map((x) => x.rule)).toEqual(["paid_order_not_confirmed"]);
    });

    it("accès non livré après 30 min ; livré si inscription enregistrée", () => {
        const intents = [{ orderId: 1, status: "succeeded", updatedAt: "2026-10-10T11:00:00Z" }];
        expect(reconcile({ intents, orders: [o({ status: "payment_confirmed" })], now }).map((x) => x.rule)).toEqual(["access_not_delivered"]);
        expect(reconcile({ intents, orders: [o({ status: "payment_confirmed", meta: { moodle_enrollment_id: 9 } })], now })).toEqual([]);
        expect(isDelivered({ status: "completed", meta: {} })).toBe(true);
    });

    it("inscription payée sans paiement, tentative bloquée, webhooks", () => {
        const g = reconcile({
            orders: [o({ status: "completed" })],
            attempts: [{ transactionNumber: "T1", status: "processing", createdAt: "2026-10-10T08:00:00Z" }],
            webhooks: [{ id: 1, processed: 0, signatureValid: 1, createdAt: "2026-10-10T11:00:00Z" }, { id: 2, processed: 0, signatureValid: 0, createdAt: "2026-10-10T11:59:00Z" }],
            now,
        });
        expect(g.map((x) => x.rule)).toEqual(["order_paid_without_payment", "webhook_bad_signature", "stuck_attempt", "webhook_unprocessed"]);
        expect(g[0].action.length).toBeGreaterThan(10);
    });
});
