import { jest } from "@jest/globals";
import { AuctionPaymentStrategy } from "../../services/purchase-engine/auction-payment.strategy.js";
import { AuctionSagaStrategy } from "../../saga/strategies/auction.strategy.js";
import { OrchestratorService } from "../../services/orchestrator.service.js";

/** Inscription après enchère (ADR-0021, D4) : l'invitation fait foi, jamais le navigateur. */
const TOKEN = "a".repeat(43);
const claim = (over = {}) => ({ auctionId: 7, rank: 1, status: "pending", payable: true, reason: null, amount: 50000, currency: "XOF", title: "Architectures backend", formationId: 64, email: "awa@example.test", firstName: "Awa", lastName: "Diallo", expiresAt: "2026-10-13T12:00:00.000Z", ...over });
const client = (status, data) => ({ isConfigured: () => true, check: jest.fn().mockResolvedValue({ status, data }), markPaid: jest.fn() });

describe("AuctionPaymentStrategy", () => {
  it("contexte : personne, montant et devise de l'invitation", async () => {
    const s = new AuctionPaymentStrategy(client(200, { data: claim() }));
    const ctx = await s.getContext("7", { claim: TOKEN });
    expect(ctx).toMatchObject({ type: "AUCTION_PAYMENT", price: 50000, currency: "XOF", beneficiary: { email: "awa@example.test", name: "Awa Diallo" }, auction: { rank: 1, formationId: 64 } });
  });

  it("refus explicites : lien incomplet, invalide, déjà réglé, délai passé", async () => {
    await expect(new AuctionPaymentStrategy(client(200, {})).getContext("7", {})).rejects.toMatchObject({ statusCode: 400 });
    await expect(new AuctionPaymentStrategy(client(404, {})).getContext("7", { claim: TOKEN })).rejects.toMatchObject({ statusCode: 404 });
    await expect(new AuctionPaymentStrategy(client(200, { data: claim({ payable: false, reason: "paid" }) })).getContext("7", { claim: TOKEN })).rejects.toThrow(/déjà réglée/);
    await expect(new AuctionPaymentStrategy(client(200, { data: claim({ payable: false, reason: "deadline" }) })).getContext("7", { claim: TOKEN })).rejects.toThrow(/48 heures/);
    await expect(new AuctionPaymentStrategy(client(503, {})).getContext("7", { claim: TOKEN })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("paiement : e-mail et montant de l'invitation, jamais ceux du formulaire ; jeton absent des adresses de retour", async () => {
    const spy = jest.spyOn(OrchestratorService, "initializePayment").mockResolvedValue({ success: true, orderReference: "INS-ABCDEF12", redirectUrl: "https://pay.example.test" });
    const s = new AuctionPaymentStrategy(client(200, { data: claim({ rank: 2, amount: 45000 }) }));
    const out = await s.process({ itemId: "7", claim: TOKEN, customerEmail: "intrus@example.test", amount: 1, paymentMethod: "mobile_money", countryCode: "SN" });
    const arg = spy.mock.calls[0][0];
    expect(arg).toMatchObject({ customerEmail: "awa@example.test", amount: 45000, currency: "XOF", lmsItemId: "64", paymentMethod: "mobile_money" });
    expect(arg.metadata).toMatchObject({ source: "AUCTION", purchase_type: "AUCTION_PAYMENT", auction_id: 7, claim_rank: 2, formation_id: 64 });
    expect([arg.successUrl, arg.cancelUrl, arg.failedUrl].join(" ")).not.toContain(TOKEN);
    expect(out.redirectUrl).toBe("https://pay.example.test");
    spy.mockRestore();
  });
});

describe("AuctionSagaStrategy", () => {
  const order = { reference: "INS-ABCDEF12", totalAmount: "45000.00", currency: "XOF", customerEmail: "awa@example.test", formationId: 64, metadata: JSON.stringify({ auction_id: 7, claim_rank: 2, formation_id: 64, beneficiary_email: "awa@example.test", customer_name: "Awa Diallo" }) };
  const make = (paidStatus, paidResult = "paid") => {
    const deps = {
      client: { isConfigured: () => true, enroll: jest.fn().mockResolvedValue({ status: 201, data: { data: { enrollmentId: 9, channel: "catalog" } } }) },
      claims: { isConfigured: () => true, markPaid: jest.fn().mockResolvedValue({ status: paidStatus, data: { data: { result: paidResult } } }) },
      commissionStep: { execute: jest.fn().mockResolvedValue({ credited: true }) },
      orders: { findOne: jest.fn().mockResolvedValue(order), update: jest.fn().mockResolvedValue([1]) },
      notifyAdmins: jest.fn().mockResolvedValue(undefined),
    };
    return { s: new AuctionSagaStrategy(deps), deps };
  };

  it("invitation payée (rang, montant, devise), inscription « auction » avec le nom, commission, achat terminé", async () => {
    const { s, deps } = make(200);
    const resolve = jest.spyOn((await import("../../saga/strategies/b2c-course.strategy.js")).B2cCourseSagaStrategy.prototype, "resolveStudentId").mockResolvedValue(12);
    const out = await s.execute({ orderReference: "INS-ABCDEF12", correlationId: "t" });
    expect(deps.claims.markPaid).toHaveBeenCalledWith(7, { rank: 2, reference: "INS-ABCDEF12", amount: 45000, currency: "XOF" });
    expect(deps.client.enroll).toHaveBeenCalledWith(expect.objectContaining({ email: "awa@example.test", formationId: 64, source: "auction", name: "Awa Diallo" }), "t");
    expect(deps.commissionStep.execute).toHaveBeenCalled();
    expect(deps.orders.update).toHaveBeenCalled();
    expect(out).toMatchObject({ status: "COMPLETED", auctionId: 7, rank: 2 });
    resolve.mockRestore();
  });

  it("service des enchères indisponible : rejoué plus tard, rien d'inscrit", async () => {
    const { s, deps } = make(503);
    await expect(s.execute({ orderReference: "INS-ABCDEF12", correlationId: "t" })).rejects.toMatchObject({ name: "EnrollmentRetryableError" });
    expect(deps.client.enroll).not.toHaveBeenCalled();
  });

  it("invitation refusée (passée au suivant) : échec définitif et équipe prévenue, aucune inscription", async () => {
    const { s, deps } = make(409, "refused");
    await expect(s.execute({ orderReference: "INS-ABCDEF12", correlationId: "t" })).rejects.toMatchObject({ name: "EnrollmentPermanentError", code: "CLAIM_REFUSED" });
    expect(deps.notifyAdmins).toHaveBeenCalled();
    expect(deps.client.enroll).not.toHaveBeenCalled();
  });
});

describe("toIsoPaidAt (empreinte d'idempotence du crédit de commission)", () => {
  it("reste identique d'un essai à l'autre, même sans date de paiement", async () => {
    const { toIsoPaidAt } = await import("../../saga/steps/commission-credit.step.js");
    const created = new Date("2026-10-11T14:45:00Z");
    expect(toIsoPaidAt(null, created)).toBe("2026-10-11T14:45:00.000Z");
    expect(toIsoPaidAt(undefined, created)).toBe(toIsoPaidAt(null, created));
    expect(toIsoPaidAt("2026-10-11T15:00:00Z", created)).toBe("2026-10-11T15:00:00.000Z");
    expect(toIsoPaidAt("pas une date", created)).toBe("2026-10-11T14:45:00.000Z");
    expect(() => toIsoPaidAt(null, undefined)).toThrow(/introuvable/);
  });
});
