import express from "express"
import { Order } from "./models/order.model.js"
import { PaymentIntent } from "./models/PaymentIntent.model.js"
import { PaymentAttempt } from "./models/Paymentattempt.model.js"
import { PaymentProvider } from "./models/PaymentProvider.model.js"
import { ProviderRoute } from "./models/PaymentRouter.model.js"
import route from "./routes/Payment.Routes.js"
import { authMiddleware } from "./middlewares/auth.middleware.js"
import dotenv from 'dotenv';


export const app = express();
dotenv.config({ path: '../../.env' });

app.use(express.json());
app.use(authMiddleware);
app.use("/api/payments", route);

await Order.sync();
await PaymentProvider.sync();
await PaymentIntent.sync();
await ProviderRoute.sync();
await PaymentAttempt.sync();