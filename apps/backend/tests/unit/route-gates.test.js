import { describe, it, expect } from '@jest/globals';
import { isAdminTestRoutesEnabled } from '../../utils/route-gates.js';

describe('isAdminTestRoutesEnabled — routes de simulation de paiement', () => {
  it('jamais en production, même activées explicitement', () => {
    expect(isAdminTestRoutesEnabled({ NODE_ENV: 'production', ADMIN_TEST_ROUTES_ENABLED: 'true' })).toBe(false);
  });
  it('désactivées par défaut en développement', () => {
    expect(isAdminTestRoutesEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isAdminTestRoutesEnabled({})).toBe(false);
  });
  it('activables explicitement hors production', () => {
    expect(isAdminTestRoutesEnabled({ NODE_ENV: 'development', ADMIN_TEST_ROUTES_ENABLED: 'true' })).toBe(true);
  });
  it('toujours actives pour les tests automatisés', () => {
    expect(isAdminTestRoutesEnabled({ NODE_ENV: 'test' })).toBe(true);
  });
});
