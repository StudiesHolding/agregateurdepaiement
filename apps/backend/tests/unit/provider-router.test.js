import { ProviderRouterService } from "../../services/provider-router.service.js";
import { ProviderRoute } from "../../models/provider-route.model.js";
import { jest } from "@jest/globals";

/** Le service lit les règles en base et délègue la décision au moteur (ADR-0019, D2). */
describe("ProviderRouterService", () => {
    afterEach(() => jest.restoreAllMocks());

    const provider = (id, code, card, mm) => ({ id, code, name: code, isActive: true, supportCard: card, supportMobileMoney: mm, metadata: {} });
    const rules = [
        { id: 1, provider: provider(1, "stripe", true, false), countryCode: "*", currency: "XOF", paymentMethod: "card", minAmount: 0, maxAmount: null, priority: 10, isActive: true },
        { id: 2, provider: provider(2, "cinetpay", true, true), countryCode: "SN", currency: "XOF", paymentMethod: "mobile_money", minAmount: 0, maxAmount: null, priority: 10, isActive: true },
    ];

    test("carte et Mobile Money suivent uniquement les règles configurées", async () => {
        jest.spyOn(ProviderRoute, "findAll").mockResolvedValue(rules);
        expect((await ProviderRouterService.findAvailableRoutes("SN", "XOF", 5000, "card")).map((r) => r.id)).toEqual([1]);
        expect((await ProviderRouterService.findAvailableRoutes("SN", "XOF", 5000, "mobile_money")).map((r) => r.id)).toEqual([2]);
        expect(await ProviderRouterService.findAvailableRoutes("CM", "XAF", 5000, "mobile_money")).toEqual([]);
    });

    test("explain rend la trace de décision", async () => {
        jest.spyOn(ProviderRoute, "findAll").mockResolvedValue(rules);
        const r = await ProviderRouterService.explain({ countryCode: "SN", currency: "XOF", amount: 5000, paymentMethod: "mobile_money" });
        expect(r.trace.map((t) => t.status)).toEqual(["excluded", "selected"]);
    });

    test("filterByPaymentMethod reste disponible", () => {
        const routes = [{ provider: { supportCard: true, supportMobileMoney: false } }, { provider: { supportCard: false, supportMobileMoney: true } }];
        expect(ProviderRouterService.filterByPaymentMethod(routes, "card")).toHaveLength(1);
        expect(ProviderRouterService.filterByPaymentMethod(routes, "mobile_money")).toHaveLength(1);
    });
});
