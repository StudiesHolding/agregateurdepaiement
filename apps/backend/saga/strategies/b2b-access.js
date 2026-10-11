/**
 * Règles d'accès B2B communes aux stratégies de saga « package » et « thématique » (S1-8).
 *
 * - Validité d'un accès : B2B_ACCESS_VALIDITY_MONTHS mois (entier > 0, défaut 12) après l'achat.
 *   À migrer vers le service de réglages plateforme (ADR-0008).
 * - Un administrateur d'entreprise déjà actif n'est jamais désactivé par un nouvel achat.
 */
export const DEFAULT_B2B_ACCESS_VALIDITY_MONTHS = 12;

/** Durée de validité (mois) d'un accès B2B. */
export function getB2BAccessValidityMonths(env = process.env) {
  const raw = Number(env.B2B_ACCESS_VALIDITY_MONTHS);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_B2B_ACCESS_VALIDITY_MONTHS;
}

/** Date d'expiration : `from` + `months` mois. */
export function computeB2BAccessExpiryDate(from = new Date(), months = getB2BAccessValidityMonths()) {
  const expiry = new Date(from.getTime());
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
}

/**
 * Date d'expiration d'une réserve existante après un nouvel achat :
 * - réserve active dont l'échéance est future → échéance inchangée (les licences ajoutées expirent avec elle) ;
 * - réserve expirée, sans échéance ou non active → `now` + durée.
 */
export function resolvePoolExpiryDate(pool, now, months) {
  if (pool && pool.status === 'active' && pool.expiry_date) {
    const current = new Date(pool.expiry_date);
    if (!Number.isNaN(current.getTime()) && current.getTime() > now.getTime()) {
      return current;
    }
  }
  return computeB2BAccessExpiryDate(now, months);
}

/** `is_active` vrai (booléen Sequelize, ou 1 / '1' selon le dialecte). */
export function isAdminActive(admin) {
  return admin.is_active === true || admin.is_active === 1 || admin.is_active === '1';
}
