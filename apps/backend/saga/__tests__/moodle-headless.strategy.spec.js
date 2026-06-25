/**
 * Tests unitaires — MoodleHeadlessStrategy
 *
 * Valide le comportement SSO Keycloak, l'appel M2M à l'Authoring Engine,
 * la création d'utilisateurs, et la gestion des codes retour.
 *
 * Scénarios :
 * TC-SSO-01 : Nouvel utilisateur → création kyd4_users + M2M + email
 * TC-SSO-02 : Utilisateur existant → pas de création + M2M direct
 * TC-SSO-03 : Idempotence (409) → traité comme succès, COMPLETED
 * TC-SSO-04 : Formation invalide (422) → FAILED définitif
 * TC-SSO-05 : Moodle down (503) → MoodleRetryableError
 */
import { MoodleHeadlessStrategy, MoodleRetryableError } from '../strategies/moodle-headless.strategy.js';
import { M2MHttpClient } from '../m2m-http-client.service.js';
import { OrderStatus } from '../../enums/index.js';

// Mocks
jest.mock('../../config/database.js', () => ({
  __esModule: true,
  default: {},
  QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' },
}));

jest.mock('../../models/index.js', () => {
  const mockSequelize = {
    literal: jest.fn((str) => `LITERAL:${str}`),
    escape: jest.fn((str) => `'ESCAPED:${str}'`),
  };
  return {
    Order: { update: jest.fn() },
    sequelize: mockSequelize,
  };
});

jest.mock('sequelize', () => ({
  QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' },
}));

jest.mock('../../services/mail.service.js', () => ({
  MailService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../m2m-http-client.service.js', () => {
  return {
    M2MHttpClient: jest.fn().mockImplementation(() => ({
      post: jest.fn(),
    })),
  };
});

describe('MoodleHeadlessStrategy', () => {
  let strategy;
  let mockM2MPost;

  const baseEvent = {
    source: 'MOODLE_HEADLESS',
    correlationId: 'test-correlation-sso-001',
    payload: {
      customerEmail: 'jean.dupont@example.com',
      customerName: 'Jean',
      customerSurname: 'Dupont',
      formationId: '42',
      orderReference: 'CMD-SSO-001',
      auctionId: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new MoodleHeadlessStrategy();
    mockM2MPost = strategy.m2mClient.post;
  });

  // ─────────────────────────────────────────────────────────
  // TC-SSO-01 : Nouvel utilisateur → création + M2M + email
  // ─────────────────────────────────────────────────────────
  describe('TC-SSO-01: New user — created in kyd4_users, M2M called, email sent', () => {
    it('should create user in kyd4_users with keycloak_id=NULL, call M2M, and send welcome email', async () => {
      // Mock : utilisateur NON trouvé en base → création
      const sequelizeMock = require('sequelize');
      const { sequelize } = require('../../models/index.js');

      // Simuler le comportement de sequelize.query pour resolveUser
      const mockQuery = jest.spyOn(require('../../config/database.js').default, 'query')
        .mockImplementation(async (sql, options) => {
          // Premier appel : SELECT kyd4_users (pas trouvé)
          if (sql.includes('SELECT ID, keycloak_id FROM kyd4_users')) {
            return [];
          }
          // Second appel : INSERT kyd4_users
          if (sql.includes('INSERT INTO kyd4_users')) {
            return [12345]; // ID créé
          }
          return [];
        });

      // Mock M2M : réponse 201
      mockM2MPost.mockResolvedValueOnce({
        status: 201,
        data: {
          status: 'success',
          data: {
            enrollmentId: 'enr-uuid-123',
            moodleUserId: 567,
            moodleCourseId: 101,
            formationId: '42',
            email: 'jean.dupont@example.com',
            enrolledAt: new Date().toISOString(),
          },
        },
      });

      const result = await strategy.execute(baseEvent);

      // Vérifications
      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.keycloakPending).toBe(true);
      expect(result.userId).toBe(12345);
      expect(result.activationLink).toContain('/auth/activate');

      // Vérifier que M2M a été appelé avec les bons paramètres
      expect(mockM2MPost).toHaveBeenCalledWith(
        '/api/v1/authoring/enrollments',
        expect.objectContaining({
          email: 'jean.dupont@example.com',
          formationId: '42',
          orderReference: 'CMD-SSO-001',
        }),
        expect.any(String)
      );

      // Vérifier que la commande est marquée COMPLETED
      const { Order } = require('../../models/index.js');
      expect(Order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OrderStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
        expect.objectContaining({
          where: { reference: 'CMD-SSO-001' },
        })
      );

      // Vérifier que l'email a été envoyé
      const { MailService } = require('../../services/mail.service.js');
      expect(MailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Activez votre compte SSO'),
        })
      );

      // Nettoyage
      mockQuery.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-SSO-02 : Utilisateur existant → pas de création, M2M direct
  // ─────────────────────────────────────────────────────────
  describe('TC-SSO-02: Existing user — no creation, direct M2M call', () => {
    it('should not create user if already exists in kyd4_users, and proceed to M2M call', async () => {
      const sequelizeMock = require('sequelize');
      const { sequelize } = require('../../models/index.js');

      // Mock : utilisateur EXISTE déjà
      const mockQuery = jest.spyOn(require('../../config/database.js').default, 'query')
        .mockImplementation(async (sql) => {
          if (sql.includes('SELECT ID, keycloak_id FROM kyd4_users')) {
            return [{ ID: 999, keycloak_id: null }];
          }
          return [];
        });

      mockM2MPost.mockResolvedValueOnce({
        status: 201,
        data: { status: 'success', data: { enrollmentId: 'enr-uuid-456', moodleUserId: 777 } },
      });

      const result = await strategy.execute(baseEvent);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(999);

      // Vérifier que l'INSERT n'a PAS été appelé
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kyd4_users'),
        expect.any(Object)
      );

      mockQuery.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-SSO-03 : Idempotence (409) → traité comme succès
  // ─────────────────────────────────────────────────────────
  describe('TC-SSO-03: Idempotence — 409 treated as success', () => {
    it('should treat 409 Conflict as success and mark order as COMPLETED', async () => {
      const mockQuery = jest.spyOn(require('../../config/database.js').default, 'query')
        .mockImplementation(async (sql) => {
          if (sql.includes('SELECT ID, keycloak_id FROM kyd4_users')) {
            return [{ ID: 111, keycloak_id: null }];
          }
          return [];
        });

      // M2M retourne 409 (déjà inscrit)
      mockM2MPost.mockResolvedValueOnce({
        status: 409,
        data: {
          status: 'conflict',
          data: {
            enrollmentId: 'existing-enr-uuid',
            message: 'User already enrolled in this formation',
          },
        },
      });

      const result = await strategy.execute(baseEvent);

      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED_IDEMPOTENT');

      // La commande doit être marquée COMPLETED (pas FAILED)
      const { Order } = require('../../models/index.js');
      expect(Order.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.COMPLETED }),
        expect.any(Object)
      );

      mockQuery.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-SSO-04 : Formation invalide (422) → FAILED définitif
  // ─────────────────────────────────────────────────────────
  describe('TC-SSO-04: Invalid formation — 422 leads to FAILED', () => {
    it('should mark order as FAILED and NOT throw retryable error', async () => {
      const mockQuery = jest.spyOn(require('../../config/database.js').default, 'query')
        .mockImplementation(async (sql) => {
          if (sql.includes('SELECT ID, keycloak_id FROM kyd4_users')) {
            return [{ ID: 222, keycloak_id: null }];
          }
          return [];
        });

      mockM2MPost.mockResolvedValueOnce({
        status: 422,
        data: {
          status: 'error',
          code: 'INVALID_FORMATION',
          message: 'Formation #999 not found in Moodle',
        },
      });

      const result = await strategy.execute(baseEvent);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED_INVALID_FORMATION');

      // Vérifier que l'erreur N'EST PAS retryable (pas de MoodleRetryableError)
      const { Order } = require('../../models/index.js');
      expect(Order.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.FAILED }),
        expect.any(Object)
      );

      mockQuery.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-SSO-05 : Moodle down (503) → MoodleRetryableError
  // ─────────────────────────────────────────────────────────
  describe('TC-SSO-05: Moodle unavailable — 503 throws MoodleRetryableError', () => {
    it('should throw MoodleRetryableError when Authoring Engine returns 503', async () => {
      const mockQuery = jest.spyOn(require('../../config/database.js').default, 'query')
        .mockImplementation(async (sql) => {
          if (sql.includes('SELECT ID, keycloak_id FROM kyd4_users')) {
            return [{ ID: 333, keycloak_id: null }];
          }
          return [];
        });

      mockM2MPost.mockResolvedValueOnce({
        status: 503,
        data: { code: 'MOODLE_UNAVAILABLE', message: 'Moodle is under maintenance' },
      });

      // Une retryable error DOIT être levée pour que BullMQ retente
      await expect(strategy.execute(baseEvent)).rejects.toThrow(MoodleRetryableError);

      // La commande ne doit PAS être marquée FAILED (BullMQ retry)
      const { Order } = require('../../models/index.js');
      expect(Order.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.FAILED }),
        expect.any(Object)
      );

      mockQuery.mockRestore();
    });

    it('should throw MoodleRetryableError when M2M network fails (ECONNREFUSED)', async () => {
      const mockQuery = jest.spyOn(require('../../config/database.js').default, 'query')
        .mockImplementation(async (sql) => {
          if (sql.includes('SELECT ID, keycloak_id FROM kyd4_users')) {
            return [{ ID: 444, keycloak_id: null }];
          }
          return [];
        });

      // Simuler une panne réseau → M2MHttpClient retourne 503
      mockM2MPost.mockResolvedValueOnce({
        status: 503,
        data: { code: 'MOODLE_UNREACHABLE', message: 'ECONNREFUSED localhost:4001' },
      });

      await expect(strategy.execute(baseEvent)).rejects.toThrow(MoodleRetryableError);

      mockQuery.mockRestore();
    });
  });
});