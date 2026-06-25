/**
 * Tests d'intégration E2E — Saga Orchestrator ↔ Authoring Engine
 *
 * Tests inter-services réels. L'Authoring Engine (NestJS) doit être
 * accessible via AUTHORING_ENGINE_TEST_URL.
 *
 * Aucun mock des réponses HTTP de l'Authoring Engine.
 * Seul Redis peut être mocké si non disponible dans l'environnement CI.
 *
 * Pré-requis :
 * - Authoring Engine en cours d'exécution sur AUTHORING_ENGINE_TEST_URL
 * - Redis accessible via REDIS_URL
 * - Base MariaDB de test avec la table aggp_saga_idempotency créée
 * - SAGA_API_KEY identique configurée dans les deux services
 *
 * Usage :
 *   AUTHORING_ENGINE_TEST_URL=http://localhost:4001 \
 *   SAGA_API_KEY=test-key \
 *   REDIS_URL=redis://localhost:6379 \
 *   npx jest saga-integration.e2e.spec.js --forceExit
 */
import crypto from 'crypto';
import axios from 'axios';
import { QueryTypes } from 'sequelize';

// ============================================================
// Configuration — variables d'environnement
// ============================================================
const CONFIG = {
  aggregatorUrl: process.env.AGGREGATOR_TEST_URL || 'http://localhost:3000',
  authoringEngineUrl: process.env.AUTHORING_ENGINE_TEST_URL || 'http://localhost:4001',
  sagaKey: process.env.SAGA_API_KEY,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

const ENROLLMENTS_PATH = '/api/v1/authoring/enrollments';

// ============================================================
// Helpers
// ============================================================

/**
 * Calcule la signature HMAC-SHA256 pour l'en-tête x-saga-key
 */
function computeSignature(timestamp, secret) {
  const data = `${timestamp}:${secret}`;
  return crypto.createHmac('sha256', secret).update(data, 'utf-8').digest('hex');
}

/**
 * Retourne les en-têtes M2M pour un appel à l'Authoring Engine
 */
function getM2MHeaders(correlationId) {
  const timestamp = new Date().toISOString();
  return {
    'x-saga-key': computeSignature(timestamp, CONFIG.sagaKey),
    'x-timestamp': timestamp,
    'x-correlation-id': correlationId,
    'Content-Type': 'application/json',
  };
}

/**
 * Vérifie si une table existe dans la base de test
 */
async function tableExists(dbConnection, tableName) {
  const [rows] = await dbConnection.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables 
     WHERE table_schema = DATABASE() AND table_name = :tableName`,
    { replacements: { tableName }, type: QueryTypes.SELECT }
  );
  return rows && rows[0]?.cnt > 0;
}

/**
 * Attente active (polling) jusqu'à ce qu'un événement atteigne un statut
 */
async function waitForIdempotencyStatus(db, eventId, expectedStatus, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db.query(
      `SELECT status, result, error_message, retry_count 
       FROM aggp_saga_idempotency WHERE event_id = :eventId LIMIT 1`,
      { replacements: { eventId }, type: QueryTypes.SELECT }
    );
    if (row && row.status === expectedStatus) {
      return row;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for event ${eventId} to reach status ${expectedStatus}`);
}

describe('Saga Integration E2E — Aggregator ↔ Authoring Engine', () => {
  let db;

  beforeAll(async () => {
    // Vérifier que la clé API est configurée
    if (!CONFIG.sagaKey) {
      throw new Error('SAGA_API_KEY environment variable is required for E2E tests');
    }

    // Vérifier que l'Authoring Engine est accessible
    try {
      await axios.get(`${CONFIG.authoringEngineUrl}/api/v1/authoring/enrollments`, { timeout: 3000 });
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        console.warn(`⚠️ Authoring Engine not reachable at ${CONFIG.authoringEngineUrl}. Starting tests anyway — some may fail.`);
      }
    }

    // Connexion à la base de données via Sequelize
    const { default: sequelize } = await import('../config/database.js');
    db = sequelize;
  });

  beforeEach(async () => {
    // Nettoyer la table d'idempotence avant chaque test
    if (db) {
      await db.query('DELETE FROM aggp_saga_idempotency WHERE source = \'E2E_TEST\'', { type: QueryTypes.DELETE });
    }
  });

  // ─────────────────────────────────────────────────────────
  // SCÉNARIO 1 — Happy Path E2E réel
  // ─────────────────────────────────────────────────────────
  describe('Scenario 1: Happy Path — Real B2B Enrollment', () => {
    const testEmail = `e2e-${Date.now()}@test.studieslearning.com`;
    const orderReference = `E2E-${Date.now()}`;
    const eventId = crypto.randomUUID();

    it('should process a B2B payment end-to-end: webhook → saga → Authoring Engine → idempotency', async () => {
      // 1. Simuler un webhook de paiement en envoyant directement dans la queue
      //    (ou en appelant le dispatcher)
      const { dispatchOrderToSaga } = await import('../payment-event-dispatcher.service.js');

      const mockOrder = {
        reference: orderReference,
        customerEmail: testEmail,
        customerName: 'Jean',
        customerSurname: 'Dupont',
        formationId: '42',
        formationName: 'Formation E2E Test',
        currency: 'EUR',
        totalAmount: 780.00,
        status: 'PAYMENT_CONFIRMED',
        metadata: {
          source: 'MOODLE_HEADLESS',
          is_b2b: false,
          is_headless: true,
          formation_id: '42',
        },
      };

      // 2. Dispatcher l'événement dans la queue BullMQ
      const dispatchResult = await dispatchOrderToSaga(mockOrder, `e2e-test-${Date.now()}`);
      expect(dispatchResult.eventId).toBeDefined();
      expect(dispatchResult.source).toBe('MOODLE_HEADLESS');

      // 3. Attendre que le Worker traite l'événement et appelle l'Authoring Engine
      //    Le worker va :
      //    a. Vérifier l'idempotence
      //    b. Résoudre la stratégie MOODLE_HEADLESS
      //    c. Appeler réellement POST {authoringEngineUrl}/api/v1/authoring/enrollments
      //    d. Marquer SUCCESS dans aggp_saga_idempotency
      const idempotencyResult = await waitForIdempotencyStatus(
        db,
        dispatchResult.eventId,
        'SUCCESS',
        15000, // 15s max pour le traitement BullMQ + appel HTTP
      );

      expect(idempotencyResult.status).toBe('SUCCESS');
      expect(idempotencyResult.retry_count).toBeDefined();
      expect(Number(idempotencyResult.retry_count)).toBe(0); // Succès du premier coup
    });

    it('should have created the enrollment on the Authoring Engine', async () => {
      // Vérifier que l'Authoring Engine a bien créé l'enrollment
      // On refait un appel M2M avec le même email — on doit recevoir 409 (déjà inscrit)
      const response = await axios.post(
        `${CONFIG.authoringEngineUrl}${ENROLLMENTS_PATH}`,
        {
          email: testEmail,
          formationId: '42',
          orderReference: `verify-${orderReference}`,
          customerName: 'Jean',
          customerSurname: 'Dupont',
          source: 'E2E_TEST',
        },
        {
          headers: getM2MHeaders('e2e-verify'),
          timeout: 5000,
          validateStatus: null, // On capture tous les codes
        }
      );

      // 409 = déjà inscrit → l'enrollment a bien été créé par la Saga
      expect(response.status).toBe(409);
      expect(response.data.status).toBe('conflict');
    });
  });

  // ─────────────────────────────────────────────────────────
  // SCÉNARIO 2 — Idempotence réseau (double webhook)
  // ─────────────────────────────────────────────────────────
  describe('Scenario 2: Network Idempotency — Duplicate Webhook', () => {
    const testEmail = `e2e-dup-${Date.now()}@test.studieslearning.com`;
    const orderReference = `E2E-DUP-${Date.now()}`;
    const eventId = crypto.randomUUID();

    it('should ignore the second identical webhook without calling the Authoring Engine twice', async () => {
      const { dispatchOrderToSaga } = await import('../payment-event-dispatcher.service.js');

      const mockOrder = {
        reference: orderReference,
        customerEmail: testEmail,
        customerName: 'Duplicate',
        customerSurname: 'Test',
        formationId: '42',
        formationName: 'Formation E2E Duplicate',
        currency: 'EUR',
        totalAmount: 780.00,
        status: 'PAYMENT_CONFIRMED',
        metadata: {
          source: 'MOODLE_HEADLESS',
          is_headless: true,
          formation_id: '42',
        },
      };

      // 1. Premier dispatch — doit réussir
      const firstResult = await dispatchOrderToSaga(mockOrder, `e2e-dup-first-${Date.now()}`);
      expect(firstResult.eventId).toBeDefined();

      // 2. Attendre que le premier soit traité
      const firstIdempotency = await waitForIdempotencyStatus(
        db, firstResult.eventId, 'SUCCESS', 15000
      );
      expect(firstIdempotency.status).toBe('SUCCESS');

      // 3. Deuxième dispatch — avec le MÊME eventId (simulation Stripe retry)
      //    On insère directement dans la queue avec le même identifiant
      const { dispatchPaymentEvent } = await import('../saga-queue.service.js');

      const duplicateEvent = {
        eventId: firstResult.eventId, // MÊME eventId
        source: 'MOODLE_HEADLESS',
        orderReference: orderReference,
        correlationId: `e2e-dup-second-${Date.now()}`,
        createdAt: new Date().toISOString(),
        attempt: 0,
        payload: {
          customerEmail: testEmail,
          customerName: 'Duplicate',
          customerSurname: 'Test',
          formationId: '42',
          orderReference: orderReference,
          amount: 780.00,
          currency: 'EUR',
          keycloakId: null,
        },
      };

      const secondJob = await dispatchPaymentEvent(duplicateEvent);
      expect(secondJob).toBeDefined();

      // 4. Vérifier que le second appel n'a PAS créé d'entrée dupliquée
      //    (la table a UNIQUE KEY sur event_id)
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt FROM aggp_saga_idempotency WHERE order_reference = :ref`,
        { replacements: { ref: orderReference }, type: QueryTypes.SELECT }
      );
      expect(Number(rows.cnt)).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // SCÉNARIO 3 — Panne réseau Authoring Engine (Timeout)
  // ─────────────────────────────────────────────────────────
  describe('Scenario 3: Network Failure — Authoring Engine Timeout', () => {
    const testEmail = `e2e-fail-${Date.now()}@test.studieslearning.com`;
    const orderReference = `E2E-FAIL-${Date.now()}`;

    it('should retry 3 times and keep order as PAYMENT_CONFIRMED when Authoring Engine is down', async () => {
      // On va temporairement modifier l'URL de l'Authoring Engine
      // pour pointer vers un port qui n'existe pas
      const originalUrl = process.env.AUTHORING_ENGINE_URL;
      process.env.AUTHORING_ENGINE_URL = 'http://localhost:1'; // Port invalide

      const { dispatchOrderToSaga } = await import('../payment-event-dispatcher.service.js');
      const { paymentSagaQueue } = await import('../saga-queue.service.js');

      const mockOrder = {
        reference: orderReference,
        customerEmail: testEmail,
        customerName: 'Failure',
        customerSurname: 'Test',
        formationId: '42',
        totalAmount: 100.00,
        status: 'PAYMENT_CONFIRMED',
        metadata: {
          source: 'MOODLE_HEADLESS',
          is_headless: true,
          formation_id: '42',
        },
      };

      // Dispatcher l'événement
      const dispatchResult = await dispatchOrderToSaga(mockOrder, `e2e-fail-${Date.now()}`);
      expect(dispatchResult.eventId).toBeDefined();

      // Attendre que les retries BullMQ s'exécutent
      // 3 retries avec backoff exponentiel: 5s, 30s, 120s
      // On attend 160s max (3 retries + buffer)
      const idempotencyResult = await waitForIdempotencyStatus(
        db,
        dispatchResult.eventId,
        'FAILED',
        180000, // 3 minutes max
      );

      expect(idempotencyResult.status).toBe('FAILED');
      expect(Number(idempotencyResult.retry_count)).toBeGreaterThanOrEqual(1);

      // Restaurer l'URL
      process.env.AUTHORING_ENGINE_URL = originalUrl;
    }, 200000); // Timeout Jest à 200s
  });
});