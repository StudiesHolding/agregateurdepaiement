import { PurchaseStrategy } from "./purchase.strategy.js";
import { AppError, BadRequestError, NotFoundError } from "../../utils/errors.js";
import { AuctionClaimsClient } from "../auction-claims.client.js";

/**
 * Inscription après une enchère remportée (ADR-0021, D4)
 * ======================================================
 * Le lien reçu par e-mail porte l'enchère et un jeton d'invitation. Montant, devise, personne et formation viennent de
 * l'invitation vérifiée auprès du service des enchères — à l'affichage ET à la création du paiement — jamais du
 * navigateur. Le jeton n'est ni stocké ni renvoyé dans les adresses de retour.
 */
const AUCTION_ID = /^\d{1,10}$/;
const CLAIM_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

const REFUSED = {
    paid: "Cette inscription est déjà réglée : la formation vous attend dans votre espace Studies Learning.",
    deadline: "Le délai de 48 heures est passé : la place a été proposée à l'enchérisseur suivant.",
    expired: "Le délai de 48 heures est passé : la place a été proposée à l'enchérisseur suivant.",
    superseded: "Cette invitation n'est plus valable : la place a été attribuée.",
};

export class AuctionPaymentStrategy extends PurchaseStrategy {
    constructor(client = new AuctionClaimsClient()) {
        super();
        this.client = client;
    }

    getType() { return "AUCTION_PAYMENT"; }

    getSagaRoutingType() { return "AUCTION"; }

    async validateEligibility(_user, id) {
        if (!AUCTION_ID.test(String(id ?? ""))) throw new BadRequestError("Enchère invalide.");
        return true;
    }

    async initiatePayment(data) { return this.process(data, null); }

    /** Invitation vérifiée et payable, sinon refus explicite (déjà réglée, délai passé…). */
    async loadClaim(auctionId, token) {
        if (!AUCTION_ID.test(String(auctionId ?? ""))) throw new BadRequestError("Enchère invalide.");
        if (typeof token !== "string" || !CLAIM_TOKEN.test(token)) throw new BadRequestError("Ce lien d'inscription est incomplet : ouvrez-le depuis l'e-mail reçu.");
        if (!this.client.isConfigured()) throw new AppError("Le paiement des enchères est momentanément indisponible.", 503);
        const { status, data } = await this.client.check(auctionId, token);
        if (status === 404) throw new NotFoundError("Ce lien d'inscription n'est pas valide : ouvrez-le depuis l'e-mail reçu.");
        if (status !== 200 || !data?.data) throw new AppError("Les informations de cette enchère sont momentanément indisponibles. Réessayez dans un instant.", 503);
        const claim = data.data;
        if (!claim.payable) throw new AppError(REFUSED[claim.reason] ?? "Cette invitation n'est plus valable.", 409);
        if (!claim.formationId) throw new AppError("Cette enchère n'est rattachée à aucune formation : contactez-nous.", 409);
        return claim;
    }

    async getContext(id, options = {}) {
        const c = await this.loadClaim(id, options.claim);
        return {
            type: this.getType(),
            itemId: Number(id),
            title: c.title,
            subtitle: c.rank === 1 ? "Enchère remportée" : "Une place vous revient",
            price: Number(c.amount),
            currency: c.currency,
            thumbnailUrl: null,
            beneficiary: { email: c.email, name: `${c.firstName} ${c.lastName}`.trim() },
            features: [
                c.rank === 1 ? "Votre offre gagnante, rien de plus" : "Au montant de votre dernière offre",
                "Accès individuel au campus Studies Learning",
                "Certificat de complétion inclus",
            ],
            deadline: c.expiresAt,
            auction: { rank: c.rank, formationId: c.formationId, expiresAt: c.expiresAt },
        };
    }

    async process(data, _user) {
        const auctionId = String(data?.itemId ?? "");
        const c = await this.loadClaim(auctionId, data?.claim);
        const { OrchestratorService } = await import("../orchestrator.service.js");
        const purchaseEngineUrl = process.env.PURCHASE_ENGINE_URL || "http://localhost:3005";
        const name = `${c.firstName} ${c.lastName}`.trim();
        const back = (page) => `${purchaseEngineUrl}/${page}?type=AUCTION_PAYMENT&id=${auctionId}`;

        const result = await OrchestratorService.initializePayment({
            // La personne invitée paie et est inscrite : l'e-mail vient de l'invitation, jamais du formulaire.
            customerEmail: c.email,
            customerName: name || c.email,
            lmsItemId: String(c.formationId),
            lmsItemType: "course",
            paymentMethod: data.paymentMethod || "card",
            countryCode: data.countryCode || null,
            idempotencyKey: typeof data.idempotencyKey === "string" ? data.idempotencyKey : undefined,
            currency: c.currency,
            amount: Number(c.amount),
            successUrl: back("success"),
            cancelUrl: back("cancel"),
            failedUrl: back("failed"),
            metadata: {
                source: "AUCTION",
                purchase_type: "AUCTION_PAYMENT",
                auction_id: Number(auctionId),
                claim_rank: c.rank,
                customer_email: c.email,
                beneficiary_email: c.email,
                customer_name: name,
                formation_id: c.formationId,
                formation_name: c.title,
                channel: "auction",
            },
        });
        if (!result.success) throw new AppError(result.error || "Erreur lors de l'initialisation du paiement.", 502);
        return {
            transactionId: result.orderReference,
            status: "PENDING",
            provider: result.provider,
            redirectUrl: result.redirectUrl,
            widgetParams: result.widgetParams,
            clientSecret: result.clientSecret,
            message: "Inscription après enchère : paiement initialisé.",
        };
    }
}
