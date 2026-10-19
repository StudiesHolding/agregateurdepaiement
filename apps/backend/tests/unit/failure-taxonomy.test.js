import { CATEGORIES, classify } from "../../services/finance/failure-taxonomy.js";

/** Taxonomie des échecs (ADR-0019, D5) : chaque échec a une catégorie, une explication, une action. */
describe("taxonomie des échecs", () => {
    it("codes connus des prestataires", () => {
        expect(classify({ errorCode: "602" }).category).toBe("insufficient_funds");
        expect(classify({ errorCode: "INSUFFICIENT_BALANCE" }).category).toBe("insufficient_funds");
        expect(classify({ errorCode: "627" }).category).toBe("customer_cancelled");
        expect(classify({ errorCode: "card_declined" }).category).toBe("declined");
        expect(classify({ errorCode: "608" }).category).toBe("configuration");
    });
    it("messages libres : le plus spécifique d'abord", () => {
        expect(classify({ errorCode: "CINETPAY_NETWORK_ERROR", errorMessage: "fetch failed" }).category).toBe("provider_unavailable");
        expect(classify({ errorMessage: "Solde insuffisant sur le compte" }).category).toBe("insufficient_funds");
        expect(classify({ errorMessage: "Invalid API key provided" }).category).toBe("configuration");
        expect(classify({ errorMessage: "Transaction declined by issuer" }).category).toBe("declined");
        expect(classify({ errorMessage: "OTP expired" }).category).toBe("validation_failed");
    });
    it("abandon, annulation, inconnu", () => {
        expect(classify({ abandoned: true }).category).toBe("abandoned");
        expect(classify({ status: "canceled" }).category).toBe("customer_cancelled");
        const u = classify({ errorMessage: "xyz" });
        expect(u.category).toBe("unknown");
        expect(u.explanation.length).toBeGreaterThan(10);
    });
    it("chaque catégorie porte libellé, explication, action", () => {
        for (const c of Object.values(CATEGORIES)) { expect(c.label).toBeTruthy(); expect(c.explanation.length).toBeGreaterThan(20); expect(c.action.length).toBeGreaterThan(20); }
    });
});

describe("customerReason", () => {
    it("explique à l'acheteur sans jargon ni détail technique", async () => {
        const { customerReason } = await import("../../services/finance/failure-taxonomy.js");
        expect(customerReason({ errorCode: "602" })).toMatchObject({ category: "insufficient_funds", title: "Solde insuffisant" });
        const net = customerReason({ errorMessage: "fetch failed" });
        expect(net.category).toBe("provider_unavailable");
        expect(net.advice).not.toMatch(/fetch|ENOTFOUND/i);
        expect(customerReason({}).title).toBe("Le paiement n’a pas abouti");
    });
});
