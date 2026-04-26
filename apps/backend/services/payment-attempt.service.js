import { PaymentAttempt } from "../models/payment-attempt.model.js";
import { AttemptStatus } from "../enums/index.js";

export class PaymentAttemptService {
    /**
     * Create a payment attempt
     * @param {Object} data 
     * @returns {Promise<PaymentAttempt>}
     */
    static async create(data) {
        return await PaymentAttempt.create({
            payment_intent_id: data.paymentIntentId,
            provider_id: data.providerId,
            transaction_number: data.transactionNumber,
            status: AttemptStatus.PENDING,
            request_payload: data.requestPayload || {},
            response_payload: {},
        });
    }

    /**
     * Mark attempt as processing
     * @param {number|string} id 
     * @returns {Promise<[number]>}
     */
    static async markProcessing(id) {
        return await PaymentAttempt.update(
            { status: AttemptStatus.PROCESSING },
            { where: { id } }
        );
    }

    /**
     * Mark attempt as successful
     * @param {number|string} id 
     * @param {Object} responsePayload 
     * @returns {Promise<[number]>}
     */
    static async markSuccess(id, responsePayload) {
        return await PaymentAttempt.update(
            {
                status: AttemptStatus.SUCCEEDED,
                response_payload: responsePayload,
            },
            { where: { id } }
        );
    }

    /**
     * Mark attempt as failed
     * @param {number|string} id 
     * @param {string} errorCode 
     * @param {string} errorMessage 
     * @param {Object} responsePayload 
     * @returns {Promise<[number]>}
     */
    static async markFailed(id, errorCode, errorMessage, responsePayload = {}) {
        return await PaymentAttempt.update(
            {
                status: AttemptStatus.FAILED,
                error_code: errorCode,
                error_message: errorMessage,
                response_payload: responsePayload,
            },
            { where: { id } }
        );
    }

    /**
     * Get all attempts for a specific intent
     * @param {number|string} paymentIntentId 
     * @returns {Promise<PaymentAttempt[]>}
     */
    static async getAttemptsForIntent(paymentIntentId) {
        return await PaymentAttempt.findAll({
            where: { payment_intent_id: paymentIntentId },
            order: [["created_at", "ASC"]],
            include: ["provider"]
        });
    }
}
