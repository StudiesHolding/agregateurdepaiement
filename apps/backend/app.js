import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

dotenv.config();

// Global fix for BigInt JSON serialization
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const app = express();

// Basic Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Middlewares
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/admin", adminRoutes);

// Error handling
app.use(errorHandler);

export default app;
