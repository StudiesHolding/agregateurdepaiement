import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from apps/backend/.env
dotenv.config({ path: path.join(__dirname, "../.env") });

import { OrchestratorService } from "../services/orchestrator.service.js";
import { WebhookProcessor } from "../services/webhook-processor.service.js";
import { Order, PaymentAttempt, sequelize } from "../models/index.js";
import { QueryTypes } from "sequelize";

/**
 * E2E Verification Script: LMS Specialized Payment
 * This script simulates a full customer journey:
 * 1. Payment Initialization for a Course
 * 2. Successful Webhook Notification
 * 3. Verification of LMS Enrollment
 */
async function runVerification() {
    console.log("🚀 Starting E2E LMS Payment Verification...");

    // --- TEST DATA ---
    const testUser = {
        id: 51,
        email: "admin.nyame@studieslearning.com",
        name: "Test Admin"
    };
    const testCourseId = "5111"; // "How To Create In-Demand Online Courses"
    const amount = 5000;

    try {
        // 1. Initialize Payment
        console.log("\n[1/3] Initializing Payment...");
        const initData = {
            amount,
            currency: "XAF",
            customerEmail: testUser.email,
            customerName: testUser.name,
            paymentMethod: "momo",
            countryCode: "CM",
            lmsItemId: testCourseId,
            lmsItemType: "course",
            metadata: {
                source: "E2E_VERIFICATION_SCRIPT",
                courseTitle: "How To Create In-Demand Online Courses"
            }
        };

        const initResult = await OrchestratorService.initializePayment(initData);
        if (!initResult.success) {
            throw new Error("Payment Initialization Failed: " + JSON.stringify(initResult));
        }

        const paymentIntentId = initResult.paymentIntentId;
        const transactionNumber = initResult.transactionNumber;
        const orderRef = initResult.orderReference;
        const order = await Order.findOne({ where: { reference: orderRef } });
        const orderId = order.id;

        console.log(`✅ Order Created: ${orderRef}`);
        console.log(`✅ Transaction Number: ${transactionNumber}`);
        console.log(`✅ Provider Chosen: ${initResult.provider}`);

        // 2. Simulate Webhook Success (CinetPay style since it had priority 1)
        console.log("\n[2/3] Simulating Webhook Success...");
        const webhookPayload = {
            cpm_trans_id: transactionNumber,
            cpm_result: "00",
            cpm_amount: amount,
            cpm_currency: "XAF"
        };

        // Note: Cinetpay webhook usually makes a callback request to check status.
        // We will mock processEvent for cinetpay or just trigger kkiapay event based on provider
        const providerName = initResult.provider.toLowerCase();
        let finalPayload = {};
        if (providerName === 'cinetpay') {
            finalPayload = { cpm_trans_id: transactionNumber, cpm_result: "00" };

            // Mock CinetPay API for test purposes so WebhookProcessor thinks it succeeded
            // This is required because CinetPay does server-to-server verification
            const { ProviderFactory } = await import("../providers/index.js");
            const originalGetProvider = ProviderFactory.getProvider;
            ProviderFactory.getProvider = (code, config) => {
                const provider = originalGetProvider(code, config);
                if (code === 'cinetpay') {
                    provider.checkStatus = async () => ({
                        success: true,
                        status: 'succeeded',
                        response: { cpm_result: "00", cpm_amount: amount, message: "Mock Success" }
                    });
                }
                return provider;
            };

            await WebhookProcessor.processEvent("cinetpay", finalPayload);
            ProviderFactory.getProvider = originalGetProvider; // Restore
        } else {
            finalPayload = {
                event: "transaction.success",
                transactionId: transactionNumber,
                partnerId: transactionNumber,
                amount: amount,
                isPaymentSucces: true
            };
            await WebhookProcessor.processEvent("kkiapay", finalPayload);
        }
        console.log("✅ Webhook Processed Successfully.");

        // 3. Verifications
        console.log("\n[3/3] Running Database Verifications...");

        // A. Verify Order Status
        const updatedOrder = await Order.findByPk(orderId);
        if (updatedOrder.status === 'completed' || updatedOrder.status === 'success') {
            console.log("✅ Order Status: SUCCESS");
        } else {
            console.error(`❌ Order Status Failure: Found ${updatedOrder.status}`);
        }

        // B. Verify LMS Enrollment
        const [enrollment] = await sequelize.query(
            `SELECT * FROM kyd4_learnpress_user_items 
             WHERE user_id = :userId AND item_id = :itemId AND item_type = 'lp_course'`,
            {
                replacements: { userId: testUser.id, itemId: testCourseId },
                type: QueryTypes.SELECT
            }
        );

        if (enrollment && enrollment.status === 'enrolled') {
            console.log("✅ LMS Enrollment Verified: User is correctly enrolled!");
        } else if (enrollment) {
            console.warn(`⚠️ Enrollment entry found but status is: ${enrollment.status}`);
        } else {
            console.error("❌ LMS Enrollment Failure: No entry found in kyd4_learnpress_user_items.");
        }

    } catch (error) {
        console.error("❌ Test Failed with error:", error);
    } finally {
        await sequelize.close();
        console.log("\n🏁 Verification Finished.");
        process.exit(0);
    }
}

runVerification();
