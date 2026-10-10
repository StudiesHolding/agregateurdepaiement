/**
 * Tests unitaires — AdmissionPurchaseStrategy (ADR-0016, D6 bis)
 * Le backend métier (route interne des admissions) et l'orchestrateur PSP sont simulés.
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const mockInitializePayment = jest.fn();
jest.unstable_mockModule('../../orchestrator.service.js', () => ({
  OrchestratorService: { initializePayment: mockInitializePayment },
}));

const CONTEXT = {
  candidatureId: 102, kind: 'offer', purchasable: true, reason: null, formationId: 63, title: 'Piloter par la donnée',
  label: 'Votre place dans le programme', amount: 29.4, currency: 'EUR', thumbnailUrl: null,
  beneficiaryEmail: 'candidat@test.dev', beneficiaryName: 'Nadia Rakoto',
};

const clientWith = (checkout, pending = { status: 200, data: { success: true } }) => ({
  isConfigured: () => true,
  checkout: jest.fn(async () => checkout),
  pending: jest.fn(async () => pending),
});

describe('AdmissionPurchaseStrategy', () => {
  let AdmissionPurchaseStrategy;
  beforeAll(async () => { ({ AdmissionPurchaseStrategy } = await import('../admission.strategy.js')); });
  beforeEach(() => {
    mockInitializePayment.mockReset();
    mockInitializePayment.mockResolvedValue({ success: true, orderReference: 'ORD-77', provider: 'cinetpay', redirectUrl: 'https://psp.test/pay' });
  });

  it('identifiant de candidature invalide → 400 sans appel au backend', async () => {
    const client = clientWith({ status: 200, data: { data: CONTEXT } });
    const s = new AdmissionPurchaseStrategy('offer', client);
    for (const bad of ['abc', '0', '-2', '', null]) await expect(s.getContext(bad)).rejects.toMatchObject({ statusCode: 400 });
    expect(client.checkout).not.toHaveBeenCalled();
  });

  it('contexte : montant, devise et bénéficiaire viennent du backend', async () => {
    const s = new AdmissionPurchaseStrategy('offer', clientWith({ status: 200, data: { data: CONTEXT } }));
    expect(await s.getContext('102')).toMatchObject({ type: 'ADMISSION_OFFER', itemId: 102, price: 29.4, currency: 'EUR', beneficiary: { email: 'candidat@test.dev' } });
  });

  it('offre non valide ou rien à payer → refus motivé (409)', async () => {
    const s = new AdmissionPurchaseStrategy('offer', clientWith({ status: 200, data: { data: { ...CONTEXT, purchasable: false, reason: 'NO_VALID_OFFER' } } }));
    await expect(s.getContext(102)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('offre') });
  });

  it('paiement : prix et bénéficiaire du serveur (navigateur ignoré), saga B2C, offre protégée pour la commande', async () => {
    const client = clientWith({ status: 200, data: { data: CONTEXT } });
    const s = new AdmissionPurchaseStrategy('offer', client);
    const r = await s.initiatePayment({ itemId: 102, amount: 1, currency: 'XAF', customerEmail: 'parent@test.dev', beneficiaryEmail: 'pirate@test.dev' });
    const call = mockInitializePayment.mock.calls[0][0];
    expect(call).toMatchObject({ amount: 29.4, currency: 'EUR', customerEmail: 'candidat@test.dev' });
    expect(call.metadata).toMatchObject({ purchase_type: 'B2C_COURSE', admission_kind: 'offer', admission_candidature_id: 102, beneficiary_email: 'candidat@test.dev', payer_email: 'parent@test.dev', formation_id: 63 });
    expect(client.pending).toHaveBeenCalledWith(102, 'offer', 'ORD-77');
    expect(r).toMatchObject({ transactionId: 'ORD-77', status: 'PENDING' });
  });

  it('frais de dossier : saga ADMISSION_FEE, retour au dossier', async () => {
    const client = clientWith({ status: 200, data: { data: { ...CONTEXT, kind: 'fee', amount: 10000, currency: 'XOF' } } });
    const s = new AdmissionPurchaseStrategy('fee', client);
    expect(s.getSagaRoutingType()).toBe('ADMISSION_FEE');
    await s.initiatePayment({ itemId: 102 });
    const call = mockInitializePayment.mock.calls[0][0];
    expect(call.metadata.purchase_type).toBe('ADMISSION_FEE');
    expect(call.successUrl).toContain('type=ADMISSION_FEE&id=102');
  });

  it('engagement refusé par le backend (offre retirée entre-temps) → 409', async () => {
    const s = new AdmissionPurchaseStrategy('offer', clientWith({ status: 200, data: { data: CONTEXT } }, { status: 409, data: { code: 'NO_VALID_OFFER' } }));
    await expect(s.initiatePayment({ itemId: 102 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('backend injoignable → 503', async () => {
    const s = new AdmissionPurchaseStrategy('offer', clientWith({ status: 503, data: {} }));
    await expect(s.getContext(102)).rejects.toMatchObject({ statusCode: 503 });
  });
});
