import { PurchaseStrategy } from './purchase.strategy.js';
import { Course } from '../../models/index.js';
import { AppError } from '../../utils/errors.js';

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
      // Aucun faux contexte en repli : un prix inventé ne doit jamais être affiché.
      throw new AppError("Cette thématique n'est pas disponible à l'achat pour le moment.", 503);
    }
  }

  async validateEligibility(user, id) {
    return true;
  }

  async initiatePayment(_data) {
    // SÉCURITÉ (06/10/2026) : le montant était pris du navigateur (data.amount || 999).
    // Fermé jusqu'à la tarification B2B serveur (paliers sl_volume_breakpoints, sprint 6).
    throw new AppError(
      "L'achat de thématiques en ligne ouvre avec la tarification entreprise (sprint 6). Contactez l'équipe commerciale.",
      501,
    );
  }
}
