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
            paymentIntentId: data.paymentIntentId,
            providerId: data.providerId,
            transactionNumber: data.transactionNumber,
            status: AttemptStatus.PENDING,
            requestPayload: data.requestPayload || {},
            responsePayload: {},
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
                responsePayload: responsePayload,
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
                errorCode: errorCode,
                errorMessage: errorMessage,
                responsePayload: responsePayload,
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
            where: { paymentIntentId: paymentIntentId },
            order: [["createdAt", "ASC"]],
            include: ["provider"]
        });
    }
}
