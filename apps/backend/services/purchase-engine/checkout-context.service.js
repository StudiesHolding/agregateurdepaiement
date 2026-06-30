import { PurchaseStrategy } from './purchase.strategy.js';
// import { logger } from '../../utils/logger.js';
import { B2bPackagePurchaseStrategy } from "./b2b-package.strategy.js";
// import { B2bThematiquePurchaseStrategy } from "./b2b-thematique.strategy.js";
import { AuctionPaymentStrategy } from "./auction-payment.strategy.js";
import { B2cCoursePurchaseStrategy } from "./b2c-course.strategy.js";

class CheckoutContextService {
  constructor() {
    this.strategies = new Map();
    
    // Enregistrement des stratégies disponibles
    this.registerStrategy(new B2bPackagePurchaseStrategy());
    // this.registerStrategy(new B2bThematiquePurchaseStrategy());
    this.registerStrategy(new AuctionPaymentStrategy());
    this.registerStrategy(new B2cCoursePurchaseStrategy());
  }

  /**
   * Registers a new purchase strategy.
   * @param {PurchaseStrategy} strategy 
   */
  registerStrategy(strategy) {
    if (!(strategy instanceof PurchaseStrategy)) {
        throw new Error('Strategy must be an instance of PurchaseStrategy');
    }
    const type = strategy.getType();
    this.strategies.set(type, strategy);
    console.log(`[Purchase Engine] Strategy registered for type: ${type}`);
  }

  /**
   * Gets the appropriate strategy for the given type.
   * @param {string} type 
   * @returns {PurchaseStrategy}
   */
  getStrategy(type) {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`Unsupported purchase type: ${type}`);
    }
    return strategy;
  }

  /**
   * Fetches context for the checkout UI.
   * @param {string} type 
   * @param {string|number} id 
   */
  async getContext(type, id) {
    const strategy = this.getStrategy(type);
    return strategy.getContext(id);
  }

  /**
   * Processes the checkout request.
   * @param {string} type 
   * @param {Object} data 
   * @param {Object} user 
   */
  async processCheckout(type, data, user) {
    const strategy = this.getStrategy(type);
    
    // 1. Validate eligibility
    await strategy.validateEligibility(user, data.itemId);

    // 2. Initiate payment with PSP
    const paymentPayload = await strategy.initiatePayment(data);
    
    // 3. Return payload to frontend (includes PSP token, saga routing info, etc.)
    return {
        ...paymentPayload,
        sagaType: strategy.getSagaRoutingType()
    };
  }
}

// Singleton instance
export const checkoutContextService = new CheckoutContextService();
