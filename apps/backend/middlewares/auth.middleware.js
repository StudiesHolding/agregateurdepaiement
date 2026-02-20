import { ApiKeyService } from "../services/api-key.service.js";
import { UnauthorizedError } from "../utils/errors.js";
import { catchAsync } from "./error.middleware.js";

/**
 * Middleware to check for valid API Key
 */
export const protect = catchAsync(async (req, res, next) => {
  // Try multiple header formats for compatibility
  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["X-API-KEY"] ||
    req.headers["x-api-key-value"] ||
    req.headers["X-API-KEY-VALUE"];

  console.log("[AUTH DEBUG] Headers received:", JSON.stringify(req.headers));
  console.log(
    "[AUTH DEBUG] API Key extracted:",
    apiKey ? apiKey.substring(0, 10) + "..." : "MISSING",
  );

  if (!apiKey) {
    throw new UnauthorizedError("App identification failed: Missing API Key");
  }

  const isValid = await ApiKeyService.validate(apiKey);

  if (!isValid) {
    throw new UnauthorizedError("App identification failed: Invalid API Key");
  }

  next();
});
