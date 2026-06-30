import { PurchaseStrategy } from './purchase.strategy.js';
import { FormationPackage } from '../../models/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Stratégie de paiement pour l'achat d'un Package B2B (forfait entreprise).
 *
 * Flux métier complet :
 *   1. getContext()          → Récupère le package depuis la BDD (FormationPackage)
 *   2. validateEligibility() → Vérifie disponibilité et cohérence
 *   3. initiatePayment()     → Crée le payload pour l'Orchestrateur → PSP
 *   4. getSagaRoutingType()  → Retourne "B2B_PACKAGE" → déclenche B2BPackageStrategy (saga)
 *
 * Post-paiement (saga) : Création Company + CompanyAdmin + CompanyPackage + Email activation
 */
export class B2bPackagePurchaseStrategy extends PurchaseStrategy {
  constructor() {
    super();
  }

  getType() {
    return 'B2B_PACKAGE';
  }

  getSagaRoutingType() {
    return 'B2B_PACKAGE';
  }

  /**
   * Récupère les métadonnées du package pour l'affichage frontend (Purchase Engine).
   * Source de vérité : table `formation_packages` (FormationPackage model).
   */
  async getContext(id) {
    console.log(`[B2B_PACKAGE] Fetching context for package ID: ${id}`);

    try {
      const pkg = await FormationPackage.findByPk(id, {
        attributes: [
          'id', 'name', 'description', 'price', 'image_url',
          'currency', 'status', 'target_audience', 'formations',
          'max_licenses', 'benefits', 'total_duration',
        ],
      });

      if (!pkg) {
        throw new Error(`Package B2B #${id} introuvable en base de données.`);
      }

      if (pkg.status !== 'active' && pkg.status !== 'published') {
        throw new Error(`Package B2B #${id} n'est pas disponible à l'achat (status: ${pkg.status}).`);
      }

      // Parser benefits si c'est un JSON string
      let features = [];
      if (pkg.benefits) {
        try {
          features = typeof pkg.benefits === 'string' ? JSON.parse(pkg.benefits) : pkg.benefits;
        } catch {
          features = [pkg.benefits];
        }
      }
      if (!features.length) {
        features = [
          'Dashboard entreprise dédié',
          'Gestion centralisée des licences',
          'Rapports d\'activité collaborateurs',
          'Support prioritaire',
        ];
      }

      return {
        type: this.getType(),
        itemId: id,
        title: pkg.name,
        description: pkg.description || `Package entreprise — ${pkg.max_licenses || 'N'} licences`,
        price: parseFloat(pkg.price || 0),
        currency: pkg.currency || 'XAF',
        imageUrl: pkg.image_url || null,
        maxLicenses: pkg.max_licenses,
        totalDuration: pkg.total_duration,
        features,
      };
    } catch (error) {
      console.error(`[B2bPackagePurchaseStrategy] Erreur getContext (${id}):`, error.message);
      throw error; // Pas de fallback — on veut un vrai produit, pas de mock
    }
  }

  /**
   * Vérifie que le package est toujours disponible et achetable.
   */
  async validateEligibility(user, id) {
    console.log(`[B2B_PACKAGE] Validating eligibility for package ID: ${id}`);

    const pkg = await FormationPackage.findByPk(id, {
      attributes: ['id', 'status'],
    });

    if (!pkg) {
      throw new Error('Package introuvable.');
    }

    if (pkg.status !== 'active' && pkg.status !== 'published') {
      throw new Error('Ce package n\'est plus disponible à la vente.');
    }

    return true;
  }

  /**
   * Prépare la transaction et délègue à l'OrchestratorService pour créer
   * l'Order + PaymentIntent + appel PSP (CinetPay/Stripe).
   */
  async initiatePayment(data) {
    console.log('[B2B_PACKAGE] Initiating payment with data:', {
      companyName: data.companyName,
      adminEmail: data.adminEmail,
      itemId: data.itemId,
    });

    const { OrchestratorService } = await import('../../services/orchestrator.service.js');

    const pkg = await FormationPackage.findByPk(data.itemId, {
      attributes: ['id', 'name', 'price', 'currency', 'max_licenses'],
    });

    if (!pkg) {
      throw new Error('Package introuvable lors de l\'initialisation du paiement.');
    }

    const licenseCount = parseInt(data.totalLicenses) || pkg.max_licenses || 10;
    const totalAmount = parseFloat(pkg.price) * 1; // Prix fixe par package (pas par licence)

    const result = await OrchestratorService.initializePayment({
      customerEmail: data.adminEmail,
      customerName: `${data.adminFirstName || ''} ${data.adminLastName || ''}`.trim(),
      lmsItemId: String(pkg.id),
      lmsItemType: 'package',
      paymentMethod: data.paymentMethod || 'card',
      countryCode: data.countryCode || 'CM',
      currency: pkg.currency || 'XAF',
      amount: totalAmount,
      successUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/success`,
      cancelUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/cancel`,
      failedUrl: `${process.env.PURCHASE_ENGINE_URL || 'http://localhost:3005'}/failed`,
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
        package_id: pkg.id,
        package_name: pkg.name,
        licence_count: licenseCount,
        total_licenses: licenseCount,
      },
    });

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'initialisation du paiement B2B.');
    }

    return {
      transactionId: result.orderReference,
      status: 'PENDING',
      provider: result.provider,
      redirectUrl: result.redirectUrl,
      widgetParams: result.widgetParams,
      clientSecret: result.clientSecret,
      message: 'Paiement B2B Package initialisé avec succès.',
    };
  }
}
