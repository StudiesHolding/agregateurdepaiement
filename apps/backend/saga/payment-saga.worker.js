/**
 * PaymentSagaWorker
 *
 * Worker BullMQ pour la file 'saga-payment'.
 * Traite chaque événement de manière asynchrone :
 * 1. Vérifie l'idempotence (table aggp_saga_idempotency)
 * 2. Résout la stratégie via StrategyFactory
 * 3. Exécute la stratégie (appels M2M, DB, etc.)
 * 4. Marque l'état final dans la table d'idempotence
 *
 * Format de log unifié : [PaymentSagaWorker:{correlationId}] message
 */
import { createSagaWorker } from './saga-queue.service.js';
import { resolveStrategy } from './strategy-factory.js';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Traite un job de la file 'saga-payment'
 */
async function processPaymentSaga(job) {
  const { eventId, source, orderReference, payload, correlationId } = job.data;
  const log = (msg, ...args) => console.log(`[PaymentSagaWorker:${correlationId}] ${msg}`, ...args);
  const logError = (msg, ...args) => console.error(`[PaymentSagaWorker:${correlationId}] ❌ ${msg}`, ...args);

  log(`Processing job ${job.id} | source=${source} | order=${orderReference}`);

  // 1. Idempotence : ne pas traiter un événement déjà complété
  const alreadyCompleted = await checkIdempotency(eventId);
  if (alreadyCompleted) {
    log(`Event ${eventId} already processed — skipping`);
    return { skipped: true, eventId };
  }

  // 2. Marquer PROCESSING
  await markIdempotency(eventId, orderReference, source, 'PROCESSING');

  try {
    // 3. Résoudre et exécuter la stratégie
    const strategy = resolveStrategy(source);
    log(`Executing ${strategy.constructor.name}...`);
    const result = await strategy.execute(job.data);

    // 4. Marquer SUCCESS
    await markIdempotency(eventId, orderReference, source, 'SUCCESS', result);
    log(`✅ Job ${job.id} completed successfully`);
    return result;

  } catch (error) {
    const isRetryable = error.name === 'MoodleRetryableError';

    if (!isRetryable) {
      await markIdempotency(eventId, orderReference, source, 'FAILED', null, error.message);
      logError(`Job ${job.id} failed definitively: ${error.message}`);
    } else {
      logError(`Job ${job.id} failed (retryable): ${error.message}`);
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
  return row.status === 'SUCCESS' || row.status === 'PROCESSING';
}

/**
 * Enregistre l'état d'un événement dans la table d'idempotence
 */
async function markIdempotency(eventId, orderReference, source, status, result = null, error = null) {
  if (status === 'PROCESSING') {
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