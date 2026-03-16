import { BadRequestError } from "../utils/errors.js";

/**
 * Middleware wrapper for Zod validation
 * @param {z.ZodSchema} schema 
 */
export const validateB2B = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      
      return res.status(400).json({
        status: "error",
        message: "Données de requête invalides.",
        errors
      });
    }
    
    // Replace req.body with validated data
    req.body = result.data;
    next();
  };
};
