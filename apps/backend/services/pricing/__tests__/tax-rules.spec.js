/**
 * Règle de taxe du pays de l'acheteur (ADR-0012, D16) : la bonne période, la plus récente, jamais de règle inactive.
 */
import { describe, it, expect } from '@jest/globals';
import { selectTaxRule } from '../tax-rules.js';

const cm = { countryCode: 'CM', ratePercent: '19.250', inclusive: 0, scope: 'b2b', label: 'TVA Cameroun', validFrom: '2026-01-01', validTo: null, isActive: 1 };

describe('selectTaxRule', () => {
  it('Cameroun : 19,25 % portée B2B, au format du moteur de prix', () => {
    expect(selectTaxRule([cm], 'cm', new Date('2026-10-08'))).toEqual({ country: 'CM', ratePercent: '19.250', inclusive: false, scope: 'b2b', label: 'TVA Cameroun' });
  });

  it('période : la règle future ne s’applique pas encore, la plus récente en vigueur l’emporte', () => {
    const next = { ...cm, ratePercent: '20.000', validFrom: '2027-01-01' };
    expect(selectTaxRule([cm, next], 'CM', new Date('2026-12-31')).ratePercent).toBe('19.250');
    expect(selectTaxRule([cm, next], 'CM', new Date('2027-01-02')).ratePercent).toBe('20.000');
  });

  it('aucune règle : pays sans règle, règle inactive ou échue, code pays invalide', () => {
    expect(selectTaxRule([cm], 'SN')).toBeNull();
    expect(selectTaxRule([{ ...cm, isActive: 0 }], 'CM')).toBeNull();
    expect(selectTaxRule([{ ...cm, validTo: '2026-06-01' }], 'CM', new Date('2026-10-08'))).toBeNull();
    expect(selectTaxRule([cm], 'CMR')).toBeNull();
  });
});
