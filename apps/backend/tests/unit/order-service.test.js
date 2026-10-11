import { OrderService } from "../../services/order.service.js";
import { Order } from "../../models/order.model.js";
import { jest } from "@jest/globals";

describe("OrderService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should create an order successfully", async () => {
        const mockOrderData = {
            customerEmail: "test@example.com",
            customerName: "Test User",
            currency: "XAF",
            totalAmount: 1000,
            metadata: { key: "value" }
        };

        jest.spyOn(Order, 'create').mockResolvedValue({ id: 1, ...mockOrderData, reference: "ORD-123" });

        const order = await OrderService.create(mockOrderData);

        expect(Order.create).toHaveBeenCalledWith(expect.objectContaining({
            customerEmail: mockOrderData.customerEmail,
            totalAmount: mockOrderData.totalAmount,
            reference: expect.stringMatching(/^INS-/)
        }));
        expect(order.id).toBe(1);
    });

    test("should generate unique references", () => {
        const ref1 = OrderService.generateReference();
        const ref2 = OrderService.generateReference();

        expect(ref1).not.toBe(ref2);
        expect(ref1).toMatch(/^INS-/);
    });

    test("références lisibles : INS- pour une inscription, LIC- pour un achat de licences", () => {
        expect(OrderService.generateReference("course")).toMatch(/^INS-/);
        expect(OrderService.generateReference("package")).toMatch(/^LIC-/);
        expect(OrderService.generateReference("thematique")).toMatch(/^LIC-/);
    });
});
