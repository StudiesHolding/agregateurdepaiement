import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminAuth2faRoutes from "./routes/admin-auth-2fa.routes.js";
import testRoutes from "./routes/test.routes.js";
import b2bRoutes from "./routes/b2b.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { status: "fail", message: "Too many requests from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

dotenv.config();

// Global fix for BigInt JSON serialization
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const app = express();

// Trust proxy (required for express-rate-limit behind Nginx/PM2)
app.set("trust proxy", 1);

// Apply Rate Limiter
app.use("/api/", limiter);

// Basic Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Middlewares
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(cors({
    origin: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',')
        : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "https://dashboard.studieslearning.com", "https://sl-business.studieslearning.com"],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/admin/auth/2fa", adminAuth2faRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/test", testRoutes);
app.use("/api/b2b", b2bRoutes);

// Error handling
app.use(errorHandler);

export default app;
