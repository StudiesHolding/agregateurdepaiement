import express from 'express';
import { linkPayment, InitPaymentMobileMoney, CardPayment, pinVerification } from '../controllers/payments.Controller';
import { authMiddleware } from '../middlewares/auth.middleware';
const router = express.Router();

router.post('/link-payment', [authMiddleware], linkPayment);
router.post('/init-payment-mobile-money', InitPaymentMobileMoney);
router.post('/card-payment', CardPayment);
router.post('/pin-verification', pinVerification);

export default router;