import crypto from "crypto";
import { PaymentProviderInterface } from "../base/provider.interface.js";
import { PaymentStatus } from "../../enums/index.js";

export class CinetPayService extends PaymentProviderInterface {
    constructor(config = {}) {
        super();
        this.apiKey = config.apiKey || process.env.CINETPAY_API_KEY;
        this.siteId = config.siteId || process.env.CINETPAY_SITE_ID;
        this.apiLink = config.apiLink || process.env.CINETPAY_API_LINK || "https://api-checkout.cinetpay.com/v2/payment";
    }

    async createPayment(paymentData) {
        // Sanitize description: CinetPay forbids #, /, $, _, &
        const cleanDescription = (paymentData.description || `Payment for Order ${paymentData.orderReference}`)
            .replace(/[#/$_&]/g, " ")
            .substring(0, 100);

        const payload = {
            apikey: this.apiKey,
            site_id: this.siteId,
            transaction_id: paymentData.transactionNumber, // Use our internal TxId
            amount: Math.round(paymentData.amount), // Ensure Integer
            currency: paymentData.currency,
            description: cleanDescription,
            customer_id: paymentData.customerId || paymentData.customerEmail,
            customer_name: paymentData.customerName || "Customer",
            customer_surname: paymentData.customerSurname || "User",
            customer_phone_number: paymentData.customerPhoneNumber || "+22500000000",
            customer_email: paymentData.customerEmail,
            customer_address: paymentData.customerAddress || "N/A",
            customer_city: paymentData.customerCity || "N/A",
            customer_country: paymentData.countryCode || "CI",
            customer_state: paymentData.customerState || paymentData.countryCode || "CI",
            customer_zip_code: paymentData.customerZipCode || "00000",
            notify_url: paymentData.notifyUrl,
            return_url: paymentData.successUrl,
            channels: paymentData.channels || "ALL",
            lock_phone_number: paymentData.lockPhoneNumber || false,
            metadata: JSON.stringify({
                paymentIntentId: paymentData.paymentIntentId,
                orderId: paymentData.orderId
            }),
            lang: paymentData.lang || "fr",
            invoice_data: paymentData.invoiceData || {
                "Order": paymentData.orderReference
            }
        };

        try {
            const response = await fetch(this.apiLink, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.code === "201") {
                return {
                    success: true,
                    transactionNumber: data.data.payment_token,
                    redirectUrl: data.data.payment_url,
                    status: PaymentStatus.REQUIRES_ACTION,
                    response: data,
                };
            } else {
                return {
                    success: false,
                    errorCode: `CINETPAY_${data.code}`,
                    errorMessage: data.message,
                    response: data,
                };
            }
        } catch (error) {
            return {
                success: false,
                errorCode: "CINETPAY_NETWORK_ERROR",
                errorMessage: error.message,
            };
        }
    }

    async checkStatus(transactionId) {
        const checkUrl = process.env.CINETPAY_API_CKECK_TRANS_URL || "https://api-checkout.cinetpay.com/v2/payment/check";

        const payload = {
            apikey: this.apiKey,
            site_id: this.siteId,
            transaction_id: transactionId
        };

        try {
            const response = await fetch(checkUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            // Code 00 is Success, Code 662 is Pending (Waiting for customer)
            const isNormalResponse = data.code === "00" || data.code === "662";

            if (!isNormalResponse) {
                console.error(`[CinetPayService] Status check error: ${data.message} (Code: ${data.code})`);
            }

            return {
                success: isNormalResponse,
                status: data.data ? this.mapStatus(data.data.status || data.message) : null,
                errorCode: data.code,
                errorMessage: data.message,
                response: data,
            };
        } catch (error) {
            console.error("[CinetPayService] Network error during status check:", error);
            return { success: false, errorMessage: error.message };
        }
    }

    mapStatus(status) {
        if (!status) return PaymentStatus.FAILED;

        switch (status.toUpperCase()) {
            case "ACCEPTED":
                return PaymentStatus.SUCCEEDED;
            case "REFUSED":
            case "CANCEL":
                return PaymentStatus.FAILED;
            case "WAITING":
            case "WAITING_CUSTOMER_PAYMENT":
            case "WAITING_FOR_CUSTOMER":
                return PaymentStatus.PROCESSING;
            default:
                return PaymentStatus.FAILED;
        }
    }

    /**
     * Validate CinetPay Webhook Signature (x-token)
     * @param {Object} payload 
     * @param {string} signature 
     * @param {string} secret (API Key)
     */
    validateWebhookSignature(payload, signature, secret) {
        if (!signature || !secret) return false;

        try {
            // CinetPay V2 uses HMAC SHA256 of the site_id and transaction_id usually 
            // but the safest way is to trust their recommendation: always verify via API.
            // However, we can try to implement the standard HMAC if payload matches.
            const hmac = crypto.createHmac('sha256', secret);
            // Some versions of CinetPay use the raw body as string
            const data = JSON.stringify(payload);
            const digest = hmac.update(data).digest('hex');

            return digest === signature;
        } catch (error) {
            console.error("[CinetPayService] Signature validation error:", error);
            return false;
        }
    }
}
