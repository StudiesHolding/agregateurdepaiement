import { ApiKeyService } from "../services/api-key.service.js";
import { MailService } from "../services/mail.service.js";
import { VerifiedEmail } from "../models/index.js";
import { UnauthorizedError } from "../utils/errors.js";
import jwt from "jsonwebtoken";
import crypto from 'node:crypto';

export class AdminAuth2FAController {
    /**
     * Step 1: Initialize 2FA by verifying ApiKey and sending OTP
     */
    static async init(req, res) {
        const { apiKey } = req.body;

        if (!apiKey) {
            throw new UnauthorizedError("Clé API requise.");
        }

        const keyRecord = await ApiKeyService.findByKey(apiKey);

        if (!keyRecord || !keyRecord.isActive || !keyRecord.owner.startsWith("admin:")) {
            throw new UnauthorizedError("Clé API invalide ou accès non autorisé.");
        }

        if (!keyRecord.email) {
            throw new Error("Aucune adresse email n'est liée à cette clé. Contactez un administrateur.");
        }

        // Generate 8-digit OTP
        const otp = Math.floor(10000000 + Math.random() * 90000000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP in VerifiedEmail table (reuse the table structure)
        const [record] = await VerifiedEmail.findOrCreate({
            where: { email: keyRecord.email.toLowerCase() }
        });

        await record.update({
            verificationCode: otp,
            codeExpiresAt: expiresAt,
            attemptsCount: 0,
            isVerified: false
        });

        // Send Email
        await MailService.sendVerificationCode(keyRecord.email, otp);

        res.json({
            status: "success",
            message: "Un code OTP a été envoyé à votre adresse email.",
            emailMasked: keyRecord.email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length))
        });
    }

    /**
     * Step 2: Verify OTP and return session token
     */
    static async verify(req, res) {
        const { apiKey, otp } = req.body;

        if (!apiKey || !otp) {
            throw new UnauthorizedError("Clé API et OTP requis.");
        }

        const keyRecord = await ApiKeyService.findByKey(apiKey);

        if (!keyRecord || !keyRecord.isActive) {
            throw new UnauthorizedError("Session invalide.");
        }

        const record = await VerifiedEmail.findOne({
            where: { email: keyRecord.email.toLowerCase() }
        });

        if (!record || record.verificationCode !== otp || record.codeExpiresAt < new Date()) {
            throw new UnauthorizedError("Code OTP incorrect ou expiré.");
        }

        // Clear OTP after success
        await record.update({ verificationCode: null, codeExpiresAt: null });

        // Generate JWT for the dashboard session
        const token = jwt.sign(
            {
                id: keyRecord.id,
                owner: keyRecord.owner,
                role: 'admin',
                apiKey: keyRecord.key
            },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '12h' }
        );

        res.json({
            status: "success",
            user: {
                id: "admin-user",
                name: keyRecord.owner.split(":")[1] || "Admin",
                email: keyRecord.email,
                role: "admin",
            },
            token
        });
    }
}
