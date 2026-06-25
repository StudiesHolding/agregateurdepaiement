/**
 * PaymentSagaWorker
 *
 * Worker BullMQ qui traite les événements de la file 'saga-payment'.
 * Pour chaque événement :
 * 1. Vérifie l'idempotence (table aggp_saga_idempotency)
 * 2. Résout la stratégie via StrategyFactory
 * 3. Exécute la stratégie
 * 4. Marque l'idempotence comme COMPLETED
 *
 * Démarrage : importé dans server.js ou via un processus séparé
 */
import { Worker } from 'bullmq';
import { createSagaWorker } from './saga-queue.service.js';
import { resolveStrategy } from './strategy-factory.js';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Traite un job de la file 'saga-payment'
 * @param {Object} job - Job BullMQ
 */
async function processPaymentSaga(job) {
  const { eventId, source, orderReference, payload, correlationId } = job.data;

  console.log(`[PaymentSagaWorker] Processing job ${job.id} | source=${source} | order=${orderReference}`);

  // 1. Vérifier l'idempotence (éviter de traiter 2 fois le même événement)
  const alreadyProcessed = await checkIdempotency(eventId);
  if (alreadyProcessed) {
    console.log(`[PaymentSagaWorker] Event ${eventId} already processed — skipping`);
    return { skipped: true, eventId };
  }

  // 2. Marquer comme PROCESSING
  await markIdempotency(eventId, orderReference, source, 'PROCESSING');

  try {
    // 3. Résoudre et exécuter la stratégie
    const strategy = resolveStrategy(source);
    const result = await strategy.execute(job.data);

    // 4. Marquer comme COMPLETED
    await markIdempotency(eventId, orderReference, source, 'COMPLETED', result);

    console.log(`[PaymentSagaWorker] ✅ Job ${job.id} completed successfully`);
    return result;
  } catch (error) {
    // Si l'erreur est retryable, BullMQ s'en charge automatiquement
    // Sinon, on marque comme FAILED
    const isRetryable = error.name === 'MoodleRetryableError';

    if (!isRetryable) {
      await markIdempotency(eventId, orderReference, source, 'FAILED', null, error.message);
      console.error(`[PaymentSagaWorker] ❌ Job ${job.id} failed definitively:`, error.message);
    }

    throw error; // BullMQ gère le retry
  }
}

/**
 * Vérifie si un événement a déjà été traité
 */
async function checkIdempotency(eventId) {
  const [row] = await sequelize.query(
    `SELECT status FROM aggp_saga_idempotency WHERE event_id = :eventId LIMIT 1`,
    {
      replacements: { eventId },
      type: QueryTypes.SELECT,
    }
  );

  if (!row) return false;
  return row.status === 'COMPLETED' || row.status === 'PROCESSING';
}

/**
 * Enregistre l'état d'un événement dans la table d'idempotence
 */
async function markIdempotency(eventId, orderReference, source, status, result = null, error = null) {
  if (status === 'PROCESSING') {
    // INSERT (ignorer si déjà existant)
    await sequelize.query(
      `INSERT IGNORE INTO aggp_saga_idempotency
       (event_id, status, order_reference, source, created_at)
       VALUES (:eventId, :status, :orderReference, :source, NOW())`,
      {
        replacements: { eventId, status, orderReference, source },
        type: QueryTypes.INSERT,
      }
    );
  } else {
    // UPDATE
    await sequelize.query(
      `UPDATE aggp_saga_idempotency
       SET status = :status,
           processed_at = NOW(),
           result = :result,
           error_message = :error,
           retry_count = retry_count + 1
       WHERE event_id = :eventId`,
      {
        replacements: {
          eventId,
          status,
          result: result ? JSON.stringify(result) : null,
          error,
        },
        type: QueryTypes.UPDATE,
      }
    );
  }
}

// Créer et exporter le worker
export const paymentSagaWorker = createSagaWorker('saga-payment', processPaymentSaga);

console.log('[PaymentSagaWorker] Initialized — listening on queue "saga-payment"');