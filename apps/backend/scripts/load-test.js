import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import { OrchestratorService } from "../services/orchestrator.service.js";
import { WebhookProcessor } from "../services/webhook-processor.service.js";
import { sequelize } from "../models/index.js";

// Mock CinetPay API to avoid real network queries during load tests
const { ProviderFactory } = await import("../providers/index.js");
const originalGetProvider = ProviderFactory.getProvider;
ProviderFactory.getProvider = (code, config) => {
    const provider = originalGetProvider(code, config);
    if (code === 'cinetpay') {
        provider.checkStatus = async () => ({
            success: true,
            status: 'succeeded',
            response: { cpm_result: "00", cpm_amount: 5000, message: "Mock Success" }
        });
    }
    return provider;
};

const NUM_CONCURRENT_REQUESTS = 50;

async function runLoadTest() {
    console.log(`🚀 Starting Load Test: Simulating ${NUM_CONCURRENT_REQUESTS} concurrent checkouts and webhooks...`);
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    const promises = Array.from({ length: NUM_CONCURRENT_REQUESTS }).map(async (_, i) => {
        try {
            // 1. Init Payment
            const initData = {
                amount: 5000,
                currency: "XAF",
                customerEmail: `loadtest${i}@example.com`,
                customerName: `Load Tester ${i}`,
                paymentMethod: "momo",
                countryCode: "CM",
                lmsItemId: "5111",
                lmsItemType: "course",
                metadata: { source: "LOAD_TEST" }
            };

            const initResult = await OrchestratorService.initializePayment(initData);
            if (!initResult.success) {
                throw new Error("Init Failed");
            }

            // 2. Process Webhook
            const webhookPayload = {
                cpm_trans_id: initResult.transactionNumber,
                cpm_result: "00",
                cpm_amount: 5000,
                cpm_currency: "XAF"
            };

            await WebhookProcessor.processEvent("cinetpay", webhookPayload);

            // 3. To test idempotency, attempt to double-process the webhook occasionally
            if (i % 5 === 0) { // 20% of requests get a double webhook
                await WebhookProcessor.processEvent("cinetpay", webhookPayload);
            }

            successCount++;
        } catch (err) {
            failureCount++;
            console.error(`❌ Request ${i} failed:`, err.message);
        }
    });

    await Promise.allSettled(promises);

    const endTime = Date.now();
    console.log(`\n🏁 Load Test Finished in ${(endTime - startTime) / 1000} seconds.`);
    console.log(`✅ Successes: ${successCount}`);
    console.log(`❌ Failures: ${failureCount}`);

    ProviderFactory.getProvider = originalGetProvider; // Restore
    await sequelize.close();
    process.exit(failureCount === 0 ? 0 : 1);
}

runLoadTest();
