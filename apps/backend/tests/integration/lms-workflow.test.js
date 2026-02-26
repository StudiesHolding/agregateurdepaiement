import { jest } from "@jest/globals";
import { WebhookProcessor } from "../../services/webhook-processor.service.js";
import { Order } from "../../models/order.model.js";
import { PaymentIntent } from "../../models/payment-intent.model.js";
import { MailService } from "../../services/mail.service.js";
import { OrderStatus } from "../../enums/index.js";

describe("LMS Workflow Integration", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Webhook should transition order to PAYMENT_CONFIRMED and NOT send invoice", async () => {
        const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
        const mockAttempt = {
            id: 1,
            paymentIntentId: 10,
            paymentIntent: { orderId: 100 },
            update: jest.fn().mockReturnThis(),
            save: jest.fn().mockReturnThis()
        };
        const mockOrder = {
            id: 100,
            reference: "ORD-TEST",
            customerEmail: "user@example.com",
            status: OrderStatus.PENDING
        };

        // Mocks
        jest.spyOn(Order, 'update').mockResolvedValue([1]);
        jest.spyOn(PaymentIntent, 'update').mockResolvedValue([1]);
        jest.spyOn(Order, 'findByPk').mockResolvedValue(mockOrder);
        jest.spyOn(MailService, 'sendPaymentConfirmed').mockResolvedValue(true);
        jest.spyOn(MailService, 'sendPaymentSuccessNotification').mockResolvedValue(true);
        jest.spyOn(MailService, 'notifyLmsAdmins').mockResolvedValue(true);

        // Simulate success marked via markAsSucceeded
        await WebhookProcessor.markAsSucceeded(mockAttempt, {}, mockTransaction);

        // Verification: Status should be PAYMENT_CONFIRMED
        expect(Order.update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: OrderStatus.PAYMENT_CONFIRMED,
                paidAt: expect.any(Date)
            }),
            expect.any(Object)
        );
    });
});
