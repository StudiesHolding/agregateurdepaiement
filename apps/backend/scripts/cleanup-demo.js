import { sequelize, Order, PaymentIntent, PaymentAttempt } from "../models/index.js";
import { Op } from "sequelize";

async function cleanup() {
    console.log("🧹 Starting Demo Data Cleanup...");

    try {
        await sequelize.authenticate();

        // 1. Find all demo orders
        const demoOrders = await Order.findAll({
            where: {
                reference: {
                    [Op.like]: 'DEMO-%'
                }
            },
            attributes: ['id']
        });

        const orderIds = demoOrders.map(o => o.id);

        if (orderIds.length === 0) {
            console.log("✅ No demo transactions found. Database is already clean.");
            process.exit(0);
        }

        console.log(`🔍 Found ${orderIds.length} demo orders. Proceeding to deletion...`);

        // Use a transaction for safety
        await sequelize.transaction(async (t) => {
            // Find intents related to these orders
            const intents = await PaymentIntent.findAll({
                where: { orderId: orderIds },
                attributes: ['id'],
                transaction: t
            });
            const intentIds = intents.map(i => i.id);

            // Delete Attempts
            if (intentIds.length > 0) {
                await PaymentAttempt.destroy({
                    where: { paymentIntentId: intentIds },
                    transaction: t
                });
            }

            // Delete Intents
            await PaymentIntent.destroy({
                where: { id: intentIds },
                transaction: t
            });

            // Delete Orders
            await Order.destroy({
                where: { id: orderIds },
                transaction: t
            });
        });

        console.log(`✅ Successfully deleted ${orderIds.length} demo records and their associated intents/attempts.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Cleanup failed:", err);
        process.exit(1);
    }
}

cleanup();
