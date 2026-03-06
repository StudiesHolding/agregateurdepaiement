import { OrderService } from "./order.service.js";
import { PaymentIntentService } from "./payment-intent.service.js";
import { ProviderSelectorService } from "./provider-selector.service.js";
import { ProviderFactory } from "../providers/index.js";
import { BadRequestError } from "../utils/errors.js";
import { FormationsService } from "./formations.service.js";

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
      lmsItemId,
      lmsItemType,
    } = data;

    // Fallback for notifyUrl from environment variables
    const finalNotifyUrl =
      notifyUrl ||
      process.env.CINETPAY_WEEBHOOK_NOTIFY_URL ||
      process.env.WEBHOOK_NOTIFY_URL;

    let finalAmount = amount;
    let finalMetadata = metadata || {};

    if (finalMetadata.source === "payment_form_v3" && finalMetadata.formation_id) {
      const licenceCount = Number(finalMetadata.licence_count || 1) || 1;

      const formation = await FormationsService.getFormation(finalMetadata.formation_id);

      if (!formation) {
        throw new BadRequestError("Formation introuvable pour ce paiement.");
      }

      const expectedAmount = formation.price * licenceCount;

      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        throw new BadRequestError("Montant de formation invalide pour ce paiement.");
      }

      if (expectedAmount !== finalAmount) {
        console.warn(
          `[OrchestratorService] Amount mismatch for formation ${finalMetadata.formation_id}. ` +
          `Received=${finalAmount}, Expected=${expectedAmount}. Using expected amount.`,
        );
      }

      finalAmount = expectedAmount;

      finalMetadata = {
        ...finalMetadata,
        validatedByBackend: true,
        backendUnitPrice: formation.price,
        backendLicenceCount: licenceCount,
      };
    }

    // 1. Create or Find Order
    const order = await OrderService.create({
      customerEmail,
      customerName,
      customerSurname,
      customerPhone: customerPhoneNumber,
      customerAddress,
      customerCity,
      customerState,
      customerZipCode,
      currency,
      totalAmount: finalAmount,
      metadata: finalMetadata,
      lmsItemId,
      lmsItemType,
      // Pass formation details if found
      formationId: finalMetadata.formation_id,
      formationName: formation?.name, // From FormationsService
      formationPrice: formation?.price
    });

    // 2. Create Payment Intent
    const intent = await PaymentIntentService.create(
      {
        orderId: order.id,
        amount: finalAmount,
        currency,
        metadata: finalMetadata,
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
        amount: finalAmount,
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
      widgetParams: result.providerResponse?.widgetParams, // For KKiaPay widget
      provider: result.provider.name,
      clientSecret:
        result.providerResponse?.clientSecret ||
        result.providerResponse?.response?.client_secret,
    };
  }
}
