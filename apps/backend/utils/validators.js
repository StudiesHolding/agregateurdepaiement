import { z } from "zod";

export const initPaymentSchema = z.object({
    customerEmail: z.string().email(),
    customerSurname: z.string().optional(),
    customerPhoneNumber: z.string().optional(),
    customerAddress: z.string().optional(),
    customerCity: z.string().optional(),
    customerState: z.string().max(2).optional(),
    customerZipCode: z.string().optional(),
    customerId: z.string().optional(),
    lang: z.enum(["fr", "en"]).optional(),
    invoiceData: z.record(z.string()).optional(),
    description: z.string().optional(),
    channels: z.enum(["ALL", "MOBILE_MONEY", "CREDIT_CARD", "WALLET"]).optional(),
    lockPhoneNumber: z.boolean().optional(),
    currency: z.string().min(3).max(10),
    amount: z.number().positive(),
    paymentMethod: z.enum(["card", "mobile_money"]),
    countryCode: z.string().length(2),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
    notifyUrl: z.string().url().optional(),
    idempotencyKey: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export const paymentStatusSchema = z.object({
    id: z.string(),
});
