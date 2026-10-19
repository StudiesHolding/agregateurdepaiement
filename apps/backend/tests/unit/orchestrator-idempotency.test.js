import { jest } from "@jest/globals";
import { OrchestratorService } from "../../services/orchestrator.service.js";
import { PaymentIntentService } from "../../services/payment-intent.service.js";
import { OrderService } from "../../services/order.service.js";

/** Idempotence du checkout (ADR-0020, D4) : une même session ne crée jamais un second achat. */
describe("idempotence de la création de paiement", () => {
    afterEach(() => jest.restoreAllMocks());
    const base = { customerEmail: "a@sl.test", currency: "XOF", amount: 45000, paymentMethod: "mobile_money" };

    it("même clé : renvoie le lien déjà émis, sans créer d'achat", async () => {
        jest.spyOn(PaymentIntentService, "findByIdempotencyKey").mockResolvedValue({ metadata: JSON.stringify({ checkout_result: { success: true, orderReference: "INS-1", redirectUrl: "https://pay.test/x" } }) });
        const create = jest.spyOn(OrderService, "create");
        const r = await OrchestratorService.initializePayment({ ...base, idempotencyKey: "chk_0123456789abcdef" });
        expect(r).toMatchObject({ success: true, orderReference: "INS-1", redirectUrl: "https://pay.test/x", duplicate: true });
        expect(create).not.toHaveBeenCalled();
    });

    it("clé en cours de création : refus explicite, rien n'est créé ; clé mal formée refusée", async () => {
        jest.spyOn(PaymentIntentService, "findByIdempotencyKey").mockResolvedValue({ metadata: {} });
        const create = jest.spyOn(OrderService, "create");
        await expect(OrchestratorService.initializePayment({ ...base, idempotencyKey: "chk_0123456789abcdef" })).rejects.toThrow(/déjà en cours/);
        await expect(OrchestratorService.initializePayment({ ...base, idempotencyKey: "court" })).rejects.toThrow(/idempotence invalide/);
        expect(create).not.toHaveBeenCalled();
    });
});
