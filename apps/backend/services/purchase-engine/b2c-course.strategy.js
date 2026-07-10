import { PurchaseStrategy } from "./purchase.strategy.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

/**
 * Stratégie de paiement pour un achat de formation B2C (NewStudies).
 */
export class B2cCoursePurchaseStrategy extends PurchaseStrategy {
    constructor() {
        super();
        this.authoringApiUrl = process.env.AUTHORING_ENGINE_URL || "http://localhost:4001/api/v1";
    }

    getType() {
        return "B2C_COURSE";
    }

    getSagaRoutingType() {
        return "B2C_COURSE";
    }

    async validateEligibility(user, id) {
        return true;
    }

    async initiatePayment(data) {
        return this.process(data, null);
    }

    /**
     * Récupère le contexte du cours depuis l'Authoring Engine.
     */
    async getContext(id) {
        try {
            const response = await axios.get(`${this.authoringApiUrl}/courses/${id}`);
            const course = response.data.data || response.data;

            if (!course) {
                throw new Error("Cours introuvable.");
            }

            return {
                type: this.getType(),
                itemId: id,
                title: course.title || `Formation #${id}`,
                price: parseFloat(course.price || course.montant || 0),
                currency: "XAF",
                features: [
                    "Accès individuel à la plateforme NewStudies",
                    "Ressources pédagogiques téléchargeables",
                    "Certificat de complétion inclus"
                ],
                courseDetails: {
                    courseId: id,
                    moodleId: course.moodleId
                }
            };
        } catch (error) {
            console.error(`[B2cCoursePurchaseStrategy] Erreur getContext (${id}):`, error.message);
            throw error; // Pas de fallback mock — on veut un vrai produit
        }
    }

    /**
     * Initialise le paiement via l'OrchestratorService (flux réel PSP).
     */
    async process(data, user) {
        const { OrchestratorService } = await import('../../services/orchestrator.service.js');

        const customerEmail = data.beneficiaryEmail || data.customerEmail;
        const customerName = data.customerName || customerEmail;

        const result = await OrchestratorService.initializePayment({
            customerEmail,
            customerName,
            lmsItemId: String(data.itemId),
            lmsItemType: 'course',
            paymentMethod: data.paymentMethod || 'card',
            countryCode: data.countryCode || 'CM',
            currency: data.currency || 'XAF',
            amount: data.amount || 0,
            successUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/success`,
            cancelUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/cancel`,
            failedUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/failed`,
            metadata: {
                source: 'purchase_engine',
                purchase_type: 'B2C_COURSE',
                is_b2c: true,
                customer_email: customerEmail,
                payer_email: data.customerEmail || customerEmail,
                beneficiary_email: data.beneficiaryEmail || null,
                formation_id: data.itemId,
            },
        });

        if (!result.success) {
            throw new Error(result.error || 'Erreur lors de l\'initialisation du paiement B2C.');
        }

        return {
            transactionId: result.orderReference,
            status: 'PENDING',
            provider: result.provider,
            redirectUrl: result.redirectUrl,
            widgetParams: result.widgetParams,
            clientSecret: result.clientSecret,
            message: 'Paiement B2C initialisé avec succès.',
        };
    }
}
