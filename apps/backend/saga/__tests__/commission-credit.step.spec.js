/**
 * Tests — Étape de saga « crédit de commission » (S1-5)
 *
 * Vérifie les critères d'acceptation du ticket : appel au backend métier
 * après inscription COMPLETED / COMPLETED_IDEMPOTENT, corps exact, canal,
 * skip des commandes QA, réessais 503→200, échec définitif 401 (alerte,
 * inscription intacte), épuisement des essais (réessayable).
 *
 * HTTP simulé : le module client (axios) est mocké via jest.unstable_mockModule.
 */
import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

// Tester le vrai chemin M2M (mock HTTP via mockM2MPost), pas le mock ATDD
process.env.SAGA_MOCK_MOODLE_ENROLLMENT = 'false';
// Backoff quasi instantané pour les tests de réessai
process.env.COMMISSION_CREDIT_RETRY_DELAY_MS = '10';

// ============================================================
// Mocks ESM avec jest.unstable_mockModule
// ============================================================
const mockDbQuery = jest.fn();
const mockOrderUpdate = jest.fn();
const mockOrderFindOne = jest.fn();
const mockSendEmail = jest.fn().mockResolvedValue({ success: true });
const mockM2MPost = jest.fn();
const mockCreditCommission = jest.fn();
const mockClientIsConfigured = jest.fn().mockReturnValue(true);
const mockAuditLog = jest.fn().mockResolvedValue(true);
const mockNotifyCommissionFailure = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule('../../config/database.js', () => ({
  __esModule: true,
  default: { query: mockDbQuery },
}));

jest.unstable_mockModule('../../models/index.js', () => {
  const literal = jest.fn((str) => `LITERAL:${str}`);
  const escapeFn = jest.fn((str) => str);
  return {
    Order: { update: mockOrderUpdate, findOne: mockOrderFindOne },
    sequelize: { literal, escape: escapeFn, query: mockDbQuery },
  };
});

jest.unstable_mockModule('../../services/mail.service.js', () => ({
  MailService: {
    sendEmail: mockSendEmail,
    sendAdminNotification: jest.fn().mockResolvedValue(true),
  },
}));

jest.unstable_mockModule('../../services/formation-mapping.service.js', () => ({
  FormationMappingService: {
    assertFormationMappable: jest.fn().mockResolvedValue({
      slFormationId: 2,
      moodleCourseId: 40,
      moodleInstanceId: 1,
    }),
    resolveSyncedFormation: jest.fn().mockResolvedValue({
      slFormationId: 2,
      moodleCourseId: 40,
      moodleInstanceId: 1,
    }),
  },
}));

jest.unstable_mockModule('../m2m-http-client.service.js', () => ({
  M2MHttpClient: jest.fn().mockImplementation(() => ({
    post: mockM2MPost,
  })),
}));

jest.unstable_mockModule('../../services/sl-backend-commission.client.js', () => ({
  __esModule: true,
  SlBackendCommissionClient: jest.fn().mockImplementation(() => ({
    isConfigured: mockClientIsConfigured,
    creditCommission: mockCreditCommission,
  })),
  // Même sémantique que l'implémentation réelle
  isRetryableCommissionStatus: (status) => status === 429 || status >= 500,
  isCommissionCreditEnabled: (env = process.env) =>
    String(env.COMMISSION_CREDIT_ENABLED ?? 'true').toLowerCase() !== 'false',
}));

jest.unstable_mockModule('../../services/order-audit.service.js', () => ({
  __esModule: true,
  OrderAuditService: { logSystemAction: mockAuditLog },
}));

jest.unstable_mockModule('../../services/admin-notification.service.js', () => ({
  __esModule: true,
  AdminNotificationService: { notifyCommissionCreditFailure: mockNotifyCommissionFailure },
}));

describe('CommissionCreditStep (intégrée à MoodleHeadlessStrategy)', () => {
  let MoodleHeadlessStrategy, CommissionRetryableError, OrderStatus, strategy;

  const baseEvent = {
    source: 'MOODLE_HEADLESS',
    correlationId: 'corr-com-001',
    payload: {
      customerEmail: 'etudiant@example.com',
      customerName: 'Étudiant',
      customerSurname: 'Test',
      formationId: '42',
      orderReference: 'CMD-COM-001',
      auctionId: null,
    },
  };

  const baseOrder = {
    id: 101,
    reference: 'CMD-COM-001',
    totalAmount: '780.00',
    currency: 'EUR',
    formationId: 42,
    paidAt: new Date('2026-10-06T10:00:00.000Z'),
    metadata: { source: 'MOODLE_HEADLESS', is_headless: true },
  };

  const backendOk = {
    status: 200,
    data: {
      credited: true,
      beneficiary: 'trainer:9',
      walletId: 5,
      amount: '156.00',
      rate: 0.2,
      idempotentReplay: false,
    },
  };

  const auditActions = () => mockAuditLog.mock.calls.map((c) => c[0].action);

  beforeAll(async () => {
    const mod = await import('../strategies/moodle-headless.strategy.js');
    MoodleHeadlessStrategy = mod.MoodleHeadlessStrategy;
    const stepMod = await import('../steps/commission-credit.step.js');
    CommissionRetryableError = stepMod.CommissionRetryableError;
    const enumMod = await import('../../enums/index.js');
    OrderStatus = enumMod.OrderStatus;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Utilisateur existant avec SSO actif → pas de token magique
    mockDbQuery.mockResolvedValue([
      { ID: 777, keycloak_id: 'kc-777', user_pass: '$2a$10$hashedpasswordlong' },
    ]);
    mockM2MPost.mockResolvedValue({
      status: 201,
      data: {
        status: 'success',
        data: { enrollmentId: 'enr-com-1', moodleUserId: 567, moodleCourseId: 101 },
      },
    });
    mockOrderFindOne.mockResolvedValue({ ...baseOrder });
    mockCreditCommission.mockResolvedValue({ ...backendOk });
    strategy = new MoodleHeadlessStrategy();
  });

  afterAll(() => {
    delete process.env.SAGA_MOCK_MOODLE_ENROLLMENT;
    delete process.env.COMMISSION_CREDIT_RETRY_DELAY_MS;
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // Critère 1 : inscription COMPLETED → appel backend, corps exact
  // ─────────────────────────────────────────────────────────
  it('TC-COM-01: enrollment COMPLETED → commission appelée avec le corps exact (montant en chaîne, canal direct par défaut)', async () => {
    const result = await strategy.execute(baseEvent);

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.commissionCredit.credited).toBe(true);
    expect(result.commissionCredit.idempotentReplay).toBe(false);

    expect(mockCreditCommission).toHaveBeenCalledTimes(1);
    expect(mockCreditCommission).toHaveBeenCalledWith(
      {
        orderRef: 'CMD-COM-001',
        formationId: 42,
        studentId: 777,
        grossAmount: '780.00', // chaîne décimale exacte
        currency: 'EUR',
        channel: 'direct', // canal par défaut sans metadata.channel
        paidAt: '2026-10-06T10:00:00.000Z',
        correlationId: 'corr-com-001',
      },
      'corr-com-001',
    );

    // Traces d'audit : demandé + crédité (montant, taux, bénéficiaire)
    expect(auditActions()).toContain('COMMISSION_CREDIT_REQUESTED');
    expect(auditActions()).toContain('COMMISSION_CREDIT_CREDITED');
    const creditedCall = mockAuditLog.mock.calls.find(
      (c) => c[0].action === 'COMMISSION_CREDIT_CREDITED',
    );
    expect(creditedCall[0].newState).toMatchObject({
      credited: true,
      beneficiary: 'trainer:9',
      amount: '156.00',
      rate: 0.2,
    });
    expect(creditedCall[0].orderReference).toBe('CMD-COM-001');
  });

  it('TC-COM-02: metadata.channel autorisé → transmis tel quel ; valeur inconnue → direct ; montant numérique normalisé', async () => {
    // Canal autorisé 'trainer_link' → transmis tel quel
    mockOrderFindOne.mockResolvedValue({
      ...baseOrder,
      totalAmount: 1200.5, // nombre → chaîne décimale exacte
      metadata: { ...baseOrder.metadata, channel: 'trainer_link' },
    });

    await strategy.execute(baseEvent);

    expect(mockCreditCommission).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'trainer_link', grossAmount: '1200.50' }),
      'corr-com-001',
    );

    // Valeur inconnue → 'direct'
    mockCreditCommission.mockClear();
    mockOrderFindOne.mockResolvedValue({
      ...baseOrder,
      metadata: { ...baseOrder.metadata, channel: 'whatsapp' },
    });

    await strategy.execute(baseEvent);

    expect(mockCreditCommission).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'direct' }),
      'corr-com-001',
    );
  });

  // ─────────────────────────────────────────────────────────
  // Critère 3 : commande QA → aucun appel, aucune trace
  // ─────────────────────────────────────────────────────────
  it('TC-COM-03: commande QA (référence QA-… ou indicateur de test) → aucun appel backend, aucune trace d\'audit', async () => {
    // Référence QA-…
    mockOrderFindOne.mockResolvedValue({ ...baseOrder, reference: 'QA-CMD-001' });
    const qaEvent = {
      ...baseEvent,
      payload: { ...baseEvent.payload, orderReference: 'QA-CMD-001' },
    };

    const result = await strategy.execute(qaEvent);

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.commissionCredit).toEqual({ skipped: true, reason: 'qa_order' });
    expect(mockCreditCommission).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
      expect.anything(),
    );

    // Indicateur de test existant dans les métadonnées
    mockCreditCommission.mockClear();
    mockOrderFindOne.mockResolvedValue({
      ...baseOrder,
      metadata: { ...baseOrder.metadata, is_qa: true },
    });

    const result2 = await strategy.execute(baseEvent);
    expect(result2.commissionCredit).toEqual({ skipped: true, reason: 'qa_order' });
    expect(mockCreditCommission).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────
  // Critère 4 : 503 puis 200 → réessai puis succès, trace « créditée »
  // ─────────────────────────────────────────────────────────
  it('TC-COM-04: 503 puis 200 → réessai puis succès, trace d\'audit « créditée »', async () => {
    mockCreditCommission
      .mockResolvedValueOnce({ status: 503, data: { message: 'temporairement indisponible' } })
      .mockResolvedValueOnce({ ...backendOk });

    const result = await strategy.execute(baseEvent);

    expect(mockCreditCommission).toHaveBeenCalledTimes(2);
    expect(result.commissionCredit.credited).toBe(true);
    expect(auditActions()).toContain('COMMISSION_CREDIT_REQUESTED');
    expect(auditActions()).toContain('COMMISSION_CREDIT_CREDITED');
    expect(auditActions()).not.toContain('COMMISSION_CREDIT_FAILED');
  });

  // ─────────────────────────────────────────────────────────
  // Critère 5 : 401 → échec définitif, alerte admin, inscription intacte
  // ─────────────────────────────────────────────────────────
  it('TC-COM-05: 401 → échec définitif (un seul essai), alerte admin, inscription et commande intactes', async () => {
    mockCreditCommission.mockResolvedValueOnce({
      status: 401,
      data: { message: 'Clé interne invalide' },
    });

    const result = await strategy.execute(baseEvent);

    // La stratégie réussit : l'inscription n'est PAS annulée
    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
      expect.anything(),
    );
    expect(mockSendEmail).toHaveBeenCalled();

    // Échec définitif : un seul appel, pas de réessai
    expect(mockCreditCommission).toHaveBeenCalledTimes(1);
    expect(result.commissionCredit.credited).toBe(false);
    expect(result.commissionCredit.definitiveFailure).toBe(true);

    // Trace d'audit « échec » + alerte admin
    expect(auditActions()).toContain('COMMISSION_CREDIT_REQUESTED');
    expect(auditActions()).toContain('COMMISSION_CREDIT_FAILED');
    expect(mockNotifyCommissionFailure).toHaveBeenCalledTimes(1);
    expect(mockNotifyCommissionFailure).toHaveBeenCalledWith(
      'CMD-COM-001',
      expect.objectContaining({ status: 401, error: 'Clé interne invalide' }),
    );
  });

  it('TC-COM-05b: 400 (corps invalide) → échec définitif avec alerte admin', async () => {
    mockCreditCommission.mockResolvedValueOnce({
      status: 400,
      data: { message: 'Invalid payload' },
    });

    const result = await strategy.execute(baseEvent);

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.commissionCredit.definitiveFailure).toBe(true);
    expect(mockNotifyCommissionFailure).toHaveBeenCalledWith(
      'CMD-COM-001',
      expect.objectContaining({ status: 400 }),
    );
  });

  // ─────────────────────────────────────────────────────────
  // Critère 1 (cas idempotent) : 409 inscription → commission + rejeu
  // ─────────────────────────────────────────────────────────
  it('TC-COM-06: inscription 409 (COMPLETED_IDEMPOTENT) → commission déclenchée, rejeu idempotent tracé', async () => {
    mockM2MPost.mockResolvedValueOnce({
      status: 409,
      data: { status: 'conflict', data: { enrollmentId: 'existing-uuid' } },
    });
    mockCreditCommission.mockResolvedValueOnce({
      status: 200,
      data: { ...backendOk.data, idempotentReplay: true },
    });

    const result = await strategy.execute(baseEvent);

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED_IDEMPOTENT');
    expect(mockCreditCommission).toHaveBeenCalledTimes(1);
    expect(result.commissionCredit.credited).toBe(true);
    expect(result.commissionCredit.idempotentReplay).toBe(true);

    // Trace « rejeu idempotent »
    expect(auditActions()).toContain('COMMISSION_CREDIT_REQUESTED');
    expect(auditActions()).toContain('COMMISSION_CREDIT_REPLAY');
  });

  // ─────────────────────────────────────────────────────────
  // Fiabilité : épuisement des essais → réessayable, inscription acquise
  // ─────────────────────────────────────────────────────────
  it('TC-COM-07: 503 persistant → CommissionRetryableError après 3 essais, inscription déjà acquise (COMPLETED)', async () => {
    mockCreditCommission.mockResolvedValue({
      status: 503,
      data: { message: 'indisponible' },
    });

    await expect(strategy.execute(baseEvent)).rejects.toThrow(CommissionRetryableError);

    // 3 essais internes (backoff exponentiel 10ms, 20ms)
    expect(mockCreditCommission).toHaveBeenCalledTimes(3);

    // L'inscription a déjà été faite AVANT l'échec du crédit
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
      expect.anything(),
    );

    // Trace « échec » (réessayable, pas d'alerte admin immédiate)
    expect(auditActions()).toContain('COMMISSION_CREDIT_FAILED');
    expect(mockNotifyCommissionFailure).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────
  // Configuration : désactivée / non configurée → skip sans appel
  // ─────────────────────────────────────────────────────────
  it('TC-COM-08: COMMISSION_CREDIT_ENABLED=false → aucun appel au backend', async () => {
    process.env.COMMISSION_CREDIT_ENABLED = 'false';
    try {
      const result = await strategy.execute(baseEvent);
      expect(result.commissionCredit).toEqual({ skipped: true, reason: 'disabled' });
      expect(mockCreditCommission).not.toHaveBeenCalled();
      expect(mockAuditLog).not.toHaveBeenCalled();
    } finally {
      delete process.env.COMMISSION_CREDIT_ENABLED;
    }
  });

  it('TC-COM-09: SL_BACKEND_URL / INTERNAL_API_KEY absents → skip sans échec', async () => {
    mockClientIsConfigured.mockReturnValueOnce(false);

    const result = await strategy.execute(baseEvent);

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.commissionCredit).toEqual({ skipped: true, reason: 'not_configured' });
    expect(mockCreditCommission).not.toHaveBeenCalled();
  });

  it('TC-COM-10: paidAt absent → date du jour en ISO 8601', async () => {
    const before = new Date();
    mockOrderFindOne.mockResolvedValue({ ...baseOrder, paidAt: null });

    await strategy.execute(baseEvent);

    const call = mockCreditCommission.mock.calls[0];
    expect(call[0].paidAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(call[0].paidAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
