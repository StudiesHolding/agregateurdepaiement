import { OrderService } from "./order.service.js";
import { PaymentIntentService } from "./payment-intent.service.js";
import { ProviderSelectorService } from "./provider-selector.service.js";
import { ProviderFactory } from "../providers/index.js";
import { BadRequestError } from "../utils/errors.js";

export class OrchestratorService {
  /**
   * Initialize a payment from end-to-end
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async initializePayment(data) {
    const {
      customerEmail,
      customerName,
      customerSurname,
      customerPhoneNumber,
      customerAddress,
      customerCity,
      customerState,
      customerZipCode,
      customerId,
      lang,
      invoiceData,
      description,
      channels,
      lockPhoneNumber,
      currency,
      amount,
      paymentMethod,
      countryCode,
      successUrl,
      cancelUrl,
      notifyUrl,
      idempotencyKey,
      metadata,
    } = data;

    // Fallback for notifyUrl from environment variables
    const finalNotifyUrl =
      notifyUrl ||
      process.env.CINETPAY_WEEBHOOK_NOTIFY_URL ||
      process.env.WEBHOOK_NOTIFY_URL;

    // 1. Create or Find Order (simplified here to create new)
    const order = await OrderService.create({
      customerEmail,
      customerName,
      currency,
      totalAmount: amount,
      metadata: metadata || {},
    });

    // 2. Create Payment Intent
    const intent = await PaymentIntentService.create(
      {
        orderId: order.id,
        amount,
        currency,
        metadata: metadata || {},
      },
      idempotencyKey,
    );

    // 3. Initialize Selector
    const selector = new ProviderSelectorService(intent);
    const routes = await selector.initialize(paymentMethod, countryCode);

    if (routes.length === 0) {
      throw new BadRequestError(
        `No available provider for ${paymentMethod} in ${countryCode} with ${currency}`,
      );
    }

    // 4. Define Payment Execution Logic
    const paymentFunction = async (provider, attempt) => {
      const adapter = ProviderFactory.getProvider(provider.code, {
        // Here we could pass specific credentials if they are in the provider model
        apiKey: provider.credentialsEncrypted?.apiKey,
        siteId: provider.credentialsEncrypted?.siteId,
        secretKey: provider.credentialsEncrypted?.secretKey,
      });

      return await adapter.createPayment({
        amount,
        currency,
        orderId: order.id,
        orderReference: order.reference,
        paymentIntentId: intent.id,
        transactionNumber: attempt.transactionNumber,
        customerEmail,
        customerName,
        customerSurname,
        customerPhoneNumber,
        customerAddress,
        customerCity,
        customerState,
        customerZipCode,
        customerId,
        lang,
        invoiceData,
        description,
        channels,
        lockPhoneNumber,
        countryCode,
        successUrl,
        cancelUrl,
        notifyUrl: finalNotifyUrl,
      });
    };

    // 5. Execute with Fallback
    const result = await selector.executeWithFallback(paymentFunction);

    if (!result.success) {
      return {
        success: false,
        orderReference: order.reference,
        paymentIntentId: String(intent.id),
        error: result.error,
        errors: result.errors, // Propagate all collected errors
      };
    }

    return {
      success: true,
      orderReference: order.reference,
      paymentIntentId: String(intent.id),
      transactionNumber: result.attempt.transactionNumber,
      redirectUrl: result.providerResponse?.redirectUrl, // Standardized by adapters
      provider: result.provider.name,
      clientSecret:
        result.providerResponse?.clientSecret ||
        result.providerResponse?.response?.client_secret,
    };
  }
}
