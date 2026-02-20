import { sequelize, Order, PaymentIntent, PaymentAttempt, PaymentProvider } from "../models/index.js";
import { PaymentStatus, AttemptStatus } from "../enums/index.js";
import { v4 as uuidv4 } from 'uuid';

async function seed() {
    console.log("🚀 Starting Professional Demo Seeding...");

    try {
        await sequelize.authenticate();

        // 1. Get providers
        const providers = await PaymentProvider.findAll();
        if (providers.length === 0) {
            console.error("❌ No providers found. Run seed-providers.js first.");
            process.exit(1);
        }

        // 2. Generate 150 orders/intents over last 14 days
        const count = 150;
        const now = new Date();

        const courses = [
            { id: 101, name: "Formation Complète React & Next.js" },
            { id: 102, name: "Mastering Node.js Backend" },
            { id: 103, name: "UI/UX Design for SaaS" },
            { id: 104, name: "DevOps & Cloud Orchestration" }
        ];

        for (let i = 0; i < count; i++) {
            // Random date in last 14 days
            const dayOffset = Math.floor(Math.random() * 14);
            const hourOffset = Math.floor(Math.random() * 24);
            const minuteOffset = Math.floor(Math.random() * 60);
            const createdAt = new Date(now);
            createdAt.setDate(now.getDate() - dayOffset);
            createdAt.setHours(now.getHours() - hourOffset);
            createdAt.setMinutes(now.getMinutes() - minuteOffset);

            const course = courses[Math.floor(Math.random() * courses.length)];
            const amount = 5000 + Math.floor(Math.random() * 45000);
            const status = Math.random() > 0.15 ? 'succeeded' : (Math.random() > 0.5 ? 'failed' : 'created');
            const provider = providers[Math.floor(Math.random() * providers.length)];

            // Create Order
            const order = await Order.create({
                reference: `DEMO-${uuidv4().substring(0, 8).toUpperCase()}`,
                amount,
                totalAmount: amount,
                currency: 'XAF',
                customerEmail: `user${i}@example.com`,
                customerName: `Customer ${i}`,
                status: status === 'succeeded' ? 'completed' : 'failed',
                metadata: {
                    courseId: course.id,
                    courseName: course.name,
                    packageType: 'full_access'
                },
                createdAt,
                updatedAt: createdAt
            });

            // Create Intent
            const intent = await PaymentIntent.create({
                orderId: order.id,
                amount,
                currency: 'XAF',
                status,
                paymentMethod: i % 3 === 0 ? 'card' : 'mobile_money',
                countryCode: i % 4 === 0 ? 'CI' : (i % 3 === 1 ? 'SN' : 'CM'),
                idempotencyKey: uuidv4(),
                selectedProviderId: provider.id,
                createdAt,
                updatedAt: createdAt
            });

            // Create Attempt
            await PaymentAttempt.create({
                paymentIntentId: intent.id,
                providerId: provider.id,
                transactionNumber: `TXN-${uuidv4().substring(0, 12).toUpperCase()}`,
                amount,
                currency: 'XAF',
                status: status === 'succeeded' ? 'succeeded' : (status === 'pending' ? 'initiated' : 'failed'),
                errorCode: status === 'failed' ? 'insufficient_funds' : null,
                errorMessage: status === 'failed' ? 'Solde insuffisant sur le compte' : null,
                rawResponse: { demo: true },
                createdAt,
                updatedAt: createdAt
            });

            if (i % 25 === 0) console.log(`...seeded ${i}/${count} records`);
        }

        console.log("✅ Seeding complete! 150 transactions injected with historical timestamps.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeding failed:", err);
        process.exit(1);
    }
}

seed();
