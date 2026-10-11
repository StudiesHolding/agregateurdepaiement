/**
 * Règles de taxe (ADR-0012, D16) : TVA B2B mondiale lue sur le réglage plateforme, règles du pays en priorité,
 * et jamais de devis B2B avec une taxe inconnue.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { selectCountryRules, resolveTaxRules, clearTaxRuleCache, TaxRulesUnavailableError } from '../tax-rules.js';

const global = [{ country: null, ratePercent: '19.25', inclusive: false, scope: 'b2b', label: 'TVA B2B' }];
const fr = { countryCode: 'FR', ratePercent: '20.000', inclusive: 1, scope: 'b2c', label: 'TVA France', validFrom: '2026-01-01', validTo: null, isActive: 1 };
const model = (rows) => ({ findAll: async () => rows });

beforeEach(() => clearTaxRuleCache());

describe('selectCountryRules', () => {
  it('règle du pays en vigueur, une par portée, la plus récente', () => {
    const next = { ...fr, ratePercent: '21.000', validFrom: '2027-01-01' };
    expect(selectCountryRules([fr, next], 'fr', new Date('2026-10-08'))).toEqual([{ country: 'FR', ratePercent: '20.000', inclusive: true, scope: 'b2c', label: 'TVA France' }]);
    expect(selectCountryRules([fr, next], 'FR', new Date('2027-02-01'))[0].ratePercent).toBe('21.000');
  });

  it('rien : pays sans règle, règle inactive ou échue, code invalide', () => {
    expect(selectCountryRules([fr], 'SN')).toEqual([]);
    expect(selectCountryRules([{ ...fr, isActive: 0 }], 'FR')).toEqual([]);
    expect(selectCountryRules([{ ...fr, validTo: '2026-06-01' }], 'FR', new Date('2026-10-08'))).toEqual([]);
    expect(selectCountryRules([fr], 'FRA')).toEqual([]);
  });
});

describe('resolveTaxRules', () => {
  it('Cameroun, Sénégal, France… : la TVA B2B mondiale s’applique partout, après les règles du pays', async () => {
    expect(await resolveTaxRules('CM', new Date(), { fetchGlobal: async () => global, TaxRule: model([]) })).toEqual(global);
    clearTaxRuleCache();
    const rules = await resolveTaxRules('FR', new Date('2026-10-08'), { fetchGlobal: async () => global, TaxRule: model([fr]) });
    expect(rules.map((r) => r.scope)).toEqual(['b2c', 'b2b']);
  });

  it('TVA B2B jamais lue : refus explicite (503) plutôt qu’un devis faux', async () => {
    await expect(resolveTaxRules(null, new Date(), { fetchGlobal: async () => { throw new Error('ECONNREFUSED'); } })).rejects.toBeInstanceOf(TaxRulesUnavailableError);
  });

  it('panne passagère : le dernier taux connu reste utilisé', async () => {
    await resolveTaxRules(null, new Date(), { fetchGlobal: async () => global });
    // cache encore valide : aucune lecture
    expect(await resolveTaxRules(null, new Date(), { fetchGlobal: async () => { throw new Error('down'); } })).toEqual(global);
  });
});
