/**
 * Utilitaires d'attente saga — utilisés en NODE_ENV=test pour les tests ATDD.
 */
import { paymentSagaQueue } from "./saga-queue.service.js";

/**
 * Attend qu'un job saga pour une commande soit terminé (ou échoue après timeout).
 */
export async function waitForSagaJob(orderReference, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const jobs = await paymentSagaQueue.getJobs(["completed", "failed", "active", "waiting"], 0, 50);
    const match = jobs.find((j) => j.data?.orderReference === orderReference);

    if (match) {
      const state = await match.getState();
      if (state === "completed") {
        return { state, result: match.returnvalue, jobId: match.id };
      }
      if (state === "failed") {
        throw new Error(`Saga failed for ${orderReference}: ${match.failedReason}`);
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Saga timeout for order ${orderReference} (${timeoutMs}ms)`);
}
