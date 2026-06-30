/**
 * Tests unitaires — MoodleHeadlessStrategy
 * Mode ESM : utilise jest.unstable_mockModule + imports dynamiques
 */
import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';

// ============================================================
// Mocks ESM avec jest.unstable_mockModule
// ============================================================
const mockDbQuery = jest.fn();
const mockOrderUpdate = jest.fn();
const mockSendEmail = jest.fn().mockResolvedValue({ success: true });
const mockM2MPost = jest.fn();

jest.unstable_mockModule('../../config/database.js', () => ({
  __esModule: true,
  default: { query: mockDbQuery },
}));

jest.unstable_mockModule('../../models/index.js', () => {
  const literal = jest.fn((str) => `LITERAL:${str}`);
  const escapeFn = jest.fn((str) => str);
  return {
    Order: { update: mockOrderUpdate },
    sequelize: { literal, escape: escapeFn },
  };
});

jest.unstable_mockModule('../../services/mail.service.js', () => ({
  MailService: { sendEmail: mockSendEmail },
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

describe('MoodleHeadlessStrategy', () => {
  let MoodleHeadlessStrategy, MoodleRetryableError, OrderStatus, strategy;

  const baseEvent = {
    source: 'MOODLE_HEADLESS',
    correlationId: 'test-correlation-sso-001',
    payload: {
      customerEmail: 'booalbert60@gmail.com',
      customerName: 'Albert',
      customerSurname: 'Boo',
      formationId: '42',
      orderReference: 'CMD-SSO-001',
      auctionId: null,
    },
  };

  beforeAll(async () => {
    const mod = await import('../strategies/moodle-headless.strategy.js');
    MoodleHeadlessStrategy = mod.MoodleHeadlessStrategy;
    MoodleRetryableError = mod.MoodleRetryableError;
    const enumMod = await import('../../enums/index.js');
    OrderStatus = enumMod.OrderStatus;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new MoodleHeadlessStrategy();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('TC-SSO-01: should create user, call M2M, mark COMPLETED, send email', async () => {
    mockDbQuery
      .mockResolvedValueOnce([])              // SELECT → pas trouvé
      .mockResolvedValueOnce([12345]);         // INSERT → ID créé

    mockM2MPost.mockResolvedValueOnce({
      status: 201,
      data: {
        status: 'success',
        data: { enrollmentId: 'enr-uuid-123', moodleUserId: 567, moodleCourseId: 101 },
      },
    });

    const result = await strategy.execute(baseEvent);

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.keycloakPending).toBe(true);
    expect(result.userId).toBe(12345);
    expect(result.activationLink).toContain('/auth/activate');

    expect(mockM2MPost).toHaveBeenCalledWith(
      '/api/v1/authoring/enrollments',
      expect.objectContaining({ email: 'booalbert60@gmail.com', formationId: '42' }),
      expect.any(String)
    );
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
      expect.objectContaining({ where: { reference: 'CMD-SSO-001' } })
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Activez votre compte SSO') })
    );
  });

  it('TC-SSO-02: should skip creation if user exists (SSO pending)', async () => {
    mockDbQuery.mockResolvedValueOnce([{ ID: 999, keycloak_id: null, user_pass: '' }]);
    mockM2MPost.mockResolvedValueOnce({
      status: 201,
      data: { status: 'success', data: { enrollmentId: 'enr-uuid-456' } },
    });

    const result = await strategy.execute(baseEvent);
    expect(result.success).toBe(true);
    expect(result.userId).toBe(999);
  });

  it('TC-SSO-02b: existing user with active SSO gets login email only', async () => {
    mockDbQuery.mockResolvedValueOnce([
      { ID: 888, keycloak_id: 'kc-existing', user_pass: '$2a$10$hashedpasswordhere' },
    ]);
    mockM2MPost.mockResolvedValueOnce({
      status: 201,
      data: { status: 'success', data: { enrollmentId: 'enr-existing' } },
    });

    const result = await strategy.execute(baseEvent);
    expect(result.success).toBe(true);
    expect(result.keycloakPending).toBe(false);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('formation est disponible') }),
    );
  });

  it('TC-SSO-03: should treat 409 as success (idempotent)', async () => {
    mockDbQuery.mockResolvedValueOnce([{ ID: 111, keycloak_id: null, user_pass: '' }]);
    mockM2MPost.mockResolvedValueOnce({
      status: 409,
      data: { status: 'conflict', data: { enrollmentId: 'existing-uuid' } },
    });

    const result = await strategy.execute(baseEvent);
    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED_IDEMPOTENT');
  });

  it('TC-SSO-04: should mark FAILED on 422', async () => {
    mockDbQuery.mockResolvedValueOnce([{ ID: 222, keycloak_id: null }]);
    mockM2MPost.mockResolvedValueOnce({
      status: 422,
      data: { code: 'INVALID_FORMATION', message: 'Formation not found' },
    });

    const result = await strategy.execute(baseEvent);
    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED_INVALID_FORMATION');
  });

  it('TC-SSO-05: should throw MoodleRetryableError on 503', async () => {
    mockDbQuery.mockResolvedValueOnce([{ ID: 333, keycloak_id: null }]);
    mockM2MPost.mockResolvedValueOnce({
      status: 503,
      data: { code: 'MOODLE_UNAVAILABLE', message: 'Under maintenance' },
    });

    await expect(strategy.execute(baseEvent)).rejects.toThrow(MoodleRetryableError);
  });
});