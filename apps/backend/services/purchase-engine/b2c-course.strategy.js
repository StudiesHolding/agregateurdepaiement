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
     * Récupère le contexte du cours depuis l'Authoring Engine (ou Moodle en proxy).
     */
    async getContext(id) {
        try {
            // L'API Authoring Engine doit nous renvoyer les métadonnées du cours
            const response = await axios.get(`${this.authoringApiUrl}/courses/${id}`);
            const course = response.data.data || response.data;

            if (!course) {
                throw new Error("Cours introuvable.");
            }

            return {
                title: course.title || `Formation Moodle #${id}`,
                price: parseFloat(course.price || course.montant || 0),
                currency: "XAF", // Default currency for the region
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
            // Fallback gracefully for development if API is unreachable but ID is provided
            return {
                title: `Formation B2C Standard #${id}`,
                price: 50000.00,
                currency: "XAF",
                features: [
                    "Accès individuel à la formation",
                    "Ressources téléchargeables",
                    "Certificat de réussite"
                ],
                courseDetails: {
                    courseId: id
                }
            };
        }
    }

    /**
     * Initialise la saga de paiement (communication avec CinetPay/Stripe, etc.)
     */
    async process(data, user) {
        const transactionId = `TXN-B2C-${Date.now()}-${uuidv4().substring(0, 8)}`;
        
        // Logique métier : 
        // 1. Enregistrer l'intention de paiement B2C
        // 2. Si le bénéficiaire est différent du payeur (data.beneficiaryEmail), le noter
        // 3. Générer le lien PSP

        return {
            transactionId,
            status: "PENDING",
            paymentUrl: `https://mock-psp.studieslearning.com/pay/${transactionId}`,
            message: "Initialisation du paiement B2C avec succès."
        };
    }
}
