import { EmailVerificationService } from "../services/email-verification.service.js";

/**
 * Middleware to enforce email verification before payment initialization
 */
export const emailVerificationMiddleware = async (req, res, next) => {
    try {
        const { customerEmail } = req.body;

        if (!customerEmail) {
            return next(); // Let validation schema handle missing email
        }

        // Bypass email verification for AUCTION source since emails are already verified
        if (req.body.metadata && req.body.metadata.source === 'AUCTION') {
            console.log(`[EmailVerificationMiddleware] Bypassing verification for AUCTION source: ${customerEmail}`);
            return next();
        }

        const isVerified = await EmailVerificationService.isVerified(customerEmail);

        if (isVerified) {
            return next();
        }

        // Email not verified, trigger code generation and send it
        console.log(`[EmailVerificationMiddleware] Verification required for ${customerEmail}`);

        const result = await EmailVerificationService.generateAndSendCode(customerEmail);

        return res.status(403).json({
            status: "fail",
            message: "Email verification required.",
            code: "email_verification_required",
            data: {
                email: customerEmail,
                expiresAt: result.expiresAt
            }
        });

    } catch (error) {
        console.error("[EmailVerificationMiddleware] CRITICAL ERROR:", error);

        if (res.headersSent) {
            console.warn("[EmailVerificationMiddleware] Warning: Headers already sent, cannot send error response.");
            return;
        }

        return res.status(500).json({
            status: "error",
            message: "Erreur lors de la vérification de l'email.",
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
