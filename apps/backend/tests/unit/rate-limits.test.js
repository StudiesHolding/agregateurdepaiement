import { buildRateLimits, callerKey } from "../../utils/rate-limits.js";

/** Limites de débit par appelant (ADR-0019, D6) : jamais une seule limite partagée par adresse. */
describe("limites de débit", () => {
    it("clé par session, par clé d'API, sinon par IP ; jamais le secret en clair", () => {
        const s = callerKey({ headers: { authorization: "Bearer jeton-secret" }, ip: "10.0.0.1" });
        expect(s).toMatch(/^session:[0-9a-f]{32}$/);
        expect(s).not.toContain("jeton-secret");
        expect(callerKey({ headers: { authorization: "Bearer autre" }, ip: "10.0.0.1" })).not.toBe(s);
        expect(callerKey({ headers: { "x-api-key": "cle" }, ip: "10.0.0.1" })).toMatch(/^key:/);
        expect(callerKey({ headers: {}, ip: "10.0.0.1" })).toBe("ip:10.0.0.1");
    });

    it("désactivées en tests, quatre limites sinon", () => {
        expect(buildRateLimits({ NODE_ENV: "test" })).toBeNull();
        expect(Object.keys(buildRateLimits({ NODE_ENV: "production" }))).toEqual(["admin", "machine", "webhooks", "public"]);
    });
});
