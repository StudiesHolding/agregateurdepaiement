/**
 * Moteur de prix (ADR-0012, D4–D7) — l'argent ne tolère aucune approximation : chaque règle est vérifiée
 * au centime (ou au franc) près, y compris les arrondis et la répartition des remises fixes.
 */
import { describe, it, expect } from '@jest/globals';
import { quote, serializeQuote, toMinor, fromMinor, currencyExponent, PriceEngineError } from '../price-engine.js';

const course = (over = {}) => ({ kind: 'B2C_COURSE', ref: 'f-57', unitPrice: '15000', formationId: 57, ...over });

describe('unités mineures selon ISO 4217', () => {
  it('XOF sans décimale, EUR à deux, TND à trois', () => {
    expect(currencyExponent('xof')).toBe(0);
    expect(currencyExponent('EUR')).toBe(2);
    expect(currencyExponent('TND')).toBe(3);
    expect(toMinor('15000', 0)).toBe(15000n);
    expect(toMinor('49.9', 2)).toBe(4990n);
    expect(toMinor('0.005', 2)).toBe(1n);
    expect(fromMinor(4990n, 2)).toBe('49.90');
    expect(fromMinor(15000n, 0)).toBe('15000');
  });

  it('refuse montants négatifs, notation scientifique, texte et devises invalides', () => {
    for (const bad of ['-1', '1e3', 'abc', '']) expect(() => toMinor(bad, 2)).toThrow(PriceEngineError);
    expect(() => quote({ currency: 'EURO', lines: [course()] })).toThrow(/Devise invalide/);
    expect(() => quote({ currency: 'XOF', lines: [] })).toThrow(/Commande vide/);
    expect(() => quote({ currency: 'XOF', lines: [course({ quantity: 0 })] })).toThrow(/quantité/);
  });
});

describe('promotions, enchères et remises de volume', () => {
  it('promotion SL : 15 000 F − 20 % = 12 000 F', () => {
    const q = quote({ currency: 'XOF', lines: [course({ promotionPercent: 20 })] });
    expect(q.totalMinor).toBe(12000n);
    expect(q.discountMinor).toBe(3000n);
    expect(q.lines[0].adjustments).toEqual([{ type: 'promotion', amount: -3000n }]);
  });

  it('arrondi au demi supérieur sur le prix unitaire (EUR) : 19,99 € − 15 % = 16,99 €', () => {
    const q = quote({ currency: 'EUR', lines: [course({ unitPrice: '19.99', promotionPercent: 15 })] });
    expect(fromMinor(q.totalMinor, 2)).toBe('16.99');
  });

  it("l'enchère remplace le prix et ignore la promotion", () => {
    const q = quote({ currency: 'XOF', lines: [{ kind: 'AUCTION', ref: 'a-1', unitPrice: '50000', auctionPrice: '32500', promotionPercent: 50 }] });
    expect(q.totalMinor).toBe(32500n);
    expect(q.lines[0].adjustments).toEqual([{ type: 'auction', amount: -17500n }]);
  });

  it('licences B2B : remise de volume sur le prix unitaire, puis × quantité (total exact)', () => {
    const q = quote({ currency: 'EUR', lines: [{ kind: 'B2B_PACKAGE', ref: 'p-3', unitPrice: '33.33', quantity: 120, volumeDiscountPercent: 12.5 }] });
    // 33,33 × 0,875 = 29,16375 → 29,16 ; × 120 = 3 499,20
    expect(fromMinor(q.totalMinor, 2)).toBe('3499.20');
  });
});

describe('coupons (un seul par commande)', () => {
  it('pourcentage appliqué APRÈS la promotion', () => {
    const q = quote({ currency: 'XOF', lines: [course({ promotionPercent: 20 })], coupon: { code: 'RENTREE', type: 'percent', value: 10 } });
    expect(q.totalMinor).toBe(10800n); // 15 000 → 12 000 → 10 800
    expect(q.coupon).toMatchObject({ code: 'RENTREE', applied: true, amount: 1200n });
  });

  it('montant fixe réparti sans perte entre lignes (plus forts restes)', () => {
    const q = quote({
      currency: 'XOF',
      lines: [course({ ref: 'a', unitPrice: '10000' }), course({ ref: 'b', unitPrice: '10000' }), course({ ref: 'c', unitPrice: '10000' })],
      coupon: { code: 'MOINS1000', type: 'fixed', value: '1000', currency: 'XOF' },
    });
    const parts = q.lines.map((l) => -l.adjustments.find((a) => a.type === 'coupon').amount);
    expect(parts).toEqual([334n, 333n, 333n]);
    expect(q.totalMinor).toBe(29000n);
  });

  it('montant fixe plafonné au total : jamais de total négatif', () => {
    const q = quote({ currency: 'XOF', lines: [course({ unitPrice: '5000' })], coupon: { code: 'GROS', type: 'fixed', value: '20000', currency: 'XOF' } });
    expect(q.totalMinor).toBe(0n);
    expect(q.coupon.amount).toBe(5000n);
  });

  it("refus explicites : devise différente, minimum non atteint, hors périmètre, ligne d'enchère", () => {
    expect(quote({ currency: 'XOF', lines: [course()], coupon: { code: 'E', type: 'fixed', value: '5', currency: 'EUR' } }).coupon.reason).toBe('CURRENCY_MISMATCH');
    expect(quote({ currency: 'XOF', lines: [course()], coupon: { code: 'M', type: 'percent', value: 10, minAmount: '20000' } }).coupon.reason).toBe('MIN_AMOUNT_NOT_REACHED');
    expect(quote({ currency: 'XOF', lines: [course()], coupon: { code: 'S', type: 'percent', value: 10, scope: { type: 'formation', ids: [99] } } }).coupon.reason).toBe('NOT_ELIGIBLE');
    const auction = quote({ currency: 'XOF', lines: [{ kind: 'AUCTION', ref: 'a', unitPrice: '9000', auctionPrice: '8000' }], coupon: { code: 'X', type: 'free' } });
    expect(auction.coupon.reason).toBe('NOT_ELIGIBLE');
    expect(auction.totalMinor).toBe(8000n);
  });

  it('périmètre : seule la formation visée est remisée', () => {
    const q = quote({
      currency: 'XOF',
      lines: [course({ ref: 'a', formationId: 1 }), course({ ref: 'b', formationId: 2 })],
      coupon: { code: 'F1', type: 'free', scope: { type: 'formation', ids: [1] } },
    });
    expect(q.lines.map((l) => l.totalMinor)).toEqual([0n, 15000n]);
  });

  it("coupon exclusif : jamais cumulé, la meilleure option pour l'acheteur est retenue", () => {
    const lines = [course({ promotionPercent: 30 })];
    const better = quote({ currency: 'XOF', lines, coupon: { code: 'EXC50', type: 'percent', value: 50, exclusive: true } });
    expect(better.totalMinor).toBe(7500n); // 50 % du prix catalogue, sans la promotion
    expect(better.lines[0].adjustments.map((a) => a.type)).toEqual(['coupon']);
    const worse = quote({ currency: 'XOF', lines, coupon: { code: 'EXC10', type: 'percent', value: 10, exclusive: true } });
    expect(worse.totalMinor).toBe(10500n); // la promotion de 30 % reste plus avantageuse
    expect(worse.coupon).toMatchObject({ applied: false, reason: 'PROMOTION_IS_BETTER' });
  });
});

describe('devise de règlement (taux figé fourni par l’appelant)', () => {
  it('XOF → EUR au taux fixe 1 € = 655,957 F', () => {
    const q = quote({ currency: 'XOF', lines: [course({ unitPrice: '65596' })], settlement: { currency: 'EUR', rate: '0.001524490' } });
    expect(q.settlement).toMatchObject({ currency: 'EUR', totalMinor: 10000n }); // 100,00 €
  });

  it('EUR → XOF : arrondi au franc', () => {
    const q = quote({ currency: 'EUR', lines: [course({ unitPrice: '49.90' })], settlement: { currency: 'XOF', rate: '655.957' } });
    expect(q.settlement.totalMinor).toBe(32732n);
  });

  it('même devise : aucune conversion ; taux nul ou invalide refusé', () => {
    expect(quote({ currency: 'XOF', lines: [course()], settlement: { currency: 'XOF' } }).settlement.totalMinor).toBe(15000n);
    expect(() => quote({ currency: 'XOF', lines: [course()], settlement: { currency: 'EUR', rate: '0' } })).toThrow(/nul/);
    expect(() => quote({ currency: 'XOF', lines: [course()], settlement: { currency: 'EUR', rate: '-1' } })).toThrow(/invalide/);
  });
});

describe('déterminisme et sérialisation', () => {
  it('mêmes entrées, même devis ; JSON lisible sans BigInt', () => {
    const input = { currency: 'EUR', lines: [course({ unitPrice: '19.99', promotionPercent: 15 })], coupon: { code: 'C', type: 'fixed', value: '2', currency: 'EUR' } };
    expect(quote(input)).toEqual(quote(input));
    const json = serializeQuote(quote(input));
    expect(JSON.parse(JSON.stringify(json))).toMatchObject({ currency: 'EUR', subtotal: '19.99', total: '14.99', coupon: { applied: true, amount: '2.00' } });
  });
});
