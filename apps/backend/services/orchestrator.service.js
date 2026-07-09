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
      failedUrl,
      notifyUrl,
      idempotencyKey,
      metadata,
      lmsItemId,
      lmsItemType,
      company_name,
      company_industry,
      company_admin_email,
      licence_count,
    } = data;

    console.log("[OrchestratorService] Incoming data:", {
      customerEmail,
      lmsItemId,
      lmsItemType,
      amount,
      currency,
      metadata: metadata || {},
      company_name
    });

    // Fallback for notifyUrl from environment variables
    const finalNotifyUrl =
      notifyUrl ||
      process.env.CINETPAY_WEEBHOOK_NOTIFY_URL ||
      process.env.WEBHOOK_NOTIFY_URL;

    let finalAmount = amount;
    let finalMetadata = metadata || {};
    let formation = null;

    if ((finalMetadata.source === "payment_form_v3" || lmsItemType === 'package') && (finalMetadata.formation_id || lmsItemId || data.formationId)) {
      const actualFormationId = lmsItemId || finalMetadata.formation_id || data.formationId;
      const actualLicenceCount = Number(licence_count || finalMetadata.licence_count || 1) || 1;

      if (finalMetadata.is_b2b) {
        formation = {
          id: actualFormationId,
          price: finalMetadata.unit_price || (finalAmount / actualLicenceCount),
          currency: currency,
        };
      } else {
        if (lmsItemType === 'package') {
          formation = await FormationsService.getPackage(actualFormationId);
        } else {
          formation = await FormationsService.getFormation(actualFormationId);
        }
      }

      if (!formation) {
        throw new BadRequestError("Formation introuvable pour ce paiement.");
      }

      const expectedAmount = formation.price * actualLicenceCount;

      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        throw new BadRequestError("Montant de formation invalide pour ce paiement.");
      }

      // Special Case: Auctions (Price is dynamic/bid_amount)
      if (finalMetadata.source === 'AUCTION') {
        console.log(`[OrchestratorService] Auction payment detected for auction #${finalMetadata.auction_id}. Using dynamic amount=${finalAmount}`);
      } else {
        // Only enforce the expected amount if the currency matches the formation's currency
        // If they differ, it's a cross-currency payment (e.g., product in EUR, payment in XOF)
        // and we should trust the frontend's converted amount.
        const formationCurrency = formation.currency || 'XAF'; // Assuming XAF for standard courses if not specified

        if (currency === formationCurrency) {
          if (expectedAmount !== finalAmount) {
            console.warn(
              `[OrchestratorService] Amount mismatch for formation ${actualFormationId}. ` +
              `Received=${finalAmount}, Expected=${expectedAmount}. Using expected amount.`,
            );
            finalAmount = expectedAmount;
          }
        } else {
          console.log(
            `[OrchestratorService] Cross-currency payment detected: Product=${formationCurrency}, Payment=${currency}. ` +
            `Trusting frontend amount=${finalAmount}.`
          );
        }
      }

      finalMetadata = {
        ...finalMetadata,
        validatedByBackend: true,
        backendUnitPrice: formation.price,
        backendLicenceCount: actualLicenceCount,
        b2b_purchase: lmsItemType === 'package',
        is_b2b: lmsItemType === 'package' || !!company_name,
        company_name,
        company_industry,
        company_admin_email,
        total_licenses: actualLicenceCount,
        licence_count: actualLicenceCount,
        source: finalMetadata.source || 'payment_form_v3'
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

    // Function to append query parameters to URLs
    const appendParams = (url, params) => {
      if (!url) return url;
      const urlObj = new URL(url);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlObj.searchParams.set(key, value);
        }
      });
      return urlObj.toString();
    };

    const urlParams = {
      order_ref: order.reference,
      amount: finalAmount,
      currency: currency,
    };

    const enrichedSuccessUrl = appendParams(successUrl, urlParams);
    const enrichedCancelUrl = appendParams(cancelUrl, urlParams);
    const enrichedFailedUrl = appendParams(failedUrl, urlParams);

    // 4. Define Payment Execution Logic
    const paymentFunction = async (provider, attempt) => {
      const adapter = ProviderFactory.getProvider(provider.code, {
        // Here we could pass specific credentials if they are in the provider model
        apiKey: provider.credentialsEncrypted?.apiKey,
        siteId: provider.credentialsEncrypted?.siteId,
        secretKey: provider.credentialsEncrypted?.secretKey,
      });

      console.log(`[Orchestrator] Attempt object:`, {
        id: attempt.id,
        transactionNumber: attempt.transactionNumber,
        hasTransactionNumber: attempt.hasOwnProperty('transactionNumber'),
        attemptKeys: Object.keys(attempt.dataValues || attempt)
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
        successUrl: enrichedSuccessUrl,
        cancelUrl: enrichedCancelUrl,
        failedUrl: enrichedFailedUrl,
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
