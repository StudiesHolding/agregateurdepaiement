import { OrchestratorService } from "../../services/orchestrator.service.js";
import { FormationsService } from "../../services/formations.service.js";
import { OrderService } from "../../services/order.service.js";
import { PaymentIntentService } from "../../services/payment-intent.service.js";
import { ProviderSelectorService } from "../../services/provider-selector.service.js";
import { jest } from "@jest/globals";

describe("OrchestratorService Auction Pricing", () => {
  const auctionData = {
    customerEmail: "bidder@example.com",
    amount: 75000, // Bid amount
    currency: "XAF",
    paymentMethod: "card",
    countryCode: "CM",
    successUrl: "http://success.com",
    cancelUrl: "http://cancel.com",
    metadata: {
      source: "AUCTION",
      auction_id: "123",
      formation_id: "456"
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock dependencies
    jest.spyOn(FormationsService, 'getFormation').mockResolvedValue({
      id: "456",
      name: "Formation Test",
      price: 100000, // Original price is higher than bid
      currency: "XAF"
    });
    
    jest.spyOn(OrderService, 'create').mockResolvedValue({
      id: 1,
      reference: "ORD-AUCTION-123"
    });
    
    jest.spyOn(PaymentIntentService, 'create').mockResolvedValue({
      id: 10,
      amount: 75000
    });

    // Mock ProviderSelector to avoid actual payment flow
    const mockSelector = {
      initialize: jest.fn().mockResolvedValue([{ code: "stripe", name: "Stripe" }]),
      executeWithFallback: jest.fn().mockResolvedValue({
        success: true,
        attempt: { transactionNumber: "TX-123" },
        provider: { name: "Stripe" },
        providerResponse: { redirectUrl: "http://stripe.com/pay" }
      })
    };
    jest.spyOn(ProviderSelectorService.prototype, 'initialize').mockImplementation(mockSelector.initialize);
    // Note: ProviderSelectorService is a class, we need to handle its instance methods
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("should accept dynamic bid amount for auctions", async () => {
    // We need to mock the full flow but focus on the amount validation logic
    // OrchestratorService.initializePayment(auctionData)
    
    // Let's use a simpler approach: check if OrchestratorService passes the correct amount to OrderService.create
    await OrchestratorService.initializePayment(auctionData);

    expect(OrderService.create).toHaveBeenCalledWith(expect.objectContaining({
      totalAmount: 75000 // The bid amount, not the 100,000 formation price
    }));
  });
});
