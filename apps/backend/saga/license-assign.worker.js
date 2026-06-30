/**
 * Worker BullMQ — assignation automatique de licences B2B (Journey 4).
 */
import { createSagaWorker } from "./saga-queue.service.js";
import { B2bLicenseAssignService } from "../services/b2b-license-assign.service.js";

async function processLicenseAssign(job) {
  const { accessRequestId } = job.data;
  return B2bLicenseAssignService.processAccessRequest(accessRequestId);
}

export const licenseAssignWorker = createSagaWorker("saga-license-assign", processLicenseAssign);
