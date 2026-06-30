/**
 * Base Strategy interface for the Purchase Engine.
 * All specific purchase types (B2B_PACKAGE, B2C_COURSE, etc.) must implement these methods.
 */
export class PurchaseStrategy {
  /**
   * Defines the type of purchase this strategy handles.
   * @returns {string} e.g., 'B2B_PACKAGE'
   */
  getType() {
    throw new Error('getType() must be implemented by concrete strategy');
  }

  /**
   * Retrieves the context information for the frontend UI.
   * @param {string|number} id - The ID of the item being purchased.
   * @returns {Promise<Object>} Contains price, name, description, visual assets, etc.
   */
  async getContext(id) {
    throw new Error('getContext() must be implemented by concrete strategy');
  }

  /**
   * Validates if the user is eligible to make this purchase.
   * @param {Object} user - The authenticated user (can be null for guest checkout).
   * @param {string|number} id - The ID of the item.
   * @returns {Promise<boolean|Object>} true if eligible, throws or returns error object if not.
   */
  async validateEligibility(user, id) {
    throw new Error('validateEligibility() must be implemented by concrete strategy');
  }

  /**
   * Prepares the payment initiation payload for the PSP (e.g., CinetPay).
   * @param {Object} data - Form data from the frontend (email, names, options).
   * @returns {Promise<Object>} The payload for the PSP.
   */
  async initiatePayment(data) {
    throw new Error('initiatePayment() must be implemented by concrete strategy');
  }

  /**
   * Returns the Saga routing type to trigger after successful payment.
   * @returns {string} e.g., 'B2B_PACKAGE', 'MOODLE_HEADLESS'
   */
  getSagaRoutingType() {
    throw new Error('getSagaRoutingType() must be implemented by concrete strategy');
  }
}
