/**
 * SagaQueueService
 *
 * Configuration de la file d'attente BullMQ pour les événements de Saga.
 * Utilise Redis comme backend.
 *
 * Files :
 * - saga-payment : File principale de la Saga
 * - saga-payment-dlq : Dead Letter Queue (après 3 échecs)
 * - saga-license-assign : Assignations de licences B2B
 */
import { Queue, Worker, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

/**
 * File principale de la Saga Paiement
 * Traite les événements post-paiement pour tous les flux (RETAIL, AUCTION, B2B)
 */
export const paymentSagaQueue = new Queue('saga-payment', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 30s, 120s
    },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400, count: 100 },
  },
});

/**
 * File d'assignation de licences B2B
 * Séparée pour éviter de bloquer les paiements par des traitements longs
 */
export const licenseAssignQueue = new Queue('saga-license-assign', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400, count: 100 },
  },
});

/**
 * Crée un Worker pour une file donnée
 * @param {string} queueName - Nom de la file
 * @param {Function} processor - Fonction de traitement (job) => Promise
 * @returns {Worker}
 */
export function createSagaWorker(queueName, processor) {
  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: 10,
    lockDuration: 30000,
    stalledInterval: 15000,
  });

  worker.on('completed', (job) => {
    console.log(`[SagaWorker:${queueName}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[SagaWorker:${queueName}] Job ${job.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[SagaWorker:${queueName}] Worker error:`, err.message);
  });

  return worker;
}

/**
 * Ajoute un événement de paiement à la file principale
 * @param {Object} event - Événement de paiement formaté
 * @returns {Promise<Job>}
 */
export async function dispatchPaymentEvent(event) {
  const { eventId, source, orderReference } = event;

  console.log(`[SagaQueue] Dispatching ${source} event ${eventId} for order ${orderReference}`);

  return paymentSagaQueue.add(eventId, event, {
    jobId: eventId,
    deduplication: { id: eventId, ttl: 86400000 }, // 24h d'idempotence
  });
}

/**
 * Ajoute un événement d'assignation de licence à la file B2B
 * @param {Object} event - Événement d'assignation
 * @returns {Promise<Job>}
 */
export async function dispatchLicenseAssignEvent(event) {
  const { eventId, employeeEmail } = event;

  console.log(`[SagaQueue] Dispatching license assign for ${employeeEmail}`);

  return licenseAssignQueue.add(eventId, event, {
    jobId: eventId,
    deduplication: { id: eventId, ttl: 86400000 },
  });
}