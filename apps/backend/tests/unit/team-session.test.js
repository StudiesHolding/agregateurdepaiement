import jwt from "jsonwebtoken";
import { issueSession, maskPayload, readSession, verifyAssertion, ASSERTION_AUDIENCE, ASSERTION_ISSUER } from "../../utils/team-session.js";

/** Connexion de l'équipe à l'administration du PSP (ADR-0018, D5.2) : règles de sécurité. */
const SECRET = "x".repeat(40);
const SESSION_SECRET = "y".repeat(40);
const assertion = (over = {}, opts = {}) => jwt.sign(
    { email: "membre@studieslearning.test", name: "Membre", role: "finance_manager", perms: ["psp.view", "psp.operations.manage"], ...over },
    opts.secret ?? SECRET,
    { algorithm: "HS256", subject: "42", issuer: ASSERTION_ISSUER, audience: ASSERTION_AUDIENCE, jwtid: "a".repeat(32), expiresIn: 60, ...(opts.sign ?? {}) },
);

describe("assertion de connexion (backend métier → PSP)", () => {
    it("accepte une assertion valide et ne garde que les permissions psp.* connues", () => {
        const r = verifyAssertion(assertion({ perms: ["psp.operations.manage", "finance.view", "psp.inconnue"] }), SECRET);
        expect(r.user).toMatchObject({ id: 42, email: "membre@studieslearning.test", role: "finance_manager" });
        expect(r.user.permissions).toEqual(["psp.view", "psp.operations.manage"]);
        expect(r.jti).toHaveLength(32);
    });

    it("refuse : secret absent, mauvaise signature, mauvaise audience, expirée, sans permission", () => {
        expect(() => verifyAssertion(assertion(), null)).toThrow(expect.objectContaining({ code: "SSO_DISABLED", status: 503 }));
        expect(() => verifyAssertion(assertion({}, { secret: "z".repeat(40) }), SECRET)).toThrow(expect.objectContaining({ code: "INVALID_ASSERTION" }));
        expect(() => verifyAssertion(assertion({}, { sign: { audience: "autre" } }), SECRET)).toThrow(expect.objectContaining({ code: "INVALID_ASSERTION" }));
        expect(() => verifyAssertion(assertion({}, { sign: { expiresIn: -10 } }), SECRET)).toThrow(expect.objectContaining({ code: "ASSERTION_EXPIRED" }));
        expect(() => verifyAssertion(assertion({ perms: ["finance.view"] }), SECRET)).toThrow(expect.objectContaining({ code: "NO_PSP_PERMISSION", status: 403 }));
    });

    it("refuse l'algorithme « none » et une assertion trop vieille même non expirée", () => {
        const none = jwt.sign({ email: "a@b.c", perms: ["psp.view"] }, "", { algorithm: "none", subject: "1", issuer: ASSERTION_ISSUER, audience: ASSERTION_AUDIENCE, jwtid: "b".repeat(32) });
        expect(() => verifyAssertion(none, SECRET)).toThrow(expect.objectContaining({ code: "INVALID_ASSERTION" }));
        const old = assertion({ iat: Math.floor(Date.now() / 1000) - 600 }, { sign: { expiresIn: 3600 } });
        expect(() => verifyAssertion(old, SECRET)).toThrow();
    });
});

describe("session d'équipe", () => {
    it("aller-retour : identité et permissions ; une clé d'API ou un autre jeton n'en est pas une", () => {
        const user = { id: 42, email: "m@sl.test", name: "M", role: "admin", permissions: ["psp.view"] };
        const { token } = issueSession(user, SESSION_SECRET);
        expect(readSession(token, SESSION_SECRET)).toEqual(user);
        expect(readSession(token, "w".repeat(40))).toBeNull();
        expect(readSession(jwt.sign({ id: 3 }, SESSION_SECRET), SESSION_SECRET)).toBeNull();
        expect(readSession(assertion({}, { secret: SESSION_SECRET }), SESSION_SECRET)).toBeNull();
    });
});

describe("journal : masquage", () => {
    it("ne laisse jamais passer les identifiants d'un prestataire", () => {
        expect(maskPayload({ name: "CinetPay", credentials: { apiKey: "k", siteId: "s" }, config: { secretKey: "x", webhookSecret: "w", phone: "+22990000001" } }))
            .toEqual({ name: "CinetPay", credentials: "[masqué]", config: { secretKey: "[masqué]", webhookSecret: "[masqué]", phone: "•••0001" } });
    });
});
