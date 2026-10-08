/**
 * Taux de change lus sur le backend métier : fractions exactes, majoration, refus des réponses incohérentes et des
 * devises inconnues, cache et dernier jeu connu en cas de panne passagère.
 */
import { jest } from "@jest/globals";
import { clearFxCache, FxRatesUnavailableError, parseSnapshot, resolveFxRates, settlementRate } from "../fx-rates.js";
import { quote } from "../price-engine.js";

const RAW = {
  pivot: "XOF",
  asOf: "2026-09-21",
  source: "Grille tarifaire",
  markup: { percent: "0.5", applyToBaseCurrency: true },
  currencies: [
    { code: "XOF", exponent: 0, fixed: true, ratio: { num: "1", den: "1" } },
    { code: "XAF", exponent: 0, fixed: true, ratio: { num: "1", den: "1" } },
    { code: "EUR", exponent: 2, fixed: true, ratio: { num: "1000", den: "655957" } },
    { code: "USD", exponent: 2, fixed: false, ratio: { num: "1749", den: "1000000" } },
    { code: "NGN", exponent: 2, fixed: false, ratio: { num: "291471", den: "125000" } },
  ],
};
const snapshot = parseSnapshot(RAW);

describe("fx-rates — taux de règlement", () => {
  it("parités exactes : 1 EUR = 655,957 XOF et réciproquement, sans arrondi", () => {
    expect(settlementRate(snapshot, "EUR", "XOF")).toMatchObject({ num: 655957n, den: 1000n, markupApplied: false });
    expect(settlementRate(snapshot, "XOF", "EUR")).toMatchObject({ num: 1000n, den: 655957n });
    expect(settlementRate(snapshot, "XOF", "XAF")).toMatchObject({ num: 1n, den: 1n });
  });

  it("le moteur règle 150 000 FCFA en euros avec la majoration : 229,82 € (un seul arrondi)", () => {
    const rate = settlementRate(snapshot, "XOF", "EUR", { withMarkup: true });
    const q = quote({ currency: "XOF", lines: [{ kind: "B2C_COURSE", ref: "1", unitPrice: "150000" }], settlement: { currency: "EUR", rate } });
    // 150 000 ÷ 655,957 × 1,005 = 229,8169 → 229,82 € (un seul arrondi, comme le backend).
    expect(q.settlement).toMatchObject({ currency: "EUR", totalMinor: 22982n });
    const usd = quote({ currency: "XOF", lines: [{ kind: "B2C_COURSE", ref: "1", unitPrice: "150000" }], settlement: { currency: "USD", rate: settlementRate(snapshot, "XOF", "USD", { withMarkup: true }) } });
    expect(usd.settlement.totalMinor).toBe(26366n); // grille : 263,66175 $
  });

  it("même devise : majoration seulement si le réglage le prévoit (comme la grille)", () => {
    const rate = settlementRate(snapshot, "XOF", "XOF", { withMarkup: true });
    expect(rate).toMatchObject({ num: 201n, den: 200n, markupApplied: true });
    const q = quote({ currency: "XOF", lines: [{ kind: "B2C_COURSE", ref: "1", unitPrice: "150000" }], settlement: { currency: "XOF", rate } });
    expect(q.settlement.totalMinor).toBe(150750n); // ligne exemple de la grille
    const noBase = parseSnapshot({ ...RAW, markup: { percent: "0.5", applyToBaseCurrency: false } });
    expect(settlementRate(noBase, "XOF", "XOF", { withMarkup: true })).toMatchObject({ num: 1n, den: 1n, markupApplied: false });
  });

  it("devise inconnue refusée (409), jamais de 1:1 implicite", () => {
    expect(() => settlementRate(snapshot, "JPY", "XOF")).toThrow(/non prise en charge/);
  });

  it("réponse incohérente refusée : pivot, fraction, exposant, majoration", () => {
    expect(() => parseSnapshot({ ...RAW, pivot: "EUR" })).toThrow(FxRatesUnavailableError);
    expect(() => parseSnapshot({ ...RAW, currencies: [{ code: "XOF", exponent: 0, ratio: { num: "0", den: "1" } }] })).toThrow(FxRatesUnavailableError);
    expect(() => parseSnapshot({ ...RAW, currencies: [...RAW.currencies, { code: "EUR", exponent: 9, ratio: { num: "1", den: "1" } }] })).toThrow(FxRatesUnavailableError);
    expect(() => parseSnapshot({ ...RAW, markup: { percent: "abc" } })).toThrow(FxRatesUnavailableError);
  });
});

describe("fx-rates — résolution", () => {
  beforeEach(() => clearFxCache());

  it("jamais lus + backend injoignable → 503", async () => {
    await expect(resolveFxRates({ fetchSnapshot: async () => { throw new Error("ECONNREFUSED"); } })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("cache 60 s, puis dernier jeu connu si le backend tombe", async () => {
    const fetchSnapshot = jest.fn(async () => snapshot);
    let t = 1_000_000;
    await resolveFxRates({ fetchSnapshot, now: () => t });
    t += 30_000;
    await resolveFxRates({ fetchSnapshot, now: () => t });
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    t += 61_000;
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await resolveFxRates({ fetchSnapshot: async () => { throw new Error("down"); }, now: () => t });
    expect(result).toBe(snapshot);
    spy.mockRestore();
  });
});
