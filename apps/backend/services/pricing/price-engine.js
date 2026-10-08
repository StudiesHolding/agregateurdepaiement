/**
 * Moteur de prix — ADR-0012 (Studies-learning/docs/04-adr/0012-commerce-inscriptions-avis.md), décisions D4–D7.
 *
 * Fonction PURE et déterministe : mêmes entrées → même devis, au centime près. Aucun accès base de données,
 * aucune horloge, aucun flottant : tous les montants sont des entiers en unités mineures (BigInt) selon
 * l'exposant ISO 4217 de la devise (XOF/XAF : 0 décimale, EUR/USD : 2).
 *
 * Ordre d'application par ligne : prix catalogue → promotion SL → prix d'enchère (remplace tout) → remise de
 * volume (B2B) → coupon (un seul par commande) → taxe du pays de l'acheteur (D16) ; puis conversion éventuelle
 * vers la devise de règlement au taux fourni (figé dans la commande par l'appelant).
 *
 * Taxe : la règle (taux, prix TTC ou HT, autoliquidation B2B) est résolue par l'appelant depuis la table des
 * règles par pays ; le moteur la calcule ligne à ligne et la trace (base, taux, montant).
 *
 * Règles de cumul (D7) : une ligne d'enchère n'accepte aucune remise ; un coupon s'applique au prix promotionnel,
 * sauf coupon « exclusif » : on retient alors, pour la commande, la meilleure option entre promotions seules et
 * coupon seul (jamais les deux), au bénéfice de l'acheteur.
 */

export const ENGINE_VERSION = "price-engine/2";

/** Exposants ISO 4217 différents de 2 (les autres devises ont 2 décimales). */
const EXPONENTS = { XOF: 0, XAF: 0, GNF: 0, KMF: 0, RWF: 0, UGX: 0, JPY: 0, KRW: 0, VND: 0, CLP: 0, BIF: 0, DJF: 0, BHD: 3, KWD: 3, OMR: 3, TND: 3, JOD: 3, LYD: 3 };

const LINE_KINDS = new Set(["B2C_COURSE", "AUCTION", "B2B_PACKAGE", "B2B_THEMATIQUE"]);
const B2B_KINDS = new Set(["B2B_PACKAGE", "B2B_THEMATIQUE"]);
const BPS = 10000n;

export class PriceEngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PriceEngineError";
    this.code = code;
  }
}

/** Exposant de la devise (ISO 4217) ; refuse tout code invalide. */
export function currencyExponent(currency) {
  const code = normalizeCurrencyCode(currency);
  return EXPONENTS[code] ?? 2;
}

function normalizeCurrencyCode(raw) {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new PriceEngineError("INVALID_CURRENCY", `Devise invalide : « ${raw} ».`);
  return code;
}

/**
 * Décimal positif ("15000", "49.9", 12) → unités mineures, arrondi au demi supérieur.
 * Refuse les négatifs, les notations scientifiques et le texte.
 */
export function toMinor(value, exponent, field = "montant") {
  const text = typeof value === "bigint" ? value.toString() : String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new PriceEngineError("INVALID_AMOUNT", `${field} invalide : « ${value} ».`);
  const frac = (match[2] ?? "").padEnd(exponent + 1, "0");
  let minor = BigInt(match[1]) * 10n ** BigInt(exponent) + (exponent > 0 ? BigInt(frac.slice(0, exponent)) : 0n);
  if (Number(frac[exponent]) >= 5) minor += 1n;
  return minor;
}

/** Unités mineures → décimal lisible ("15000", "49.90"). */
export function fromMinor(minor, exponent) {
  const sign = minor < 0n ? "-" : "";
  const abs = minor < 0n ? -minor : minor;
  if (exponent === 0) return `${sign}${abs}`;
  const unit = 10n ** BigInt(exponent);
  return `${sign}${abs / unit}.${String(abs % unit).padStart(exponent, "0")}`;
}

/** Pourcentage (20, "12.5") ou points de base explicites ({ bps }) → points de base, entre 0 et 10000. */
function toBasisPoints(value, field) {
  if (value == null) return 0n;
  if (typeof value === "object" && "bps" in value) {
    const bps = BigInt(value.bps);
    if (bps < 0n || bps > BPS) throw new PriceEngineError("INVALID_RATE", `${field} hors bornes.`);
    return bps;
  }
  const bps = toMinor(value, 2, field); // 12.5 % → 1250 points de base
  if (bps > BPS) throw new PriceEngineError("INVALID_RATE", `${field} supérieur à 100 %.`);
  return bps;
}

/** Division entière arrondie au demi supérieur (montants positifs). */
function divRound(numerator, denominator) {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Applique une remise en points de base à un montant mineur ; renvoie le montant de la remise (positif). */
function discountOf(amount, bps) {
  return amount - divRound(amount * (BPS - bps), BPS);
}

/**
 * Taux de change → fraction exacte { num, den }. Accepte une fraction exacte ({ num, den } en BigInt ou chaînes de
 * chiffres, fournie par `fx-rates.settlementRate`) ou un décimal positif ("655.957", "0.001524").
 */
function parseRate(rate) {
  if (rate && typeof rate === "object") {
    const num = typeof rate.num === "bigint" ? rate.num : /^\d{1,40}$/.test(String(rate.num ?? "")) ? BigInt(rate.num) : null;
    const den = typeof rate.den === "bigint" ? rate.den : /^\d{1,40}$/.test(String(rate.den ?? "")) ? BigInt(rate.den) : null;
    if (num === null || den === null || num <= 0n || den <= 0n) throw new PriceEngineError("INVALID_RATE", "Taux de change invalide.");
    return { num, den };
  }
  const text = String(rate ?? "").trim();
  const match = /^(\d+)(?:\.(\d{1,12}))?$/.exec(text);
  if (!match) throw new PriceEngineError("INVALID_RATE", `Taux de change invalide : « ${rate} ».`);
  const decimals = match[2] ?? "";
  const num = BigInt(match[1] + decimals);
  if (num === 0n) throw new PriceEngineError("INVALID_RATE", "Taux de change nul.");
  return { num, den: 10n ** BigInt(decimals.length) };
}

/**
 * Répartit `amount` entre des poids, proportionnellement, sans perte ni création d'unité (méthode des plus forts
 * restes ; à égalité, la première ligne l'emporte — déterministe).
 */
function allocate(amount, weights) {
  const total = weights.reduce((a, w) => a + w, 0n);
  if (total === 0n || amount === 0n) return weights.map(() => 0n);
  const shares = weights.map((w) => (amount * w) / total);
  let rest = amount - shares.reduce((a, s) => a + s, 0n);
  const order = weights
    .map((w, i) => ({ i, rem: (amount * w) % total }))
    .sort((a, b) => (b.rem === a.rem ? a.i - b.i : b.rem > a.rem ? 1 : -1));
  for (const { i } of order) {
    if (rest === 0n) break;
    shares[i] += 1n;
    rest -= 1n;
  }
  return shares;
}

function normalizeLine(line, index, exponent) {
  if (!LINE_KINDS.has(line?.kind)) throw new PriceEngineError("INVALID_LINE", `Ligne ${index + 1} : type inconnu « ${line?.kind} ».`);
  const quantity = line.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new PriceEngineError("INVALID_QUANTITY", `Ligne ${index + 1} : quantité invalide.`);
  }
  if (line.kind === "AUCTION" && line.auctionPrice == null) {
    throw new PriceEngineError("INVALID_LINE", `Ligne ${index + 1} : prix d'enchère manquant.`);
  }
  return {
    kind: line.kind,
    ref: String(line.ref ?? index + 1),
    quantity: BigInt(quantity),
    unitBase: toMinor(line.unitPrice ?? line.auctionPrice, exponent, `Ligne ${index + 1} : prix`),
    promotionBps: line.kind === "AUCTION" ? 0n : toBasisPoints(line.promotionPercent, `Ligne ${index + 1} : promotion`),
    volumeBps: line.kind === "B2B_PACKAGE" || line.kind === "B2B_THEMATIQUE" ? toBasisPoints(line.volumeDiscountPercent, `Ligne ${index + 1} : remise de volume`) : 0n,
    auctionPrice: line.kind === "AUCTION" ? toMinor(line.auctionPrice, exponent, `Ligne ${index + 1} : enchère`) : null,
    formationId: line.formationId ?? null,
    categoryIds: Array.isArray(line.categoryIds) ? line.categoryIds : [],
    authorKey: line.authorKey ?? null,
  };
}

/** Prix d'une ligne avant coupon, avec ou sans promotion. */
function priceBeforeCoupon(line, withPromotion) {
  const adjustments = [];
  if (line.auctionPrice != null) {
    const total = line.auctionPrice * line.quantity;
    const delta = line.unitBase * line.quantity - total;
    if (delta !== 0n) adjustments.push({ type: "auction", amount: -delta });
    return { total, adjustments };
  }
  let unit = line.unitBase;
  if (withPromotion && line.promotionBps > 0n) {
    const d = discountOf(unit, line.promotionBps);
    unit -= d;
    adjustments.push({ type: "promotion", amount: -(d * line.quantity) });
  }
  if (line.volumeBps > 0n) {
    const d = discountOf(unit, line.volumeBps);
    unit -= d;
    adjustments.push({ type: "volume", amount: -(d * line.quantity) });
  }
  return { total: unit * line.quantity, adjustments };
}

function couponEligible(line, scope) {
  if (line.kind === "AUCTION") return false;
  if (!scope || scope.type === "all") return true;
  if (scope.type === "formation") return line.formationId != null && scope.ids?.includes(line.formationId);
  if (scope.type === "category") return line.categoryIds.some((c) => scope.ids?.includes(c));
  if (scope.type === "author") return line.authorKey != null && scope.ids?.includes(line.authorKey);
  return false;
}

/** Calcule le devis complet pour un jeu de promotions donné (avec ou sans) et un coupon éventuel. */
function evaluate(lines, coupon, currency, exponent, withPromotion) {
  const priced = lines.map((l) => ({ line: l, ...priceBeforeCoupon(l, withPromotion) }));
  let couponResult = coupon ? { code: coupon.code, applied: false, reason: null, amount: 0n } : null;

  if (coupon) {
    const eligible = priced.filter((p) => couponEligible(p.line, coupon.scope));
    const eligibleTotal = eligible.reduce((a, p) => a + p.total, 0n);
    const minimum = coupon.minAmount != null ? toMinor(coupon.minAmount, exponent, "Montant minimum du coupon") : 0n;

    if (eligible.length === 0) couponResult.reason = "NOT_ELIGIBLE";
    else if (eligibleTotal < minimum) couponResult.reason = "MIN_AMOUNT_NOT_REACHED";
    else if (coupon.type === "fixed" && normalizeCurrencyCode(coupon.currency) !== currency) couponResult.reason = "CURRENCY_MISMATCH";
    else {
      let discounts;
      if (coupon.type === "percent") {
        const bps = toBasisPoints(coupon.value, "Remise du coupon");
        discounts = eligible.map((p) => discountOf(p.total, bps));
      } else if (coupon.type === "free") {
        discounts = eligible.map((p) => p.total);
      } else if (coupon.type === "fixed") {
        const amount = toMinor(coupon.value, exponent, "Montant du coupon");
        discounts = allocate(amount < eligibleTotal ? amount : eligibleTotal, eligible.map((p) => p.total));
      } else {
        throw new PriceEngineError("INVALID_COUPON", `Type de coupon inconnu « ${coupon.type} ».`);
      }
      eligible.forEach((p, i) => {
        if (discounts[i] > 0n) {
          p.total -= discounts[i];
          p.adjustments.push({ type: "coupon", amount: -discounts[i] });
        }
      });
      const amount = discounts.reduce((a, d) => a + d, 0n);
      couponResult = { code: coupon.code, applied: amount > 0n, reason: amount > 0n ? null : "NOTHING_TO_DISCOUNT", amount };
    }
  }

  const subtotal = priced.reduce((a, p) => a + p.line.unitBase * p.line.quantity, 0n);
  const total = priced.reduce((a, p) => a + p.total, 0n);
  return { priced, couponResult, subtotal, total };
}

/**
 * Taxe par ligne, après remises (D16). `rules` : une règle ou une liste, chacune
 * { country?, ratePercent, inclusive, scope: 'all'|'b2b'|'b2c', label?, reverseCharge? }.
 * - Chaque ligne prend la PREMIÈRE règle de sa catégorie (B2B : packages et thématiques ; B2C : cours et enchères),
 *   sinon la première règle `all` : l'appelant place les règles du pays avant les règles mondiales.
 *   Ex. TVA B2B mondiale de 19,25 % (réglage plateforme), aucune taxe B2C tant qu'aucune règle n'existe.
 * - TTC (inclusive) : le total ne bouge pas ; la taxe est extraite (total − total / (1 + taux)). HT : elle s'ajoute.
 * - Autoliquidation : taux 0, mention conservée.
 */
function applyTax(priced, rules) {
  const list = (Array.isArray(rules) ? rules : rules ? [rules] : []).map(normalizeTaxRule);
  if (list.length === 0) {
    priced.forEach((p) => { p.tax = null; });
    return { amount: 0n, summary: null };
  }
  let amount = 0n;
  const applied = new Map();
  for (const p of priced) {
    const category = B2B_KINDS.has(p.line.kind) ? "b2b" : "b2c";
    const rule = list.find((r) => r.scope === category) ?? list.find((r) => r.scope === "all") ?? null;
    if (!rule) {
      p.tax = { rateBps: 0, inclusive: false, baseMinor: p.total, amountMinor: 0n, exempt: "NO_RULE" };
      continue;
    }
    let lineTax;
    let base;
    if (rule.inclusive) {
      base = divRound(p.total * BPS, BPS + rule.bps);
      lineTax = p.total - base;
    } else {
      base = p.total;
      lineTax = divRound(p.total * rule.bps, BPS);
      p.total += lineTax;
    }
    p.tax = { rateBps: Number(rule.bps), inclusive: rule.inclusive, baseMinor: base, amountMinor: lineTax, rule: rule.label };
    amount += lineTax;
    applied.set(rule, (applied.get(rule) ?? 0n) + lineTax);
  }
  const summary = [...applied.entries()].map(([r, a]) => ({
    country: r.country, scope: r.scope, rateBps: Number(r.bps), inclusive: r.inclusive, reverseCharge: r.reverseCharge, label: r.label, amountMinor: a,
  }));
  return { amount, summary: summary.length ? summary : null };
}

function normalizeTaxRule(rule) {
  const country = rule.country == null || rule.country === "" ? null : String(rule.country).trim().toUpperCase();
  if (country !== null && !/^[A-Z]{2}$/.test(country)) throw new PriceEngineError("INVALID_TAX_RULE", "Pays de taxation invalide (ISO 3166 alpha-2).");
  const scope = rule.scope ?? "all";
  if (!["all", "b2b", "b2c"].includes(scope)) throw new PriceEngineError("INVALID_TAX_RULE", `Portée de taxe inconnue « ${scope} ».`);
  return {
    country,
    scope,
    bps: rule.reverseCharge ? 0n : toBasisPoints(rule.ratePercent ?? 0, "Taux de taxe"),
    inclusive: Boolean(rule.inclusive),
    reverseCharge: Boolean(rule.reverseCharge),
    label: rule.label ?? null,
  };
}

/**
 * Devis.
 * @param {object} input
 * @param {string} input.currency — devise des prix catalogue (ISO 4217)
 * @param {Array<object>} input.lines — { kind, ref, quantity?, unitPrice, promotionPercent?, auctionPrice?,
 *   volumeDiscountPercent?, formationId?, categoryIds?, authorKey? }
 * @param {object} [input.coupon] — { code, type: 'percent'|'fixed'|'free', value?, currency?, minAmount?,
 *   exclusive?, scope?: { type: 'all'|'formation'|'category'|'author', ids? } }
 * @param {object|Array<object>} [input.tax] — règle(s) de taxe applicables, règles du pays d'abord :
 *   { country?, ratePercent, inclusive, scope?: 'all'|'b2b'|'b2c', label?, reverseCharge? }
 * @param {object} [input.settlement] — { currency, rate } : unités de la devise de règlement pour 1 unité de `currency`
 *   (fraction exacte { num, den } recommandée, cf. fx-rates.settlementRate ; décimal accepté)
 */
export function quote(input) {
  const currency = normalizeCurrencyCode(input?.currency);
  const exponent = currencyExponent(currency);
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new PriceEngineError("EMPTY_ORDER", "Commande vide.");
  if (input.lines.length > 200) throw new PriceEngineError("TOO_MANY_LINES", "Trop de lignes dans la commande.");
  const lines = input.lines.map((l, i) => normalizeLine(l, i, exponent));
  const coupon = input.coupon ?? null;

  let result = evaluate(lines, coupon, currency, exponent, true);
  if (coupon?.exclusive && result.couponResult?.applied) {
    // Coupon exclusif : jamais cumulé avec une promotion ; on garde l'option la plus avantageuse pour l'acheteur.
    const couponOnly = evaluate(lines, coupon, currency, exponent, false);
    const promotionsOnly = evaluate(lines, null, currency, exponent, true);
    result = couponOnly.total < promotionsOnly.total
      ? couponOnly
      : { ...promotionsOnly, couponResult: { code: coupon.code, applied: false, reason: "PROMOTION_IS_BETTER", amount: 0n } };
  }

  const { priced, couponResult, subtotal } = result;
  const tax = applyTax(priced, input.tax ?? null);
  const total = priced.reduce((a, p) => a + p.total, 0n);
  const out = {
    engineVersion: ENGINE_VERSION,
    currency,
    exponent,
    lines: priced.map((p) => ({
      kind: p.line.kind,
      ref: p.line.ref,
      quantity: Number(p.line.quantity),
      unitBaseMinor: p.line.unitBase,
      adjustments: p.adjustments,
      tax: p.tax,
      totalMinor: p.total,
    })),
    subtotalMinor: subtotal,
    discountMinor: priced.reduce((a, p) => a + p.adjustments.reduce((b, adj) => b - adj.amount, 0n), 0n),
    taxMinor: tax.amount,
    tax: tax.summary,
    totalMinor: total,
    coupon: couponResult,
    settlement: null,
  };

  if (input.settlement) {
    const target = normalizeCurrencyCode(input.settlement.currency);
    const targetExponent = currencyExponent(target);
    if (target === currency && input.settlement.rate == null) {
      out.settlement = { currency: target, exponent: targetExponent, rate: "1", totalMinor: total };
    } else {
      const { num, den } = parseRate(input.settlement.rate);
      // total (mineures source) × taux × 10^(exposant cible − exposant source), arrondi au demi supérieur. Dans la
      // même devise, un taux fourni est appliqué tel quel (majoration de change sur la devise de base, ADR-0013 D5).
      const shift = targetExponent - exponent;
      const numerator = total * num * (shift >= 0 ? 10n ** BigInt(shift) : 1n);
      const denominator = den * (shift < 0 ? 10n ** BigInt(-shift) : 1n);
      const rate = typeof input.settlement.rate === "object" ? `${num}/${den}` : String(input.settlement.rate);
      out.settlement = { currency: target, exponent: targetExponent, rate, totalMinor: divRound(numerator, denominator) };
    }
  }

  return out;
}

/** Version sérialisable (JSON) d'un devis : BigInt → chaînes décimales lisibles. */
export function serializeQuote(q) {
  const money = (minor, exp = q.exponent) => fromMinor(minor, exp);
  return {
    engineVersion: q.engineVersion,
    currency: q.currency,
    lines: q.lines.map((l) => ({
      kind: l.kind,
      ref: l.ref,
      quantity: l.quantity,
      unitBase: money(l.unitBaseMinor),
      adjustments: l.adjustments.map((a) => ({ type: a.type, amount: money(a.amount) })),
      tax: l.tax && { rateBps: l.tax.rateBps, inclusive: l.tax.inclusive, base: money(l.tax.baseMinor), amount: money(l.tax.amountMinor), rule: l.tax.rule ?? null, exempt: l.tax.exempt ?? null },
      total: money(l.totalMinor),
    })),
    subtotal: money(q.subtotalMinor),
    discount: money(q.discountMinor),
    tax: q.tax && { amount: money(q.taxMinor), rules: q.tax.map((r) => ({ ...r, amountMinor: undefined, amount: money(r.amountMinor) })) },
    total: money(q.totalMinor),
    coupon: q.coupon && { code: q.coupon.code, applied: q.coupon.applied, reason: q.coupon.reason, amount: money(q.coupon.amount) },
    settlement: q.settlement && { currency: q.settlement.currency, rate: q.settlement.rate, total: money(q.settlement.totalMinor, q.settlement.exponent) },
  };
}
