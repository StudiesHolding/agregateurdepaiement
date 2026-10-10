import { PurchaseStrategy } from './purchase.strategy.js';
import { FormationPackage } from '../../models/index.js';
import { packageQuoteService } from '../pricing/package-quote.service.js';
import { BadRequestError } from '../../utils/errors.js';

const DEFAULT_FEATURES = [
  'Dashboard entreprise dédié',
  'Gestion centralisée des licences',
  "Rapports d'activité collaborateurs",
  'Remise automatique selon le nombre de licences',
];

/**
 * Stratégie de paiement B2B : licences d'un package de formations (ADR-0004).
 *
 *   1. getContext()          → fiche du package + devis 1 licence (prix d'une licence, devise)
 *   2. getQuote()            → devis serveur pour N licences (paliers de volume)
 *   3. validateEligibility() → package vendable
 *   4. initiatePayment()     → devis serveur → Orchestrateur → PSP
 *   5. getSagaRoutingType()  → "B2B_PACKAGE" → saga B2BPackage (Company + CompanyPackage + activation)
 *
 * Le package se vend à la licence ; le prix vient TOUJOURS de PackageQuoteService et rien de ce que
 * le navigateur envoie comme montant ou devise n'est utilisé.
 */
export class B2bPackagePurchaseStrategy extends PurchaseStrategy {
  constructor(quoteService = packageQuoteService, packageModel = FormationPackage) {
    super();
    this.quoteService = quoteService;
    this.packageModel = packageModel;
  }

  getType() {
    return 'B2B_PACKAGE';
  }

  getSagaRoutingType() {
    return 'B2B_PACKAGE';
  }

  async getContext(id) {
    const quote = await this.quoteService.quote(id, 1);
    const pkg = await this.packageModel.findByPk(quote.packageId, {
      attributes: ['description', 'image_url', 'benefits', 'total_duration'],
    });

    return {
      type: this.getType(),
      itemId: quote.packageId,
      title: quote.name,
      description: pkg?.description || "Package entreprise : accès de vos collaborateurs aux formations du package.",
      price: Number(quote.unitPrice),
      currency: quote.currency,
      imageUrl: pkg?.image_url || null,
      totalDuration: pkg?.total_duration || null,
      pricing: { unit: 'licence', basePrice: quote.basePrice, volumeDiscounts: true },
      features: parseFeatures(pkg?.benefits),
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
      lmsItemId: String(quote.packageId),
      lmsItemType: 'package',
      paymentMethod: data.paymentMethod || 'card',
      countryCode: data.countryCode || null,
      // Devis serveur : total et devise ne viennent jamais du navigateur.
      currency: quote.currency,
      amount: Number(quote.total),
      successUrl: `${purchaseEngineUrl}/success`,
      cancelUrl: `${purchaseEngineUrl}/cancel`,
      failedUrl: `${purchaseEngineUrl}/failed`,
      metadata: {
        source: 'purchase_engine',
        purchase_type: 'B2B_PACKAGE',
        b2b_purchase: true,
        is_b2b: true,
        company_name: data.companyName,
        vat_number: data.vatNumber || null,
        company_admin_email: data.adminEmail,
        admin_first_name: data.adminFirstName,
        admin_last_name: data.adminLastName,
        package_id: quote.packageId,
        package_name: quote.name,
        licence_count: quote.seats,
        total_licenses: quote.seats,
        unit_price: quote.unitPrice,
        base_price: quote.basePrice,
        discount_rate: quote.discountRate,
        discount_label: quote.discountLabel,
      },
    });

    if (!result.success) {
      throw new Error(result.error || "Erreur lors de l'initialisation du paiement B2B.");
    }

    return {
      transactionId: result.orderReference,
      status: 'PENDING',
      provider: result.provider,
      redirectUrl: result.redirectUrl,
      widgetParams: result.widgetParams,
      clientSecret: result.clientSecret,
      quote,
      message: 'Paiement des licences du package initialisé.',
    };
  }
}

/** `benefits` : tableau JSON, texte libre ou vide → liste d'atouts affichable. */
function parseFeatures(benefits) {
  if (!benefits) return DEFAULT_FEATURES;
  if (Array.isArray(benefits)) return benefits.length ? benefits : DEFAULT_FEATURES;
  try {
    const parsed = JSON.parse(benefits);
    if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
  } catch {
    // texte libre
  }
  return [String(benefits)];
}
