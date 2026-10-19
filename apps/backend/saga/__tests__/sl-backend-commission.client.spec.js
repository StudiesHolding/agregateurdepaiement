/**
 * Tests unitaires — SlBackendCommissionClient (S1-5)
 * HTTP simulé via mock du module axios.
 */
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Configuration simulée (nettoyée dans afterAll)
process.env.SL_BACKEND_URL = 'http://sl-backend-test.local';
process.env.INTERNAL_API_KEY = 'test-internal-key';

const mockAxios = jest.fn();

jest.unstable_mockModule('axios', () => ({
  __esModule: true,
  default: mockAxios,
}));

describe('SlBackendCommissionClient', () => {
  let SlBackendCommissionClient,
    isRetryableCommissionStatus,
    isCommissionCreditEnabled,
    validateCommissionCreditConfig,
    COMMISSION_CREDIT_PATH;

  beforeAll(async () => {
    const mod = await import('../../services/sl-backend-commission.client.js');
    SlBackendCommissionClient = mod.SlBackendCommissionClient;
    isRetryableCommissionStatus = mod.isRetryableCommissionStatus;
    isCommissionCreditEnabled = mod.isCommissionCreditEnabled;
    validateCommissionCreditConfig = mod.validateCommissionCreditConfig;
    COMMISSION_CREDIT_PATH = mod.COMMISSION_CREDIT_PATH;
  });

  afterAll(() => {
    delete process.env.SL_BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;
    delete process.env.COMMISSION_CREDIT_TIMEOUT_MS;
    jest.restoreAllMocks();
  });

  it('TC-CLIENT-01: posts to /api/internal/payments/confirmed with X-Internal-Api-Key, 10s timeout, and returns { status, data }', async () => {
    const client = new SlBackendCommissionClient();
    expect(client.isConfigured()).toBe(true);

    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { credited: true, beneficiary: 'trainer:9', amount: '156.00', rate: 0.2 },
    });

    const payload = {
      orderRef: 'CMD-X-1',
      formationId: 42,
      studentId: 777,
      grossAmount: '780.00',
      currency: 'EUR',
      channel: 'direct',
      paidAt: '2026-10-06T10:00:00.000Z',
      correlationId: 'corr-client-1',
    };

    const result = await client.creditCommission(payload, 'corr-client-1');

    expect(result).toEqual({
      status: 200,
      data: { credited: true, beneficiary: 'trainer:9', amount: '156.00', rate: 0.2 },
    });
    expect(mockAxios).toHaveBeenCalledWith({
      method: 'post',
      url: `http://sl-backend-test.local${COMMISSION_CREDIT_PATH}`,
      data: payload,
      headers: {
        'X-Internal-Api-Key': 'test-internal-key',
        'Content-Type': 'application/json',
        'x-correlation-id': 'corr-client-1',
      },
      timeout: 10000, // délai 10 s par défaut
      validateStatus: null, // tous les codes HTTP gérés par l'appelant
    });
  });

  it('TC-CLIENT-02: network error is normalized to a retryable 503', async () => {
    const client = new SlBackendCommissionClient();
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:80');
    networkError.code = 'ECONNREFUSED';
    mockAxios.mockRejectedValueOnce(networkError);

    const result = await client.creditCommission({ orderRef: 'CMD-X-2' }, 'corr-client-2');

    expect(result.status).toBe(503);
    expect(result.data.code).toBe('SL_BACKEND_UNREACHABLE');
    expect(isRetryableCommissionStatus(result.status)).toBe(true);
  });

  it('TC-CLIENT-03: isConfigured() is false and creditCommission throws when env is missing', async () => {
    const savedUrl = process.env.SL_BACKEND_URL;
    const savedKey = process.env.INTERNAL_API_KEY;
    delete process.env.SL_BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;

    const client = new SlBackendCommissionClient();
    expect(client.isConfigured()).toBe(false);
    await expect(client.creditCommission({ orderRef: 'CMD-X-3' }, 'c')).rejects.toThrow(
      /SL_BACKEND_URL/,
    );

    process.env.SL_BACKEND_URL = savedUrl;
    process.env.INTERNAL_API_KEY = savedKey;
  });

  it('TC-CLIENT-04: timeout is configurable via COMMISSION_CREDIT_TIMEOUT_MS', async () => {
    process.env.COMMISSION_CREDIT_TIMEOUT_MS = '2500';
    const client = new SlBackendCommissionClient();
    expect(client.timeout).toBe(2500);
    delete process.env.COMMISSION_CREDIT_TIMEOUT_MS;
  });

  it('TC-CLIENT-05: retryability classification — 429/5xx retryable, 400/401/200 definitive', () => {
    expect(isRetryableCommissionStatus(429)).toBe(true);
    expect(isRetryableCommissionStatus(500)).toBe(true);
    expect(isRetryableCommissionStatus(503)).toBe(true);
    expect(isRetryableCommissionStatus(502)).toBe(true);
    expect(isRetryableCommissionStatus(400)).toBe(false);
    expect(isRetryableCommissionStatus(401)).toBe(false);
    expect(isRetryableCommissionStatus(200)).toBe(false);
    expect(isRetryableCommissionStatus(404)).toBe(false);
  });

  it('TC-CLIENT-06: validateCommissionCreditConfig — startup refuses outside test when enabled and missing', () => {
    // Activée par défaut + variables absentes → invalide hors test
    const missing = validateCommissionCreditConfig({
      NODE_ENV: 'production',
      SL_BACKEND_URL: undefined,
      INTERNAL_API_KEY: undefined,
    });
    expect(missing.enabled).toBe(true);
    expect(missing.valid).toBe(false);
    expect(missing.missing).toEqual(['SL_BACKEND_URL', 'INTERNAL_API_KEY']);

    // En test : toléré (les tests n'ont pas besoin de la configuration)
    const inTest = validateCommissionCreditConfig({ NODE_ENV: 'test' });
    expect(inTest.valid).toBe(true);

    // Configurée → valide
    const configured = validateCommissionCreditConfig({
      NODE_ENV: 'production',
      SL_BACKEND_URL: 'http://sl.local',
      INTERNAL_API_KEY: 'key',
    });
    expect(configured.valid).toBe(true);
    expect(configured.missing).toEqual([]);

    // Désactivée explicitement → toujours valide
    const disabled = validateCommissionCreditConfig({
      NODE_ENV: 'production',
      COMMISSION_CREDIT_ENABLED: 'false',
    });
    expect(disabled.enabled).toBe(false);
    expect(disabled.valid).toBe(true);
  });

  it('TC-CLIENT-07: isCommissionCreditEnabled — default true, only "false" disables', () => {
    expect(isCommissionCreditEnabled({})).toBe(true);
    expect(isCommissionCreditEnabled({ COMMISSION_CREDIT_ENABLED: 'false' })).toBe(false);
    expect(isCommissionCreditEnabled({ COMMISSION_CREDIT_ENABLED: 'FALSE' })).toBe(false);
    expect(isCommissionCreditEnabled({ COMMISSION_CREDIT_ENABLED: 'true' })).toBe(true);
  });
});
