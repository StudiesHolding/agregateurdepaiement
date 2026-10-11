/**
 * Saga B2C (ADR-0012, P5) : un paiement confirmé inscrit l'apprenant et crédite l'auteur sur le canal VÉRIFIÉ
 * par le backend ; les pannes sont rejouées sans doublon, les refus définitifs alertent les administrateurs.
 */
import { jest, describe, it, expect } from '@jest/globals';
import { OrderStatus } from '../../enums/index.js';
import { B2cCourseSagaStrategy, EnrollmentRetryableError, EnrollmentPermanentError } from '../strategies/b2c-course.strategy.js';

const order = (metadata = {}) => ({ reference: 'ORD-1', formationId: 43, customerEmail: 'awa@test.sl', metadata: JSON.stringify({ purchase_type: 'B2C_COURSE', formation_id: 43, customer_email: 'awa@test.sl', channel: 'direct', ...metadata }) });

function setup({ status = 201, data = { success: true, data: { enrollmentId: '9', channel: 'trainer_link', alreadyEnrolled: false } }, configured = true, metadata, couponStatus = 200 } = {}) {
  const client = { isConfigured: () => configured, enroll: jest.fn(async () => ({ status, data })) };
  const commissionStep = { execute: jest.fn(async () => ({ credited: true })) };
  const orders = { findOne: jest.fn(async () => order(metadata)), update: jest.fn(async () => [1]) };
  const notifyAdmins = jest.fn(async () => undefined);
  const couponClient = { confirm: jest.fn(async () => ({ status: couponStatus, data: {} })) };
  const strategy = new B2cCourseSagaStrategy({ client, commissionStep, orders, notifyAdmins, resolveStudent: async () => 102, couponClient });
  return { strategy, client, commissionStep, orders, notifyAdmins, couponClient };
}

const event = { orderReference: 'ORD-1', correlationId: 'c-1' };

describe('B2cCourseSagaStrategy', () => {
  it('inscrit, crédite sur le canal vérifié (75 %) et termine l’inscription', async () => {
    const { strategy, client, commissionStep, orders } = setup({ metadata: { channel_ref: 'Ab3dEf7h' } });
    const res = await strategy.execute(event);
    expect(client.enroll).toHaveBeenCalledWith({ email: 'awa@test.sl', formationId: 43, orderRef: 'ORD-1', lineRef: '1', source: 'purchase', ref: 'Ab3dEf7h' }, 'c-1');
    expect(commissionStep.execute).toHaveBeenCalledWith({ orderReference: 'ORD-1', studentId: 102, correlationId: 'c-1', channel: 'trainer_link' });
    expect(orders.update.mock.calls[0][0]).toMatchObject({ status: OrderStatus.COMPLETED });
    expect(res).toMatchObject({ status: 'COMPLETED', channel: 'trainer_link', alreadyEnrolled: false });
  });

  it('rejeu : inscription déjà faite (200), commission rejouée sans doublon côté backend', async () => {
    const { strategy, commissionStep } = setup({ status: 200, data: { success: true, data: { enrollmentId: '9', channel: 'direct', alreadyEnrolled: true } } });
    expect((await strategy.execute(event)).alreadyEnrolled).toBe(true);
    expect(commissionStep.execute).toHaveBeenCalled();
  });

  it('backend indisponible (503) ou configuration absente : erreur réessayable, aucune commission', async () => {
    const down = setup({ status: 503, data: {} });
    await expect(down.strategy.execute(event)).rejects.toBeInstanceOf(EnrollmentRetryableError);
    expect(down.commissionStep.execute).not.toHaveBeenCalled();
    await expect(setup({ configured: false }).strategy.execute(event)).rejects.toBeInstanceOf(EnrollmentRetryableError);
  });

  it('compte introuvable (404) : échec définitif et alerte admin, aucune commission', async () => {
    const { strategy, notifyAdmins, commissionStep } = setup({ status: 404, data: { code: 'USER_NOT_FOUND', error: 'Aucun compte' } });
    await expect(strategy.execute(event)).rejects.toBeInstanceOf(EnrollmentPermanentError);
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ reference: 'ORD-1' }), 'USER_NOT_FOUND', 'Aucun compte');
    expect(commissionStep.execute).not.toHaveBeenCalled();
  });

  it('code de lien malformé : jamais transmis au backend', async () => {
    const { strategy, client } = setup({ metadata: { channel_ref: "x' OR 1=1" } });
    await strategy.execute(event);
    expect(client.enroll.mock.calls[0][0]).not.toHaveProperty('ref');
  });

  describe('coupon (ADR-0012, D6 bis)', () => {
    const RES = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

    it('paiement confirmé → le coupon est confirmé pour l’inscription, puis la commission est créditée', async () => {
      const { strategy, couponClient, commissionStep, orders } = setup({ metadata: { coupon_reservation_id: RES, coupon_code: 'MOINS20' } });
      await strategy.execute(event);
      expect(couponClient.confirm).toHaveBeenCalledWith(RES, 'ORD-1');
      expect(commissionStep.execute).toHaveBeenCalled();
      expect(orders.update).toHaveBeenCalledWith(expect.objectContaining({ status: OrderStatus.COMPLETED }), expect.anything());
    });

    it('backend des coupons indisponible → nouvel essai, rien n\'est crédité ni clôturé', async () => {
      const { strategy, commissionStep, orders } = setup({ metadata: { coupon_reservation_id: RES }, couponStatus: 503 });
      await expect(strategy.execute(event)).rejects.toBeInstanceOf(EnrollmentRetryableError);
      expect(commissionStep.execute).not.toHaveBeenCalled();
      expect(orders.update).not.toHaveBeenCalled();
    });

    it('sans coupon → aucun appel au service des codes', async () => {
      const { strategy, couponClient } = setup();
      await strategy.execute(event);
      expect(couponClient.confirm).not.toHaveBeenCalled();
    });
  });
});
