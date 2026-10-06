import { PurchaseStrategy } from './purchase.strategy.js';
import { thematiqueQuoteService } from '../pricing/thematique-quote.service.js';
import { BadRequestError } from '../../utils/errors.js';

/**
 * Stratégie de paiement B2B : licences d'une thématique complète (ADR-0001, ADR-0004).
 *
 *   1. getContext()          → devis 1 licence (prix de base du type, devise) pour l'affichage
 *   2. getQuote()            → devis serveur pour N licences (affichage du total avant paiement)
 *      validateEligibility() → identifiant valide, thématique vendable
 *   3. initiatePayment()     → devis serveur (paliers de volume) → Orchestrateur → PSP
 *   4. getSagaRoutingType()  → "B2B_THEMATIQUE" → stratégie de saga B2BThematique (provisionnement)
 *
 * Le prix vient TOUJOURS de ThematiqueQuoteService ; rien de ce que le navigateur envoie
 * comme montant ou devise n'est utilisé.
 */
export class B2bThematiquePurchaseStrategy extends PurchaseStrategy {
  constructor(quoteService = thematiqueQuoteService) {
    super();
    this.quoteService = quoteService;
  }

  getType() {
    return 'B2B_THEMATIQUE';
  }

  getSagaRoutingType() {
    return 'B2B_THEMATIQUE';
  }

  async getContext(id) {
    const quote = await this.quoteService.quote(id, 1);
    return {
      type: this.getType(),
      itemId: quote.thematiqueId,
      title: quote.title,
      description: `Thématique ${quote.typeName} : accès de vos collaborateurs à l'ensemble des formations de la thématique.`,
      price: Number(quote.unitPrice),
      currency: quote.currency,
      pricing: { unit: 'licence', basePrice: quote.basePrice, volumeDiscounts: true },
      features: [
        'Accès à toute la thématique',
        'Gestion centralisée des licences',
        "Rapports d'activité collaborateurs",
        'Remise automatique selon le nombre de licences',
      ],
    };
  }

  async getQuote(id, seats) {
    return this.quoteService.quote(id, seats);
  }

  async validateEligibility(_user, id) {
    await this.quoteService.quote(id, 1);
    return true;
  }

  async initiatePayment(data) {
    if (!data?.adminEmail) {
      throw new BadRequestError("L'e-mail de l'administrateur de l'entreprise est requis.");
    }
    const quote = await this.quoteService.quote(data.itemId, data.totalLicenses);

    const { OrchestratorService } = await import('../../services/orchestrator.service.js');
    const purchaseEngineUrl = process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005';

    const result = await OrchestratorService.initializePayment({
      customerEmail: data.adminEmail,
      customerName: `${data.adminFirstName || ''} ${data.adminLastName || ''}`.trim() || data.companyName,
      lmsItemId: String(quote.thematiqueId),
      lmsItemType: 'thematique',
      paymentMethod: data.paymentMethod || 'card',
      countryCode: data.countryCode || 'CM',
      // Devis serveur : total et devise ne viennent jamais du navigateur.
      currency: quote.currency,
      amount: Number(quote.total),
      successUrl: `${purchaseEngineUrl}/success`,
      cancelUrl: `${purchaseEngineUrl}/cancel`,
      failedUrl: `${purchaseEngineUrl}/failed`,
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
        thematique_id: quote.thematiqueId,
        licence_count: quote.seats,
        total_licenses: quote.seats,
        unit_price: quote.unitPrice,
        base_price: quote.basePrice,
        discount_rate: quote.discountRate,
        discount_label: quote.discountLabel,
      },
    });

    if (!result.success) {
      throw new Error(result.error || "Erreur lors de l'initialisation du paiement B2B Thématique.");
    }

    return {
      transactionId: result.orderReference,
      status: 'PENDING',
      provider: result.provider,
      redirectUrl: result.redirectUrl,
      widgetParams: result.widgetParams,
      clientSecret: result.clientSecret,
      quote,
      message: 'Paiement des licences de thématique initialisé.',
    };
  }
}
