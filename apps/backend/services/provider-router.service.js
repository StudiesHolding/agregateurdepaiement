import { ProviderRoute } from "../models/provider-route.model.js";
import { PaymentProvider } from "../models/payment-provider.model.js";
import { decide, normalizeRequest } from "./routing/routing-engine.js";

/**
 * Routage des paiements (ADR-0019, D2) : toutes les décisions viennent des règles configurées dans l'administration
 * (« Règles de priorité »). Plus aucune table de pays ni prestataire par défaut dans le code ; jamais de repli vers
 * une autre devise. Le moteur pur est dans `routing/routing-engine.js`.
 */
export class ProviderRouterService {
    /** Toutes les règles avec leur prestataire (table courte : lue entière, décision en mémoire). */
    static async loadRules() {
        return ProviderRoute.findAll({ include: [{ model: PaymentProvider, as: "provider" }], order: [["priority", "ASC"], ["id", "ASC"]] });
    }

    /**
     * Règles retenues, dans l'ordre d'essai, pour un pays, une devise, un montant et un moyen.
     * @returns {Promise<ProviderRoute[]>}
     */
    static async findAvailableRoutes(countryCode, currency, amount, paymentMethod = "card") {
        const request = normalizeRequest({ countryCode, currency, amount, paymentMethod });
        const { candidates } = decide(await this.loadRules(), request);
        return candidates.map((c) => c.rule);
    }

    /** Décision complète et expliquée (simulateur, diagnostic d'un échec). */
    static async explain(input) {
        const request = normalizeRequest(input);
        const { candidates, trace } = decide(await this.loadRules(), request);
        return { request, candidates, trace };
    }

    /**
     * Conservé pour compatibilité : le moteur ne retient déjà que les prestataires qui proposent le moyen demandé.
     * @param {ProviderRoute[]} routes
     * @param {string} paymentMethod card | mobile_money
     */
    static filterByPaymentMethod(routes, paymentMethod) {
        const field = paymentMethod === "card" ? "supportCard" : "supportMobileMoney";
        return routes.filter((route) => route.provider?.[field] === true);
    }

    static async createRoute(data) {
        return ProviderRoute.create(data);
    }
}
