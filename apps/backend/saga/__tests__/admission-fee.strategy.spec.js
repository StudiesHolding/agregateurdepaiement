/** Tests unitaires — saga des frais de dossier (ADR-0016, D6 bis). Backend métier et inscriptions simulés. */
import { jest, describe, it, expect } from '@jest/globals';
import { AdmissionFeeSagaStrategy } from '../strategies/admission-fee.strategy.js';

const order = { reference: 'ORD-9', formationId: 63, metadata: JSON.stringify({ purchase_type: 'ADMISSION_FEE', admission_candidature_id: 105 }) };
const build = (status, data = {}) => {
  const client = { isConfigured: () => true, feePaid: jest.fn(async () => ({ status, data })) };
  const orders = { findOne: jest.fn(async () => order), update: jest.fn(async () => [1]) };
  const notifyAdmins = jest.fn(async () => undefined);
  return { saga: new AdmissionFeeSagaStrategy({ client, orders, notifyAdmins }), client, orders, notifyAdmins };
};

describe('AdmissionFeeSagaStrategy', () => {
  it('frais confirmés → backend prévenu pour la candidature, inscription terminée', async () => {
    const { saga, client, orders } = build(200, { data: { submitted: true } });
    const r = await saga.execute({ orderReference: 'ORD-9', correlationId: 'c1' });
    expect(client.feePaid).toHaveBeenCalledWith(105, 'ORD-9', 'c1');
    expect(orders.update).toHaveBeenCalled();
    expect(r).toMatchObject({ status: 'COMPLETED', candidatureId: 105, submitted: true });
  });

  it('backend indisponible → erreur réessayable, inscription non terminée', async () => {
    const { saga, orders } = build(503);
    await expect(saga.execute({ orderReference: 'ORD-9', correlationId: 'c2' })).rejects.toMatchObject({ name: 'AdmissionFeeRetryableError' });
    expect(orders.update).not.toHaveBeenCalled();
  });

  it('refus définitif → alerte admin, erreur définitive', async () => {
    const { saga, notifyAdmins } = build(404, { code: 'NOT_FOUND' });
    await expect(saga.execute({ orderReference: 'ORD-9', correlationId: 'c3' })).rejects.toMatchObject({ name: 'AdmissionFeePermanentError' });
    expect(notifyAdmins).toHaveBeenCalled();
  });
});
