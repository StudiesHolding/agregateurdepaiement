import { UnauthorizedError } from "../utils/errors.js";

/**
 * Auth inter-services / QA ATDD — header x-internal-key
 */
export const requireInternalKey = (req, res, next) => {
  const key = req.headers["x-internal-key"];
  const expected = process.env.INTERNAL_API_KEY || process.env.SAGA_API_KEY;

  if (!expected || key !== expected) {
    return next(new UnauthorizedError("Invalid or missing x-internal-key"));
  }
  next();
};
