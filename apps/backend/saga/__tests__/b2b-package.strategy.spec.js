/**
 * Tests unitaires — B2BPackageStrategy (S1-8)
 *
 * Critères d'acceptation :
 * - commande déjà COMPLETED ⇒ aucune licence ajoutée, aucun e-mail ;
 * - admin existant actif ⇒ reste actif, pas d'e-mail ;
 * - admin existant inactif ⇒ nouveau jeton + e-mail ; nouvel admin ⇒ création + e-mail ;
 * - companyId fourni ⇒ cette entreprise (pas de recherche par e-mail) ; inconnu ⇒ erreur ;
 * - expiration : création ⇒ +12 mois (ou B2B_ACCESS_VALIDITY_MONTHS) ; pool actif
 *   non expiré ⇒ inchangée ; pool expiré / sans date / non actif ⇒ nouvelle date.
 *
 * Mode ESM : jest.unstable_mockModule + imports dynamiques.
 */
import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

// ============================================================
// Mocks ESM avec jest.unstable_mockModule
// ============================================================
const mockCompanyFindOne = jest.fn();
const mockCompanyFindByPk = jest.fn();
const mockCompanyCreate = jest.fn();
const mockAdminFindOne = jest.fn();
const mockAdminCreate = jest.fn();
const mockPackageFindOne = jest.fn();
const mockPackageCreate = jest.fn();
const mockOrderFindOne = jest.fn();
const mockOrderUpdate = jest.fn();
const mockSendEmail = jest.fn().mockResolvedValue({ success: true });

const mockTransaction = {
  commit: jest.fn().mockResolvedValue(),
  rollback: jest.fn().mockResolvedValue(),
  LOCK: { UPDATE: 'UPDATE' },
};
const mockTransactionStart = jest.fn().mockResolvedValue(mockTransaction);

jest.unstable_mockModule('../../models/index.js', () => ({
  __esModule: true,
  Company: { findOne: mockCompanyFindOne, findByPk: mockCompanyFindByPk, create: mockCompanyCreate },
  CompanyAdmin: { findOne: mockAdminFindOne, create: mockAdminCreate },
  CompanyPackage: { findOne: mockPackageFindOne, create: mockPackageCreate },
  Order: { findOne: mockOrderFindOne, update: mockOrderUpdate },
  sequelize: {
    transaction: mockTransactionStart,
    literal: (str) => `LITERAL:${str}`,
  },
}));

jest.unstable_mockModule('../../services/mail.service.js', () => ({
  __esModule: true,
  MailService: { sendEmail: mockSendEmail },
}));

describe('B2BPackageStrategy — provisionnement sûr et rejeu idempotent', () => {
  let B2BPackageStrategy, getB2BAccessValidityMonths, computeB2BAccessExpiryDate, OrderStatus, strategy;

  const company = { id: 55, name: 'Acme SARL', email: 'manager@acme.com' };

  const baseEvent = {
    source: 'B2B_PACKAGE',
    correlationId: 'corr-pkg-001',
    payload: {
      companyName: 'Acme SARL',
      companyEmail: 'manager@acme.com',
      companyId: null,
      adminEmail: 'manager@acme.com',
      adminFirstName: 'Jean',
      adminLastName: 'Dupont',
      packageId: '7',
      licenseCount: 5,
      orderReference: 'CMD-PKG-001',
    },
  };

  const addMonths = (date, months) => {
    const d = new Date(date.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
  };

  beforeAll(async () => {
    ({ B2BPackageStrategy } = await import('../strategies/b2b-package.strategy.js'));
    ({ getB2BAccessValidityMonths, computeB2BAccessExpiryDate } = await import('../strategies/b2b-access.js'));
    const enumMod = await import('../../enums/index.js');
    OrderStatus = enumMod.OrderStatus;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockResolvedValue();
    mockTransaction.rollback.mockResolvedValue();
    // Comportement nominal : commande payée non complétée, entreprise et admin
    // existants (admin inactif), pool à créer.
    mockOrderFindOne.mockResolvedValue({ id: 101, reference: 'CMD-PKG-001', status: 'payment_confirmed' });
    mockCompanyFindOne.mockResolvedValue(company);
    mockAdminFindOne.mockResolvedValue(null);
    mockAdminCreate.mockResolvedValue({ id: 9, email: 'manager@acme.com', is_active: false, activation_token: 'tok-created' });
    mockPackageFindOne.mockResolvedValue(null);
    mockPackageCreate.mockImplementation(async (data) => ({ id: 901, ...data }));
    mockOrderUpdate.mockResolvedValue([1]);
    strategy = new B2BPackageStrategy();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    delete process.env.B2B_ACCESS_VALIDITY_MONTHS;
  });

  // ─────────────────────────────────────────────────────────
  // Critère : commande déjà COMPLETED ⇒ rien
  // ─────────────────────────────────────────────────────────
  it('TC-PKG-01: commande déjà COMPLETED ⇒ aucune licence ajoutée, aucun e-mail, transaction validée', async () => {
    mockOrderFindOne.mockResolvedValueOnce({
      id: 101,
      reference: 'CMD-PKG-001',
      status: OrderStatus.COMPLETED,
    });

    const result = await strategy.execute(baseEvent);

    expect(result).toEqual({ success: true, alreadyProvisioned: true, orderReference: 'CMD-PKG-001' });

    // La commande est lue avec verrou AVANT tout effet
    expect(mockOrderFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reference: 'CMD-PKG-001' },
        lock: mockTransaction.LOCK.UPDATE,
        transaction: mockTransaction,
      })
    );
    expect(mockCompanyFindOne).not.toHaveBeenCalled();
    expect(mockCompanyCreate).not.toHaveBeenCalled();
    expect(mockPackageFindOne).not.toHaveBeenCalled();
    expect(mockPackageCreate).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  it('TC-PKG-02: commande introuvable ⇒ erreur définitive, rien de provisionné', async () => {
    mockOrderFindOne.mockResolvedValueOnce(null);
    await expect(strategy.execute(baseEvent)).rejects.toThrow(/not found/);
    expect(mockPackageCreate).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  it('TC-PKG-03: admin existant ACTIF ⇒ ni jeton ni is_active modifiés, aucun e-mail', async () => {
    const update = jest.fn();
    mockAdminFindOne.mockResolvedValueOnce({ id: 3, email: 'manager@acme.com', is_active: true, update });
    await strategy.execute(baseEvent);
    expect(update).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPackageCreate).toHaveBeenCalled();
  });

  it('TC-PKG-04: admin existant INACTIF ⇒ nouveau jeton + e-mail d\'activation', async () => {
    const update = jest.fn().mockResolvedValue();
    mockAdminFindOne.mockResolvedValueOnce({ id: 3, email: 'manager@acme.com', is_active: 0, activation_token: 'old', update });
    await strategy.execute(baseEvent);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ activation_token: expect.any(String), is_active: false }),
      expect.anything(),
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('TC-PKG-05: nouvel admin ⇒ création + e-mail d\'activation', async () => {
    await strategy.execute(baseEvent);
    expect(mockAdminCreate).toHaveBeenCalledWith(expect.objectContaining({ email: 'manager@acme.com', is_active: false }), expect.anything());
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('TC-PKG-06: companyId fourni ⇒ cette entreprise, sans recherche par e-mail', async () => {
    mockCompanyFindByPk.mockResolvedValueOnce({ id: 77, name: 'Dashboard Co', email: 'x@co.cm' });
    await strategy.execute({ ...baseEvent, payload: { ...baseEvent.payload, companyId: 77 } });
    expect(mockCompanyFindByPk).toHaveBeenCalledWith(77, expect.anything());
    expect(mockCompanyFindOne).not.toHaveBeenCalled();
    expect(mockCompanyCreate).not.toHaveBeenCalled();
    expect(mockPackageCreate).toHaveBeenCalledWith(expect.objectContaining({ company_id: 77 }), expect.anything());
  });

  it('TC-PKG-07: companyId inconnu ⇒ erreur, aucune création', async () => {
    mockCompanyFindByPk.mockResolvedValueOnce(null);
    await expect(strategy.execute({ ...baseEvent, payload: { ...baseEvent.payload, companyId: 404 } }))
      .rejects.toThrow(/not found/);
    expect(mockCompanyCreate).not.toHaveBeenCalled();
    expect(mockPackageCreate).not.toHaveBeenCalled();
  });

  it('TC-PKG-08: création du pool ⇒ échéance = maintenant + 12 mois (ou valeur de l\'env)', async () => {
    const before = new Date();
    await strategy.execute(baseEvent);
    const { expiry_date: expiry } = mockPackageCreate.mock.calls[0][0];
    expect(Math.abs(expiry.getTime() - addMonths(before, 12).getTime())).toBeLessThan(5000);

    process.env.B2B_ACCESS_VALIDITY_MONTHS = '6';
    expect(getB2BAccessValidityMonths()).toBe(6);
    process.env.B2B_ACCESS_VALIDITY_MONTHS = 'abc';
    expect(getB2BAccessValidityMonths()).toBe(12);
    delete process.env.B2B_ACCESS_VALIDITY_MONTHS;
    expect(computeB2BAccessExpiryDate(new Date('2026-01-15T00:00:00Z'), 12).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('TC-PKG-09: ajout à un pool actif non expiré ⇒ licences ajoutées, échéance inchangée', async () => {
    const future = addMonths(new Date(), 4);
    const update = jest.fn().mockResolvedValue();
    mockPackageFindOne.mockResolvedValueOnce({ id: 5, total_licenses: 10, status: 'active', expiry_date: future, update });
    await strategy.execute(baseEvent);
    const [data] = update.mock.calls[0];
    expect(data.total_licenses).toBe(15);
    expect(data.expiry_date.getTime()).toBe(future.getTime());
  });

  it('TC-PKG-10: pool expiré ⇒ nouvelle échéance à +12 mois', async () => {
    const past = addMonths(new Date(), -1);
    const update = jest.fn().mockResolvedValue();
    mockPackageFindOne.mockResolvedValueOnce({ id: 5, total_licenses: 10, status: 'expired', expiry_date: past, update });
    const before = new Date();
    await strategy.execute(baseEvent);
    const [data] = update.mock.calls[0];
    expect(data.status).toBe('active');
    expect(Math.abs(data.expiry_date.getTime() - addMonths(before, 12).getTime())).toBeLessThan(5000);
  });
});
