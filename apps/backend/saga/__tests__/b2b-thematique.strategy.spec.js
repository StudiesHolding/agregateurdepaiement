/**
 * Tests unitaires — B2BThematiqueStrategy (S1-8) : rejeu idempotent, admin actif préservé, échéance posée.
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const mockCompanyFindOne = jest.fn();
const mockCompanyFindByPk = jest.fn();
const mockCompanyCreate = jest.fn();
const mockAdminFindOne = jest.fn();
const mockAdminCreate = jest.fn();
const mockThematiqueFindOne = jest.fn();
const mockThematiqueCreate = jest.fn();
const mockOrderFindOne = jest.fn();
const mockOrderUpdate = jest.fn();
const mockSendEmail = jest.fn().mockResolvedValue({ success: true });

const mockTransaction = { commit: jest.fn(), rollback: jest.fn(), LOCK: { UPDATE: 'UPDATE' } };

jest.unstable_mockModule('../../models/index.js', () => ({
  __esModule: true,
  Company: { findOne: mockCompanyFindOne, findByPk: mockCompanyFindByPk, create: mockCompanyCreate },
  CompanyAdmin: { findOne: mockAdminFindOne, create: mockAdminCreate },
  CompanyThematique: { findOne: mockThematiqueFindOne, create: mockThematiqueCreate },
  Order: { findOne: mockOrderFindOne, update: mockOrderUpdate },
  sequelize: { transaction: jest.fn(async () => mockTransaction), literal: (str) => `LITERAL:${str}` },
}));
jest.unstable_mockModule('../../services/mail.service.js', () => ({
  __esModule: true,
  MailService: { sendEmail: mockSendEmail },
}));

const addMonths = (date, months) => {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
};

describe('B2BThematiqueStrategy — provisionnement sûr et rejeu idempotent', () => {
  let B2BThematiqueStrategy, OrderStatus, strategy;

  const event = {
    source: 'B2B_THEMATIQUE',
    correlationId: 'corr-th-001',
    payload: {
      companyName: 'Acme SARL', companyEmail: 'rh@acme.cm', companyId: null,
      adminEmail: 'rh@acme.cm', adminFirstName: 'Awa', adminLastName: 'Ndiaye',
      thematiqueId: 4, licenseCount: 25, orderReference: 'CMD-TH-001',
    },
  };

  beforeAll(async () => {
    ({ B2BThematiqueStrategy } = await import('../strategies/b2b-thematique.strategy.js'));
    ({ OrderStatus } = await import('../../enums/index.js'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrderFindOne.mockResolvedValue({ id: 1, reference: 'CMD-TH-001', status: 'payment_confirmed' });
    mockCompanyFindOne.mockResolvedValue({ id: 55, name: 'Acme SARL', email: 'rh@acme.cm' });
    mockAdminFindOne.mockResolvedValue(null);
    mockAdminCreate.mockResolvedValue({ id: 9, email: 'rh@acme.cm', is_active: false, activation_token: 'tok' });
    mockThematiqueFindOne.mockResolvedValue(null);
    mockThematiqueCreate.mockImplementation(async (data) => ({ id: 31, ...data }));
    mockOrderUpdate.mockResolvedValue([1]);
    strategy = new B2BThematiqueStrategy();
  });

  it('TC-TH-01: inscription déjà COMPLETED ⇒ rien de modifié, aucun e-mail', async () => {
    mockOrderFindOne.mockResolvedValueOnce({ id: 1, reference: 'CMD-TH-001', status: OrderStatus.COMPLETED });
    await expect(strategy.execute(event)).resolves.toEqual({
      success: true, alreadyProvisioned: true, orderReference: 'CMD-TH-001',
    });
    expect(mockOrderFindOne).toHaveBeenCalledWith(expect.objectContaining({ lock: 'UPDATE', transaction: mockTransaction }));
    expect(mockThematiqueCreate).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('TC-TH-02: inscription introuvable ⇒ erreur définitive', async () => {
    mockOrderFindOne.mockResolvedValueOnce(null);
    await expect(strategy.execute(event)).rejects.toThrow(/not found/);
    expect(mockThematiqueCreate).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  it('TC-TH-03: admin actif préservé, aucun e-mail', async () => {
    const update = jest.fn();
    mockAdminFindOne.mockResolvedValueOnce({ id: 3, email: 'rh@acme.cm', is_active: true, update });
    await strategy.execute(event);
    expect(update).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('TC-TH-04: premier achat ⇒ droit créé avec échéance à +12 mois, achat COMPLETED', async () => {
    const before = new Date();
    await strategy.execute(event);
    const [data] = mockThematiqueCreate.mock.calls[0];
    expect(data).toMatchObject({ company_id: 55, authoring_thematique_id: 4, purchase_order_id: 'CMD-TH-001', status: 'active' });
    expect(Math.abs(data.expiry_date.getTime() - addMonths(before, 12).getTime())).toBeLessThan(5000);
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
      expect.objectContaining({ where: { reference: 'CMD-TH-001' } }),
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('TC-TH-05: droit expiré ⇒ réactivé avec nouvelle échéance ; droit actif ⇒ échéance inchangée', async () => {
    const expiredUpdate = jest.fn().mockResolvedValue();
    mockThematiqueFindOne.mockResolvedValueOnce({ id: 31, status: 'expired', expiry_date: addMonths(new Date(), -2), update: expiredUpdate });
    await strategy.execute(event);
    expect(expiredUpdate.mock.calls[0][0].status).toBe('active');
    expect(expiredUpdate.mock.calls[0][0].expiry_date.getTime()).toBeGreaterThan(Date.now());

    const future = addMonths(new Date(), 5);
    const activeUpdate = jest.fn().mockResolvedValue();
    mockThematiqueFindOne.mockResolvedValueOnce({ id: 31, status: 'active', expiry_date: future, update: activeUpdate });
    await strategy.execute(event);
    expect(activeUpdate.mock.calls[0][0].status).toBeUndefined();
    expect(activeUpdate.mock.calls[0][0].expiry_date.getTime()).toBe(future.getTime());
  });
});
