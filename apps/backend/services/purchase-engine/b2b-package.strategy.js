import { PurchaseStrategy } from './purchase.strategy.js';
// import { logger } from '../../utils/logger.js';
// Importer les modèles nécessaires (ex: Package B2B) depuis Sequelize
// import { CoursePackage } from '../../models/index.js';

export class B2bPackagePurchaseStrategy extends PurchaseStrategy {
    constructor() {
        super();
    }

    getType() {
        return "B2B_PACKAGE";
    }

    getSagaRoutingType() {
        return "B2B_PACKAGE";
    }

    async validateEligibility(user, id) {
        return true;
    }

    async initiatePayment(data) {
        return this.process(data, null);
    }

    /**
     * @override
     */
    async getContext(id) {
    logger.info(`[B2B_PACKAGE] Fetching context for package ID: ${id}`);
    
    // TODO: Requête BDD pour récupérer les infos du package.
    // Ex: const pkg = await CoursePackage.findByPk(id);
    
    // Mock pour l'UI Frontend
    return {
      type: this.getType(),
      itemId: id,
      title: "Package Entreprise - 10 Licences",
      description: "Formation complète pour vos collaborateurs, accès 1 an.",
      price: 499.00,
      currency: "EUR",
      features: [
        "Dashboard entreprise",
        "Gestion des licences",
        "Rapports d'activité"
      ]
    };
  }

  async validateEligibility(user, id) {
    logger.info(`[B2B_PACKAGE] Validating eligibility for package ID: ${id}`);
    // Vérifier par exemple si l'entreprise n'a pas déjà un abonnement actif
    // pour ce package spécifique.
    return true;
  }

  async initiatePayment(data) {
    logger.info(`[B2B_PACKAGE] Initiating payment`);
    // Préparer le payload pour CinetPay / Stripe
    // Appeler le QaPaymentInitService ou équivalent
    return {
      orderRef: `B2B-PKG-${Date.now()}`,
      amount: 499.00,
      paymentUrl: "https://checkout.stripe.com/..." // URL retournée par le PSP
    };
  }

  getSagaRoutingType() {
    return 'B2B_PACKAGE';
  }
}
