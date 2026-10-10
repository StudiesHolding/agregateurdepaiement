import { PurchaseStrategy } from "./purchase.strategy.js";
import axios from "axios";
import { AppError, BadRequestError, NotFoundError } from "../../utils/errors.js";
import { SlBackendCouponClient, isRetryableCouponStatus } from "../sl-backend-coupon.client.js";
import { SlBackendEnrollmentClient, isRetryableEnrollmentStatus } from "../sl-backend-enrollment.client.js";

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
 *
 * COUPONS (ADR-0012, D6 bis) : le backend métier calcule le prix avec coupon et réserve l'utilisation ; le montant
 * payé est celui de la réservation. Coupon à 100 % : aucune transaction, inscription directe (source coupon_free).
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
    constructor(fetchIntent = fetchEnrollIntentOverHttp, couponClient = new SlBackendCouponClient(), enrollmentClient = new SlBackendEnrollmentClient()) {
        super();
        this.fetchIntent = fetchIntent;
        this.couponClient = couponClient;
        this.enrollmentClient = enrollmentClient;
    }

    /** Aperçu d'un code (aucune réservation) : prix avant/après, ou refus motivé. */
    async previewCoupon(id, code, email) {
        const formationId = parseFormationId(id);
        await this.loadPurchasableIntent(formationId);
        const { status, data } = await this.couponClient.quote(String(code ?? "").slice(0, 40), formationId, email || null);
        if (isRetryableCouponStatus(status)) throw new AppError("Les codes sont momentanément indisponibles. Réessayez dans un instant.", 503);
        if (status !== 200 || !data?.data) throw new AppError("Code impossible à vérifier.", 502);
        return data.data;
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
            // Promotion en cours (ADR-0017, D1) : prix barré affiché au paiement.
            listPrice: intent.listPrice ?? intent.price,
            promotion: intent.promotion ? { percent: intent.promotion.percent } : null,
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

        // Coupon : réservé AVANT d'initier le paiement ; le montant est celui calculé par le backend métier.
        const coupon = await this.reserveCoupon(data.couponCode, formationId, customerEmail, intent.currency);
        if (coupon && Number(coupon.finalAmount) === 0) {
            return this.enrollWithFreeCoupon(coupon, formationId, customerEmail, channelRef, purchaseEngineUrl);
        }

        let result;
        try {
        result = await OrchestratorService.initializePayment({
            customerEmail,
            customerName,
            lmsItemId: String(formationId),
            lmsItemType: "course",
            paymentMethod: data.paymentMethod || "card",
            countryCode: data.countryCode || "CM",
            // Prix et devise du backend : jamais ceux du navigateur.
            currency: intent.currency,
            amount: coupon ? Number(coupon.finalAmount) : intent.price,
            // Pages de retour du purchase-engine : la formation y figure pour ramener l'apprenant au bon endroit.
            successUrl: `${purchaseEngineUrl}/success?type=B2C_COURSE&id=${formationId}`,
            cancelUrl: `${purchaseEngineUrl}/cancel?type=B2C_COURSE&id=${formationId}`,
            failedUrl: `${purchaseEngineUrl}/failed?type=B2C_COURSE&id=${formationId}`,
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
                // Promotion (ADR-0017, D1) : prix catalogue et financeur, renvoyés au crédit de commission.
                ...promotionMetadata(intent, coupon),
                ...(coupon ? {
                    coupon_code: coupon.code,
                    coupon_reservation_id: coupon.reservationId,
                    coupon_list_amount: coupon.listAmount,
                    coupon_discount: coupon.discountAmount,
                    coupon_funder: coupon.funder,
                } : {}),
            },
        });
        } catch (error) {
            if (coupon) await this.couponClient.release(coupon.reservationId).catch(() => undefined);
            throw error;
        }

        if (!result.success) {
            if (coupon) await this.couponClient.release(coupon.reservationId).catch(() => undefined);
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

    /** Réserve le coupon saisi (ou null sans code) ; refus motivé en 409, indisponibilité en 503. */
    async reserveCoupon(rawCode, formationId, email, currency) {
        const code = typeof rawCode === "string" ? rawCode.trim().slice(0, 40) : "";
        if (!code) return null;
        if (!email) throw new BadRequestError("Indiquez l'e-mail de l'apprenant pour utiliser un code.");
        const { status, data } = await this.couponClient.reserve(code, formationId, email);
        if (isRetryableCouponStatus(status)) throw new AppError("Les codes sont momentanément indisponibles. Réessayez dans un instant.", 503);
        const quote = data?.data;
        if (status !== 200 || !quote) throw new AppError(data?.error || "Code impossible à vérifier.", status >= 400 && status < 500 ? status : 502);
        if (!quote.valid) throw new AppError(quote.message || "Ce code ne s'applique pas.", 409);
        if (quote.currency !== currency || !/^\d+(\.\d{1,3})?$/.test(String(quote.finalAmount)) || !quote.reservationId) {
            await this.couponClient.release(quote.reservationId).catch(() => undefined);
            throw new AppError("Réponse inattendue du service des codes.", 502);
        }
        return quote;
    }

    /** Coupon à 100 % : aucune transaction ; inscription directe puis confirmation du coupon (D6 bis). */
    async enrollWithFreeCoupon(coupon, formationId, email, channelRef, purchaseEngineUrl) {
        const orderRef = `COUPON-${coupon.reservationId}`;
        const { status, data } = await this.enrollmentClient.enroll({
            email, formationId, orderRef, lineRef: "1", source: "coupon_free", ...(channelRef ? { ref: channelRef } : {}),
        }, orderRef);
        if (status !== 200 && status !== 201) {
            await this.couponClient.release(coupon.reservationId).catch(() => undefined);
            if (status === 404 && data?.code === "USER_NOT_FOUND") {
                throw new AppError("Aucun compte Studies Learning ne correspond à cet e-mail : créez votre compte, puis réessayez.", 409);
            }
            if (isRetryableEnrollmentStatus(status)) throw new AppError("L'inscription est momentanément indisponible. Réessayez dans un instant.", 503);
            throw new AppError(data?.error || "L'inscription n'a pas abouti.", 409);
        }
        const confirmed = await this.couponClient.confirm(coupon.reservationId, orderRef);
        if (confirmed.status !== 200) console.error(`[B2cCoursePurchaseStrategy] coupon ${coupon.code} non confirmé (${confirmed.status}) — inscription faite`);
        return {
            transactionId: orderRef,
            status: "COMPLETED",
            provider: null,
            redirectUrl: `${purchaseEngineUrl}/success?type=B2C_COURSE&id=${formationId}&ref=${encodeURIComponent(orderRef)}`,
            message: "Inscription offerte confirmée.",
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

/**
 * Métadonnées de promotion : seulement si elle s'applique vraiment au prix payé (un coupon exclusif plus avantageux
 * repart du prix catalogue, sans la promotion).
 */
export function promotionMetadata(intent, coupon) {
    const funder = intent?.promotion?.funder;
    const list = Number(intent?.listPrice);
    if (!["author", "shared"].includes(funder) || !(list > 0)) return {};
    const beforeCoupon = coupon ? Number(coupon.listAmount) : Number(intent.price);
    if (!(beforeCoupon < list)) return {};
    return { promotion_list_amount: String(intent.listPrice), promotion_funder: funder };
}

/** Identifiant canonique de formation : entier strictement positif. */
function parseFormationId(raw) {
    const text = String(raw ?? "").trim();
    if (!/^\d{1,10}$/.test(text) || Number(text) <= 0) {
        throw new BadRequestError("Identifiant de formation invalide.");
    }
    return Number(text);
}
