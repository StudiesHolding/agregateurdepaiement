import { decide, exclusionReason, normalizeRequest, normalizeRule } from "../../services/routing/routing-engine.js";

/** Moteur de routage (ADR-0019, D2) : ordre d'essai déterministe, motifs lisibles, jamais d'autre devise. */
const stripe = { id: 1, code: "stripe", name: "Stripe", isActive: true, supportCard: true, supportMobileMoney: false, metadata: {} };
const cinetpay = { id: 2, code: "cinetpay", name: "CinetPay", isActive: true, supportCard: true, supportMobileMoney: true, metadata: {} };
const kkiapay = { id: 3, code: "kkiapay", name: "KkiaPay", isActive: true, supportCard: false, supportMobileMoney: true, metadata: {} };
const rule = (id, provider, over = {}) => ({ id, provider, countryCode: "*", currency: "XOF", paymentMethod: "any", minAmount: 0, maxAmount: null, priority: 10, isActive: true, ...over });
const req = (over = {}) => normalizeRequest({ countryCode: "SN", currency: "XOF", paymentMethod: "mobile_money", amount: 25000, ...over });
const order = (r) => decide(r.rules, r.request).candidates.map((c) => c.rule.provider.code);

describe("moteur de routage", () => {
    it("pays exact avant « tous pays », moyen exact avant « any », puis priorité", () => {
        const rules = [
            rule(1, cinetpay, { priority: 1 }),
            rule(2, kkiapay, { countryCode: "SN", paymentMethod: "any", priority: 50 }),
            rule(3, cinetpay, { countryCode: "SN", paymentMethod: "mobile_money", priority: 90 }),
        ];
        expect(order({ rules, request: req() })).toEqual(["cinetpay", "kkiapay"]);
        const { trace } = decide(rules, req());
        expect(trace.find((t) => t.ruleId === 1).status).toBe("shadowed");
    });

    it("ne bascule jamais vers une autre devise", () => {
        const rules = [rule(1, cinetpay, { currency: "XAF" })];
        const { candidates, trace } = decide(rules, req());
        expect(candidates).toHaveLength(0);
        expect(trace[0].reason).toBe("Devise XAF, demandée XOF");
    });

    it("carte : écarte un prestataire sans carte, respecte la tranche de montant", () => {
        const rules = [rule(1, kkiapay), rule(2, stripe, { maxAmount: 10000 }), rule(3, cinetpay, { paymentMethod: "card", priority: 20 })];
        const r = decide(rules, req({ paymentMethod: "card" }));
        expect(r.candidates.map((c) => c.rule.provider.code)).toEqual(["cinetpay"]);
        expect(r.trace.find((t) => t.ruleId === 1).reason).toMatch(/ne propose pas Carte bancaire/);
        expect(r.trace.find((t) => t.ruleId === 2).reason).toMatch(/supérieur au maximum/);
    });

    it("pays inconnu : seules les règles « tous pays » s'appliquent (aucun pays deviné)", () => {
        const rules = [rule(1, cinetpay, { countryCode: "CM", currency: "XOF" }), rule(2, kkiapay)];
        const r = decide(rules, req({ countryCode: "" }));
        expect(r.candidates.map((c) => c.rule.provider.code)).toEqual(["kkiapay"]);
        expect(r.trace.find((t) => t.ruleId === 1).reason).toMatch(/pays du client inconnu/);
    });

    it("prestataire désactivé ou en maintenance : écarté avec le motif", () => {
        const now = new Date("2026-10-10T10:00:00Z");
        const maint = { ...cinetpay, metadata: { maintenance: { active: true, reason: "incident opérateur", until: "2026-10-11T00:00:00Z" } } };
        expect(exclusionReason(rule(1, maint), req(), now)).toBe("CinetPay est en maintenance (incident opérateur)");
        const ended = { ...cinetpay, metadata: { maintenance: { active: true, until: "2026-10-09T00:00:00Z" } } };
        expect(exclusionReason(rule(1, ended), req(), now)).toBeNull();
        expect(exclusionReason(rule(1, { ...cinetpay, isActive: false }), req(), now)).toBe("CinetPay est désactivé");
        expect(exclusionReason(rule(1, cinetpay, { isActive: false }), req(), now)).toBe("Règle désactivée");
    });

    it("valide les règles et les demandes", () => {
        expect(normalizeRule({ countryCode: "sn", currency: "xof", paymentMethod: "mobile_money", minAmount: 100, maxAmount: 500000, priority: 5 }))
            .toEqual({ countryCode: "SN", currency: "XOF", paymentMethod: "mobile_money", minAmount: 100, maxAmount: 500000, priority: 5 });
        expect(() => normalizeRule({ countryCode: "SEN", currency: "XOF" })).toThrow(/Pays invalide/);
        expect(() => normalizeRule({ countryCode: "*", currency: "XOF", minAmount: 500, maxAmount: 100 })).toThrow(/supérieur au minimum/);
        expect(() => normalizeRule({ countryCode: "*", currency: "XOF", paymentMethod: "crypto" })).toThrow(/Moyen invalide/);
        expect(normalizeRule({ priority: 3 }, { partial: true })).toEqual({ priority: 3 });
        expect(() => normalizeRequest({ countryCode: "SN", currency: "XOF", paymentMethod: "card", amount: -1 })).toThrow(/Montant invalide/);
    });
});
