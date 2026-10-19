import { aggregateFailures, aggregateRevenue, methodOf, productOf, resolvePeriod } from "../../services/finance/finance-analytics.js";
import { convert } from "../../services/finance/fx-client.js";

/** Analyse financière (ADR-0019, D4-D5) : exacte par devise, convertie avec la grille, échecs expliqués. */
const grid = { pivot: "XOF", rates: { XOF: 1, XAF: 1, EUR: 0.001524 } };
const cinetpay = { id: 1, code: "cinetpay", name: "CinetPay", supportCard: true, supportMobileMoney: true, metadata: { fees: { mobile_money: { percent: 3.5, fixed: 0 } } } };
const stripe = { id: 2, code: "stripe", name: "Stripe", supportCard: true, supportMobileMoney: false, metadata: { fees: { card: { percent: 2.9, fixed: 0.25, currency: "EUR" } } } };
const providers = new Map([[1, cinetpay], [2, stripe]]);
const t0 = "2026-10-01T10:00:00Z";
const row = (o) => ({ status: "succeeded", amount: 60000, currency: "XOF", createdAt: t0, updatedAt: "2026-10-01T10:02:00Z", intentMeta: {}, orderMeta: {}, country: null, lmsItemType: "course", providerId: 1, attempts: 1, ...o });

describe("analyse des revenus", () => {
    it("convertit avec la grille (pivot XOF)", () => {
        expect(convert(1000, "XOF", "XOF", grid)).toBe(1000);
        expect(Math.round(convert(100, "EUR", "XOF", grid))).toBe(65617);
        expect(convert(10, "USD", "XOF", grid)).toBeNull();
    });

    it("brut, frais, net par devise ; équivalent de référence ; provenance", () => {
        const r = aggregateRevenue([
            row({ intentMeta: { payment_method: "mobile_money", country_code: "SN", channel: "trainer_link", coupon_discount: "15000", coupon_funder: "author" } }),
            row({ amount: 100, currency: "EUR", providerId: 2, intentMeta: { country_code: "FR" }, lmsItemType: "package", orderMeta: { is_b2b: true } }),
            row({ status: "failed" }),
        ], { providers, grid, ref: "XOF" });
        expect(r.totals.count).toBe(2);
        const xof = r.totals.byCurrency.find((c) => c.currency === "XOF");
        expect(xof).toMatchObject({ gross: 60000, fees: 2100, net: 57900, count: 1 });
        const eur = r.totals.byCurrency.find((c) => c.currency === "EUR");
        expect(eur).toMatchObject({ gross: 100, fees: 3.15, net: 96.85 });
        expect(Math.round(r.totals.reference.gross)).toBe(60000 + 65617);
        expect(r.breakdown.country.map((c) => c.key)).toEqual(["FR", "SN"]);
        expect(r.breakdown.method.map((m) => m.key).sort()).toEqual(["card", "mobile_money"]);
        expect(r.breakdown.product.find((p) => p.key === "b2b").count).toBe(1);
        expect(r.breakdown.channel.find((c) => c.key === "trainer_link").count).toBe(1);
        expect(r.discounts).toMatchObject({ total: 15000, count: 1, byFunder: { author: 15000 } });
    });

    it("produit et moyen déduits", () => {
        expect(productOf({ purchase_type: "ADMISSION_FEE" }, {}, "course")).toBe("admission");
        expect(productOf({ source: "AUCTION" }, {}, "course")).toBe("auction");
        expect(methodOf({}, stripe)).toBe("card");
        expect(methodOf({}, cinetpay)).toBe("unknown");
    });

    it("période : bornes, précédente, refus des périodes invalides", () => {
        const p = resolvePeriod({ range: "7d" }, new Date("2026-10-10T00:00:00Z"));
        expect(p.start.toISOString()).toBe("2026-10-03T00:00:00.000Z");
        expect(p.previous.start.toISOString()).toBe("2026-09-26T00:00:00.000Z");
        expect(() => resolvePeriod({ from: "2026-10-10", to: "2026-10-01" })).toThrow(/Période invalide/);
    });
});

describe("entonnoir et échecs", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    it("réussis, échoués classés, abandons, en cours ; bascules récupérées", () => {
        const r = aggregateFailures([
            row({}),
            row({ attempts: 2 }),
            row({ status: "failed", providerId: null, lastFailure: { providerId: 1, errorCode: "602", errorMessage: "INSUFFICIENT_BALANCE" } }),
            row({ status: "created", attempts: 0, providerId: null }),
            row({ status: "created", attempts: 1, providerId: null, createdAt: "2026-10-01T11:50:00Z" }),
        ], { providers, grid, now });
        expect(r.funnel).toEqual({ created: 5, attempted: 4, succeeded: 2, failed: 1, abandoned: 1, pending: 1 });
        expect(r.failover).toEqual({ intentsWithSeveralAttempts: 1, recoveredByFailover: 1 });
        expect(r.categories.map((c) => c.category).sort()).toEqual(["abandoned", "insufficient_funds"]);
        const funds = r.categories.find((c) => c.category === "insufficient_funds");
        expect(funds.providers).toEqual({ CinetPay: 1 });
        expect(funds.explanation).toMatch(/montant/);
        expect(r.medianTimeToPaySeconds).toBe(120);
        expect(r.rates.success).toBeCloseTo(0.5);
    });
});
