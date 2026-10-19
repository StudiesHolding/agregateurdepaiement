/**
 * Activation des routes sensibles selon l'environnement.
 *
 * Routes de test admin (/api/admin/test) : création d’inscriptions et SIMULATION de
 * paiements et de webhooks. Une inscription « payée » par simulation déclenche
 * l'inscription ET le crédit de commission : ces routes ne doivent jamais exister
 * en production. Ailleurs : actives seulement si ADMIN_TEST_ROUTES_ENABLED=true,
 * et toujours sous NODE_ENV=test (tests automatisés).
 */
export function isAdminTestRoutesEnabled(env) {
  if (env.NODE_ENV === "production") return false;
  return env.NODE_ENV === "test" || env.ADMIN_TEST_ROUTES_ENABLED === "true";
}
