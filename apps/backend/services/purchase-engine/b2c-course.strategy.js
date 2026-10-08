import { PurchaseStrategy } from "./purchase.strategy.js";
import axios from "axios";
import { AppError, BadRequestError, NotFoundError } from "../../utils/errors.js";

/**
 * Stratégie de paiement d'une formation B2C (S1-7b).
 *
 * L'identifiant reçu du purchase-engine est l'identifiant CANONIQUE de formation
 * (`sl_formation.id_formation`, entier). Le contexte d'achat (titre, prix, devise,
 * achetabilité) vient du backend métier :
 *   GET {SL_BACKEND_URL}{SL_BACKEND_API_PREFIX}/formation/formations/:id/enroll-intent
 *
 * SÉCURITÉ : le prix et la devise sont TOUJOURS relus côté serveur au moment du
 * paiement ; ceux envoyés par le navigateur sont ignorés.
 */
export const B2C_INTENT_TIMEOUT_MS = 8000;
// Même format que les codes de lien d'auteur du backend métier (ADR-0012, D14) : 6 à 16 lettres ou chiffres.
const AFFILIATE_REF = /^[A-Za-z0-9]{6,16}$/;

/** Appel HTTP par défaut vers l'endpoint enroll-intent du backend métier. */
async function fetchEnrollIntentOverHttp(formationId) {
    const baseUrl = (process.env.SL_BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
    const prefix = process.env.SL_BACKEND_API_PREFIX || "/api/v1";
    try {
        const response = await axios.get(
            `${baseUrl}${prefix}/formation/formations/${formationId}/enroll-intent`,
            { timeout: B2C_INTENT_TIMEOUT_MS, validateStatus: () => true },
        );
        return { status: response.status, body: response.data };
    } catch (error) {
        return { status: 0, body: null, error };
    }
}

export class B2cCoursePurchaseStrategy extends PurchaseStrategy {
    /**
     * @param {(formationId: number) => Promise<{status: number, body: any, error?: Error}>} [fetchIntent]
     */
    constructor(fetchIntent = fetchEnrollIntentOverHttp) {
        super();
        this.fetchIntent = fetchIntent;
    }

    getType() {
        return "B2C_COURSE";
    }

    getSagaRoutingType() {
        return "B2C_COURSE";
    }

    async validateEligibility(_user, id) {
        parseFormationId(id);
        return true;
    }

    async initiatePayment(data) {
        return this.process(data, null);
    }

    /** Contexte affiché par le purchase-engine. */
    async getContext(id) {
        const intent = await this.loadPurchasableIntent(parseFormationId(id));
        return {
            type: this.getType(),
            itemId: intent.formationId,
            title: intent.title,
            price: intent.price,
            currency: intent.currency,
            thumbnailUrl: intent.thumbnailUrl ?? null,
            features: [
                "Accès individuel au campus Studies Learning",
                "Ressources pédagogiques téléchargeables",
                "Certificat de complétion inclus",
            ],
            courseDetails: { formationId: intent.formationId },
        };
    }

    /** Initialise le paiement via l'OrchestratorService (flux réel PSP), au prix serveur. */
    async process(data, _user) {
        const formationId = parseFormationId(data?.itemId);
        const intent = await this.loadPurchasableIntent(formationId);

        const { OrchestratorService } = await import("../../services/orchestrator.service.js");
        const customerEmail = data.beneficiaryEmail || data.customerEmail;
        const customerName = data.customerName || customerEmail;
        const purchaseEngineUrl = process.env.PURCHASE_ENGINE_URL || "http://localhost:3005";
        const channelRef = typeof data.ref === "string" && AFFILIATE_REF.test(data.ref) ? data.ref : null;

        const result = await OrchestratorService.initializePayment({
            customerEmail,
            customerName,
            lmsItemId: String(formationId),
            lmsItemType: "course",
            paymentMethod: data.paymentMethod || "card",
            countryCode: data.countryCode || "CM",
            // Prix et devise du backend : jamais ceux du navigateur.
            currency: intent.currency,
            amount: intent.price,
            successUrl: `${purchaseEngineUrl}/success`,
            cancelUrl: `${purchaseEngineUrl}/cancel`,
            failedUrl: `${purchaseEngineUrl}/failed`,
            metadata: {
                source: "purchase_engine",
                purchase_type: "B2C_COURSE",
                is_b2c: true,
                customer_email: customerEmail,
                payer_email: data.customerEmail || customerEmail,
                beneficiary_email: data.beneficiaryEmail || null,
                formation_id: formationId,
                // Attribution : le lien est enregistré, sa validation arrive au sprint 4.
                channel: "direct",
                channel_ref: channelRef,
            },
        });

        if (!result.success) {
            throw new Error(result.error || "Erreur lors de l'initialisation du paiement B2C.");
        }

        return {
            transactionId: result.orderReference,
            status: "PENDING",
            provider: result.provider,
            redirectUrl: result.redirectUrl,
            widgetParams: result.widgetParams,
            clientSecret: result.clientSecret,
            message: "Paiement B2C initialisé avec succès.",
        };
    }

    /** Lit l'intention d'inscription et refuse tout ce qui n'est pas achetable. */
    async loadPurchasableIntent(formationId) {
        const { status, body, error } = await this.fetchIntent(formationId);
        if (status === 0) {
            console.error(`[B2cCoursePurchaseStrategy] backend injoignable (formation ${formationId}):`, error?.message);
            throw new AppError("Le catalogue est momentanément indisponible. Réessayez dans un instant.", 503);
        }
        if (status === 404) {
            throw new NotFoundError("Formation introuvable.");
        }
        if (status === 400) {
            throw new BadRequestError("Identifiant de formation invalide.");
        }
        if (status < 200 || status >= 300 || !body?.data) {
            throw new AppError("Réponse inattendue du catalogue.", 502);
        }
        const intent = body.data;
        if (intent.accessType === "free") {
            throw new BadRequestError("Formation gratuite : l'inscription se fait directement, sans paiement.");
        }
        if (!intent.purchasable) {
            throw new AppError(
                intent.unavailableReason === "COURSE_NOT_READY"
                    ? "Cette formation est en préparation sur le campus : les inscriptions ouvrent bientôt."
                    : "Les inscriptions à cette formation sont momentanément fermées.",
                409,
            );
        }
        if (typeof intent.price !== "number" || !(intent.price > 0) || typeof intent.currency !== "string") {
            throw new AppError("Prix de la formation invalide.", 502);
        }
        return intent;
    }
}

/** Identifiant canonique de formation : entier strictement positif. */
function parseFormationId(raw) {
    const text = String(raw ?? "").trim();
    if (!/^\d{1,10}$/.test(text) || Number(text) <= 0) {
        throw new BadRequestError("Identifiant de formation invalide.");
    }
    return Number(text);
}
