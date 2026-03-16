import jwt from "jsonwebtoken";

/**
 * Middleware de vérification pour les admins B2B
 * S'assure que le token JWT est valide ET qu'il appartient à un admin B2B (type === 'b2b_admin')
 */
export const isCompanyAdmin = (req, res, next) => {
  // Get token from header
  const authHeader = req.header("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      message: "Accès refusé. Aucun token fourni."
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || "fallback_secret_key_for_b2b"
    );

    // Verify it's specifically a B2B admin token
    if (!decoded.admin || decoded.admin.type !== "b2b_admin") {
      return res.status(403).json({
        status: "error",
        message: "Accès refusé. Le token n'appartient pas à un administrateur d'entreprise B2B."
      });
    }

    // Bind admin details to request object for downstream controllers
    req.admin = decoded.admin;
    req.company_id = decoded.admin.company_id;
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: "error",
        message: "Token expiré. Veuillez vous reconnecter."
      });
    }
    
    res.status(401).json({
      status: "error",
      message: "Token invalide."
    });
  }
};
