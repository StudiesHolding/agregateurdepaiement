import { estimateFees, isImplemented, mergeSettings, readiness } from "../../services/providers/provider-catalog.js";

/** Prestataires (ADR-0019, D3) : préparation sans jamais exposer un secret, réglages validés. */
describe("catalogue des prestataires", () => {
    it("préparation : présence des identifiants, jamais leur valeur ; mode déduit", () => {
        const r = readiness("stripe", { STRIPE_SECRET_KEY: "sk_test_abc" });
        expect(r).toMatchObject({ implemented: true, ready: true, mode: "test" });
        expect(JSON.stringify(r)).not.toContain("sk_test_abc");
        expect(readiness("stripe", { STRIPE_SECRET_KEY: "sk_live_x" }).mode).toBe("live");
        const k = readiness("kkiapay", { KKIAPAY_PUBLIC_KEY: "a" });
        expect(k.ready).toBe(false);
        expect(k.credentials.filter((c) => !c.present).map((c) => c.env)).toEqual(["KKIAPAY_PRIVATE_KEY", "KKIAPAY_SECRET_KEY"]);
        expect(readiness("maviance", {})).toMatchObject({ implemented: false, ready: false });
        expect(isImplemented("CinetPay")).toBe(true);
    });

    it("maintenance : motif obligatoire, date de début conservée, levée propre", () => {
        expect(() => mergeSettings({}, { maintenance: { active: true } })).toThrow(/motif/);
        const on = mergeSettings({}, { maintenance: { active: true, reason: "incident opérateur", until: "2026-10-11T00:00:00Z" } });
        expect(on.maintenance).toMatchObject({ active: true, reason: "incident opérateur", until: "2026-10-11T00:00:00.000Z" });
        const again = mergeSettings(on, { maintenance: { active: true, reason: "toujours en cours" } });
        expect(again.maintenance.since).toBe(on.maintenance.since);
        expect(mergeSettings(on, { maintenance: { active: false } }).maintenance).toEqual({ active: false });
    });

    it("barème de frais et délai de reversement validés ; frais estimés", () => {
        const m = mergeSettings({}, { fees: { mobile_money: { percent: 3.5, fixed: 0 }, card: { percent: 2.9, fixed: 0.3, currency: "eur" } }, settlementDays: 2 });
        expect(m.fees.card).toEqual({ percent: 2.9, fixed: 0.3, currency: "EUR" });
        expect(m.settlementDays).toBe(2);
        expect(() => mergeSettings({}, { fees: { card: { percent: 40 } } })).toThrow(/Pourcentage/);
        expect(() => mergeSettings({}, { settlementDays: 120 })).toThrow(/reversement/);
        expect(estimateFees(m, "mobile_money", 60000, "XOF")).toBe(2100);
        expect(estimateFees(m, "card", 100, "EUR")).toBe(3.2);
        expect(estimateFees(m, "card", 60000, "XOF")).toBe(1740);
    });
});
