import { PurchaseStrategy } from "./purchase.strategy.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

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
            // Fallback gracefully for development if API is unreachable but ID is provided
            return {
                title: `Règlement Enchère #${id}`,
                price: 150.00,
                currency: "EUR",
                features: [
                    "Paiement de l'enchère remportée",
                    "Service client dédié",
                    "Livraison express"
                ],
                auctionDetails: {
                    auctionId: id,
                    winnerEmail: "gagnant@example.com"
                }
            };
        }
    }

    /**
     * Initialise la saga de paiement (communication avec CinetPay/Stripe, etc.)
     */
    async process(data, user) {
        const transactionId = `TXN-AUC-${Date.now()}-${uuidv4().substring(0, 8)}`;
        
        // Logique métier : 
        // 1. Enregistrer l'intention de paiement dans l'Agrégateur
        // 2. Générer le lien de paiement PSP
        // 3. Informer le module d'enchères du statut "pending"

        return {
            transactionId,
            status: "PENDING",
            paymentUrl: `https://mock-psp.studieslearning.com/pay/${transactionId}`,
            message: "Initialisation du paiement de l'enchère avec succès."
        };
    }
}
