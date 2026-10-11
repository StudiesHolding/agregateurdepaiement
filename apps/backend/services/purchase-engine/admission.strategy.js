import { PurchaseStrategy } from "./purchase.strategy.js";
import { AppError, BadRequestError, NotFoundError } from "../../utils/errors.js";
import { SlBackendAdmissionClient } from "../sl-backend-admission.client.js";

/**
 * Paiements des candidatures (ADR-0016, D6 bis) — identifiant reçu : la CANDIDATURE (entier).
 *   ADMISSION_OFFER : la place d'un candidat admis, au prix après bourse ou exonération. Après paiement, la saga
 *                     B2C inscrit le bénéficiaire ; le backend n'accepte que le titulaire de l'offre (ou l’inscription
 *                     engagée avant l'échéance).
 *   ADMISSION_FEE   : les frais d'étude de dossier (non remboursables). Après paiement, la saga ADMISSION_FEE les
 *                     marque réglés et le dossier complet part à l'établissement.
 *
 * SÉCURITÉ : montant, devise et BÉNÉFICIAIRE viennent du backend (route interne) ; ceux du navigateur sont ignorés.
 * Le payeur peut être un proche : il paie, mais la place ou le dossier reste celui du candidat. Pas de coupon.
 */
const REASONS = {
    NO_VALID_OFFER: "Aucune offre d'admission valide pour ce dossier (offre échue ou retirée).",
    NOTHING_TO_PAY: "Rien à payer : confirmez votre place depuis votre dossier.",
    ALREADY_ENROLLED: "Votre place est déjà confirmée.",
    FORMATION_UNAVAILABLE: "Cette formation n'est plus disponible.",
    NO_FEE: "Cette session ne demande pas de frais de dossier.",
    ALREADY_PAID: "Les frais de dossier sont déjà réglés.",
    DOSSIER_ALREADY_SENT: "Ce dossier est déjà envoyé.",
};

export class AdmissionPurchaseStrategy extends PurchaseStrategy {
    /** @param {'offer'|'fee'} kind */
    constructor(kind, client = new SlBackendAdmissionClient()) {
        super();
        this.kind = kind;
        this.client = client;
    }

    getType() {
        return this.kind === "offer" ? "ADMISSION_OFFER" : "ADMISSION_FEE";
    }

    getSagaRoutingType() {
        return this.kind === "offer" ? "B2C_COURSE" : "ADMISSION_FEE";
    }

    async validateEligibility(_user, id) {
        parseCandidatureId(id);
        return true;
    }

    async initiatePayment(data) {
        return this.process(data, null);
    }

    async getContext(id) {
        const ctx = await this.loadContext(parseCandidatureId(id));
        return {
            type: this.getType(),
            itemId: ctx.candidatureId,
            title: ctx.title,
            subtitle: ctx.label,
            price: ctx.amount,
            currency: ctx.currency,
            thumbnailUrl: ctx.thumbnailUrl ?? null,
            // Le bénéficiaire est fixé : le formulaire l'affiche sans le rendre modifiable.
            beneficiary: { email: ctx.beneficiaryEmail, name: ctx.beneficiaryName },
            features: this.kind === "offer"
                ? ["Votre place confirmée dans le programme", "Accès au campus Studies Learning", "Certificat à la fin du parcours"]
                : ["Étude de votre dossier par l'établissement", "Dossier envoyé dès la confirmation du paiement", "Frais non remboursables"],
            courseDetails: { formationId: ctx.formationId, candidatureId: ctx.candidatureId },
        };
    }

    async process(data, _user) {
        const candidatureId = parseCandidatureId(data?.itemId);
        const ctx = await this.loadContext(candidatureId);
        const { OrchestratorService } = await import("../../services/orchestrator.service.js");
        const purchaseEngineUrl = process.env.PURCHASE_ENGINE_URL || "http://localhost:3005";
        const type = this.getType();
        const payerEmail = typeof data.customerEmail === "string" && data.customerEmail.includes("@") ? data.customerEmail : ctx.beneficiaryEmail;

        const result = await OrchestratorService.initializePayment({
            customerEmail: ctx.beneficiaryEmail,
            customerName: data.customerName || ctx.beneficiaryName || ctx.beneficiaryEmail,
            lmsItemId: String(ctx.formationId),
            lmsItemType: "course",
            paymentMethod: data.paymentMethod || "card",
            countryCode: data.countryCode || null,
            // Montant et devise du backend : jamais ceux du navigateur.
            currency: ctx.currency,
            amount: ctx.amount,
            successUrl: `${purchaseEngineUrl}/success?type=${type}&id=${candidatureId}`,
            cancelUrl: `${purchaseEngineUrl}/cancel?type=${type}&id=${candidatureId}`,
            failedUrl: `${purchaseEngineUrl}/failed?type=${type}&id=${candidatureId}`,
            metadata: {
                source: "purchase_engine",
                // Place admise : même saga que l'achat d'une formation (inscription + commission) ; frais : saga dédiée.
                purchase_type: this.kind === "offer" ? "B2C_COURSE" : "ADMISSION_FEE",
                is_b2c: true,
                admission_kind: this.kind,
                admission_candidature_id: candidatureId,
                formation_id: ctx.formationId,
                customer_email: ctx.beneficiaryEmail,
                beneficiary_email: ctx.beneficiaryEmail,
                payer_email: payerEmail,
                channel: "direct",
            },
        });
        if (!result?.success) throw new Error(result?.error || "Erreur lors de l'initialisation du paiement.");

        // Paiement engagé : le backend protège l'offre (ou note les frais en attente) pour cette inscription.
        const pending = await this.client.pending(candidatureId, this.kind, result.orderReference);
        if (pending.status !== 200) {
            throw new AppError(REASONS[pending.data?.code] || "Ce paiement ne peut plus être engagé : rechargez votre dossier.", pending.status === 409 ? 409 : 503);
        }

        return {
            transactionId: result.orderReference,
            status: "PENDING",
            provider: result.provider,
            redirectUrl: result.redirectUrl,
            widgetParams: result.widgetParams,
            clientSecret: result.clientSecret,
            message: "Paiement initialisé avec succès.",
        };
    }

    async loadContext(candidatureId) {
        if (!this.client.isConfigured()) throw new AppError("Le paiement des candidatures est momentanément indisponible.", 503);
        const { status, data } = await this.client.checkout(candidatureId, this.kind);
        if (status === 404) throw new NotFoundError("Dossier de candidature introuvable.");
        if (status === 400) throw new BadRequestError("Dossier de candidature invalide.");
        if (status >= 500 || status === 429) throw new AppError("Le service des admissions est momentanément indisponible. Réessayez dans un instant.", 503);
        const ctx = data?.data;
        if (status !== 200 || !ctx) throw new AppError("Réponse inattendue du service des admissions.", 502);
        if (!ctx.purchasable) throw new AppError(REASONS[ctx.reason] || "Ce paiement n'est pas disponible.", 409);
        if (typeof ctx.amount !== "number" || !(ctx.amount > 0) || typeof ctx.currency !== "string" || !ctx.beneficiaryEmail) {
            throw new AppError("Contexte de paiement invalide.", 502);
        }
        return ctx;
    }
}

function parseCandidatureId(raw) {
    const text = String(raw ?? "").trim();
    if (!/^\d{1,10}$/.test(text) || Number(text) <= 0) throw new BadRequestError("Dossier de candidature invalide.");
    return Number(text);
}
