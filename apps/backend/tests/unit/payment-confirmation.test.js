import { jest } from "@jest/globals";
import { bindConfirmation, checkKkiapaySignature, fromStripeAmount, verificationId } from "../../services/payments/confirmation.js";
import { WebhookProcessor } from "../../services/webhook-processor.service.js";
import { ProviderFactory } from "../../providers/index.js";
import { WebhookEvent, PaymentAttempt, AdminNotification, NotificationRule, NotificationDelivery, sequelize } from "../../models/index.js";
import { MailService } from "../../services/mail.service.js";
import { AttemptStatus } from "../../enums/index.js";

/** Confirmation des paiements (ADR-0019, D5) : un webhook ne prouve rien, le prestataire interrogé fait foi. */
describe("liaison de la confirmation à la tentative", () => {
    const expected = { transactionNumber: "TXN-1", amount: 60000, currency: "XOF" };

    it("Stripe : référence, devise et montant (unités mineures) doivent correspondre", () => {
        expect(fromStripeAmount(60000, "xof")).toBe(60000);
        expect(fromStripeAmount(1250, "eur")).toBe(12.5);
        expect(bindConfirmation("stripe", { id: "cs_1", client_reference_id: "TXN-1", currency: "xof", amount_total: 60000 }, expected)).toEqual({ ok: true });
        expect(bindConfirmation("stripe", { id: "cs_2", client_reference_id: "TXN-AUTRE", currency: "xof", amount_total: 60000 }, expected).ok).toBe(false);
        expect(bindConfirmation("stripe", { id: "cs_1", client_reference_id: "TXN-1", currency: "xof", amount_total: 100 }, expected).reason).toMatch(/Montant confirmé 100, attendu 60000/);
        expect(bindConfirmation("stripe", { id: "cs_1", client_reference_id: "TXN-1", currency: "eur", amount_total: 6000000 }, expected).reason).toMatch(/Devise confirmée EUR/);
    });

    it("KkiaPay : montant obligatoire et identique, référence partenaire si fournie", () => {
        expect(bindConfirmation("kkiapay", { amount: 60000, partnerId: "TXN-1" }, expected)).toEqual({ ok: true });
        expect(bindConfirmation("kkiapay", { amount: 500 }, expected).ok).toBe(false);
        expect(bindConfirmation("kkiapay", { partnerId: "TXN-1" }, expected).reason).toMatch(/Montant absent/);
        expect(bindConfirmation("kkiapay", { amount: 60000, partnerId: "TXN-9" }, expected).ok).toBe(false);
    });

    it("CinetPay : montant et devise de la réponse de vérification", () => {
        expect(bindConfirmation("cinetpay", { data: { amount: "60000", currency: "XOF", status: "ACCEPTED" } }, expected)).toEqual({ ok: true });
        expect(bindConfirmation("cinetpay", { data: { amount: "100", currency: "XOF" } }, expected).ok).toBe(false);
    });

    it("signature KkiaPay : facultative sans secret, obligatoire et exacte avec", () => {
        expect(checkKkiapaySignature(undefined, undefined, {})).toEqual({ checked: false, valid: true });
        expect(checkKkiapaySignature(undefined, "s3cret", {})).toEqual({ checked: true, valid: false });
        expect(checkKkiapaySignature("s3cret", "s3cret", {}).valid).toBe(true);
        expect(checkKkiapaySignature("faux", "s3cret", {}).valid).toBe(false);
    });

    it("identifiant à vérifier chez le prestataire", () => {
        expect(verificationId("stripe", { data: { object: { id: "cs_9" } } }, { transactionNumber: "TXN-1" })).toBe("cs_9");
        expect(verificationId("kkiapay", { transactionId: "kk_1" }, {})).toBe("kk_1");
        expect(verificationId("cinetpay", {}, { transactionNumber: "TXN-1" })).toBe("TXN-1");
    });
});

describe("traitement d'un webhook", () => {
    let event;
    let attempt;
    const tx = { commit: jest.fn(), rollback: jest.fn() };

    beforeEach(() => {
        event = { id: 1, signatureValid: true, processed: false, save: jest.fn() };
        attempt = {
            id: 7, providerId: 2, transactionNumber: "TXN-1", status: AttemptStatus.PROCESSING, paymentIntentId: 3,
            paymentIntent: { id: 3, amount: "60000.00", currency: "XOF", orderId: 11, order: { id: 11, reference: "ORD-1", metadata: {} } },
        };
        jest.spyOn(sequelize, "transaction").mockResolvedValue(tx);
        jest.spyOn(WebhookEvent, "create").mockResolvedValue(event);
        jest.spyOn(PaymentAttempt, "findOne").mockResolvedValue(attempt);
        jest.spyOn(AdminNotification, "create").mockResolvedValue({});
        // Alertes de l'équipe : une règle active par événement, centre de notifications seulement.
        jest.spyOn(NotificationRule, "findAll").mockImplementation(async ({ where }) => [{ id: 1, event: where.event, severity: "danger", channels: { inApp: true, email: false, sound: false }, recipients: { emails: [] }, quietHours: null, timezone: "Africa/Douala", cooldownMinutes: 0, params: {} }]);
        jest.spyOn(NotificationDelivery, "create").mockResolvedValue({});
        jest.spyOn(NotificationDelivery, "count").mockResolvedValue(0);
        jest.spyOn(MailService, "sendPaymentFailureNotification").mockResolvedValue();
        jest.spyOn(WebhookProcessor, "markAsSucceeded").mockResolvedValue();
        jest.spyOn(WebhookProcessor, "markAsFailed").mockResolvedValue();
        jest.spyOn(MailService, "sendPaymentConfirmed").mockResolvedValue();
    });
    afterEach(() => jest.restoreAllMocks());

    const stripePayload = { type: "checkout.session.completed", data: { object: { id: "cs_1", client_reference_id: "TXN-1" } } };

    it("webhook Stripe falsifié : le prestataire ne confirme pas, rien n'est validé", async () => {
        jest.spyOn(ProviderFactory, "getProvider").mockReturnValue({ checkStatus: async () => ({ success: false, error: "No such checkout.session" }) });
        await WebhookProcessor.processEvent("stripe", stripePayload, null);
        expect(WebhookProcessor.markAsSucceeded).not.toHaveBeenCalled();
        expect(event.processed).toBe(false);
        expect(event.errorMessage).toMatch(/Vérification impossible/);
    });

    it("session payée mais pour un autre montant : refus et alerte", async () => {
        jest.spyOn(ProviderFactory, "getProvider").mockReturnValue({ checkStatus: async () => ({ success: true, status: "succeeded", response: { id: "cs_1", client_reference_id: "TXN-1", currency: "xof", amount_total: 100 } }) });
        await WebhookProcessor.processEvent("stripe", stripePayload, null);
        expect(WebhookProcessor.markAsSucceeded).not.toHaveBeenCalled();
        expect(event.errorMessage).toMatch(/Confirmation refusée/);
        expect(AdminNotification.create).toHaveBeenCalledWith(expect.objectContaining({ type: "DANGER", title: "Confirmation de paiement suspecte" }));
    });

    it("confirmation serveur conforme : paiement validé", async () => {
        jest.spyOn(ProviderFactory, "getProvider").mockReturnValue({ checkStatus: async () => ({ success: true, status: "succeeded", response: { id: "cs_1", client_reference_id: "TXN-1", currency: "xof", amount_total: 60000 } }) });
        await WebhookProcessor.processEvent("stripe", stripePayload, null);
        expect(WebhookProcessor.markAsSucceeded).toHaveBeenCalled();
    });

    it("paiement déjà confirmé : notification ignorée (idempotence)", async () => {
        attempt.status = AttemptStatus.SUCCEEDED;
        const spy = jest.spyOn(ProviderFactory, "getProvider");
        const r = await WebhookProcessor.processEvent("stripe", stripePayload, null);
        expect(r.duplicate).toBe(true);
        expect(spy).not.toHaveBeenCalled();
        expect(WebhookProcessor.markAsSucceeded).not.toHaveBeenCalled();
    });

    it("KkiaPay avec secret configuré et sans signature : rejet", async () => {
        process.env.KKIAPAY_WEBHOOK_SECRET = "s3cret";
        const spy = jest.spyOn(ProviderFactory, "getProvider");
        await WebhookProcessor.processEvent("kkiapay", { partnerId: "TXN-1", transactionId: "kk_1", isPaymentSucces: true }, null);
        delete process.env.KKIAPAY_WEBHOOK_SECRET;
        expect(event.signatureValid).toBe(false);
        expect(spy).not.toHaveBeenCalled();
        expect(WebhookProcessor.markAsSucceeded).not.toHaveBeenCalled();
    });
});
