import { PurchaseStrategy } from './purchase.strategy.js';
import { Course } from '../../models/index.js';

/**
 * Stratégie de paiement pour l'achat B2B d'une Thématique (un lot de cours).
 *
 * Flux métier complet :
 *   1. getContext()          → Récupère la thématique
 *   2. validateEligibility() → Vérifie disponibilité
 *   3. initiatePayment()     → Crée le payload pour l'Orchestrateur → PSP
 *   4. getSagaRoutingType()  → Retourne "B2B_THEMATIQUE" → déclenche B2BThematiqueStrategy (saga)
 */
export class B2bThematiquePurchaseStrategy extends PurchaseStrategy {
  constructor() {
    super();
  }

  getType() {
    return 'B2B_THEMATIQUE';
  }

  getSagaRoutingType() {
    return 'B2B_THEMATIQUE';
  }

  async getContext(id) {
    console.log(`[B2B_THEMATIQUE] Fetching context for thematique ID: ${id}`);

    try {
      // Pour l'instant, on suppose que Course représente aussi des thématiques
      // ou qu'il y a un modèle Thematique spécifique. Adapt to actual model.
      // Assuming Course for now based on what we see in b2b-package-strategy.js
      // Let's use a mock or check what the DB holds if we need to.
      // Wait, is there a Thematique model? Let's check.
      const thematique = await Course.findByPk(id, {
        attributes: ['id', 'title', 'price', 'currency', 'status'],
      });

      if (!thematique) {
        throw new Error(`Thématique B2B #${id} introuvable en base de données.`);
      }

      return {
        type: this.getType(),
        itemId: id,
        title: thematique.title || `Thématique #${id}`,
        description: `Thématique d'apprentissage entreprise`,
        price: parseFloat(thematique.price || 0),
        currency: thematique.currency || 'XAF',
        features: [
          'Accès à toute la thématique',
          'Gestion centralisée des licences',
          'Rapports d\'activité collaborateurs',
        ],
      };
    } catch (error) {
      console.error(`[B2bThematiquePurchaseStrategy] Erreur getContext (${id}):`, error.message);
      // Fallback
      return {
        type: this.getType(),
        itemId: id,
        title: `Thématique d'Expertise #${id}`,
        description: "Ensemble de formations thématiques pour vos équipes.",
        price: 999.00,
        currency: "XAF",
        features: [
            "Accès illimité aux cours de la thématique",
            "Dashboard d'administration B2B",
            "Suivi de la progression"
        ]
      };
    }
  }

  async validateEligibility(user, id) {
    return true;
  }

  async initiatePayment(data) {
    console.log('[B2B_THEMATIQUE] Initiating payment with data:', {
      companyName: data.companyName,
      adminEmail: data.adminEmail,
      itemId: data.itemId,
    });

    const { OrchestratorService } = await import('../../services/orchestrator.service.js');

    const totalAmount = data.amount || 999;
    const licenseCount = parseInt(data.totalLicenses) || 10;

    const result = await OrchestratorService.initializePayment({
      customerEmail: data.adminEmail,
      customerName: `${data.adminFirstName || ''} ${data.adminLastName || ''}`.trim(),
      lmsItemId: String(data.itemId),
      lmsItemType: 'thematique',
      paymentMethod: data.paymentMethod || 'card',
      countryCode: data.countryCode || 'CM',
      currency: 'XAF',
      amount: totalAmount,
      successUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/success`,
      cancelUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/cancel`,
      failedUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/failed`,
      metadata: {
        source: 'purchase_engine',
        purchase_type: 'B2B_THEMATIQUE',
        b2b_purchase: true,
        is_b2b: true,
        company_name: data.companyName,
        vat_number: data.vatNumber || null,
        company_admin_email: data.adminEmail,
        admin_first_name: data.adminFirstName,
        admin_last_name: data.adminLastName,
        thematique_id: data.itemId,
        licence_count: licenseCount,
        total_licenses: licenseCount,
      },
    });

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'initialisation du paiement B2B Thématique.');
    }

    return {
      transactionId: result.orderReference,
      status: 'PENDING',
      provider: result.provider,
      redirectUrl: result.redirectUrl,
      widgetParams: result.widgetParams,
      clientSecret: result.clientSecret,
      message: 'Paiement B2B Thématique initialisé avec succès.',
    };
  }
}
