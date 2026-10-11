import { PurchaseStrategy } from "./purchase.strategy.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../../utils/errors.js";

/**
 * Stratégie de paiement pour le règlement d'une enchère remportée (Auctions).
 */
export class AuctionPaymentStrategy extends PurchaseStrategy {
    constructor() {
        super();
        this.auctionsApiUrl = process.env.AUCTIONS_API_URL || "http://localhost:4002/api";
    }

    getType() {
        return "AUCTION_PAYMENT";
    }

    getSagaRoutingType() {
        return "AUCTION_PAYMENT";
    }

    async validateEligibility(user, id) {
        return true;
    }

    async initiatePayment(data) {
        return this.process(data, null);
    }

    /**
     * Récupère le contexte depuis le module Auctions (lot, enchère gagnante).
     */
    async getContext(id) {
        try {
            // id correspond à l'ID de l'enchère (auctionId)
            // L'API Enchères devrait nous retourner l'état de l'enchère et le gagnant.
            const response = await axios.get(`${this.auctionsApiUrl}/auctions/${id}`);
            const auction = response.data.data;

            if (!auction || (auction.status !== "ended" && auction.status !== "sold")) {
                throw new Error("L'enchère n'est pas terminée ou est introuvable.");
            }

            const winningBid = auction.winningBid;
            if (!winningBid) {
                throw new Error("Aucune offre gagnante trouvée pour cette enchère.");
            }

            return {
                title: `Règlement Enchère: ${auction.itemTitle}`,
                price: parseFloat(winningBid.amount),
                currency: auction.currency || "EUR",
                features: [
                    "Paiement sécurisé du lot remporté",
                    `Offre gagnante de ${winningBid.amount} ${auction.currency || "EUR"}`,
                    "Préparation pour expédition immédiate"
                ],
                auctionDetails: {
                    auctionId: auction.id,
                    winnerEmail: winningBid.bidderEmail,
                    itemTitle: auction.itemTitle
                }
            };
        } catch (error) {
            console.error(`[AuctionPaymentStrategy] Erreur getContext (${id}):`, error.message);
            // Aucun faux contexte en repli (auparavant 150 EUR et un gagnant fictif).
            throw new AppError("Les informations de cette enchère sont momentanément indisponibles.", 503);
        }
    }

    async process(_data, _user) {
        // Le paiement d'enchère via la passerelle n'était qu'une simulation (URL de PSP fictive).
        // Il sera implémenté de bout en bout au sprint 13 (enchères temps réel v2).
        throw new AppError("Le paiement des enchères via la passerelle ouvre au sprint 13.", 501);
    }
}
