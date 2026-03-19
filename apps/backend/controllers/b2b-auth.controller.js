import jwt from "jsonwebtoken";
import { CompanyAdmin, Company } from "../models/index.js";
import { UnauthorizedError, NotFoundError, BadRequestError } from "../utils/errors.js";

export const b2bAuthController = {
  /**
   * @route POST /api/v1/b2b/auth/activate
   * @desc Activate company admin account with token and set password
   */
  activate: async (req, res, next) => {
    try {
      const { token, email, password } = req.body;

      console.log(`[B2B Activate] Attempting activation for email: ${email}`);

      if (!token || !email || !password) {
        return res.status(400).json({
          status: "error",
          message: "Token, email et mot de passe sont requis."
        });
      }

      // Find the admin by email
      const admin = await CompanyAdmin.findOne({
        where: { email },
        include: [{ model: Company, as: "company" }]
      });

      if (!admin) {
        console.log(`[B2B Activate] Admin not found for email: ${email}`);
        return res.status(404).json({
          status: "error",
          message: "Compte introuvable."
        });
      }

      console.log(`[B2B Activate] Admin found. is_active: ${admin.is_active}, id: ${admin.id}`);

      // Check if already activated
      if (admin.is_active) {
        console.log(`[B2B Activate] Account already active for: ${email}`);
        return res.status(400).json({
          status: "error",
          message: "Ce compte est déjà activé. Veuillez vous connecter."
        });
      }

      // Verify token from metadata
      let metadata = admin.metadata || {};

      // Parse metadata if it's a string (from database)
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }

      console.log(`[B2B Activate] Parsed metadata:`, metadata);
      console.log(`[B2B Activate] Stored token: ${metadata.activation_token}, Provided token: ${token}`);
      console.log(`[B2B Activate] Token match: ${metadata.activation_token === token}`);

      if (metadata.activation_token !== token) {
        console.log(`[B2B Activate] Token mismatch for: ${email}`);
        return res.status(401).json({
          status: "error",
          message: "Token d'activation invalide."
        });
      }

      // Check if token is expired
      if (metadata.token_expires && new Date(metadata.token_expires) < new Date()) {
        console.log(`[B2B Activate] Token expired for: ${email}`);
        return res.status(401).json({
          status: "error",
          message: "Le token d'activation a expiré. Veuillez contacter le support."
        });
      }

      // Set the password and activate the account
      console.log(`[B2B Activate] Setting password and activating account for: ${email}`);
      admin.password_hash = password;
      admin.is_active = true;

      // Clear the activation token
      admin.metadata = {
        ...metadata,
        activation_token: null,
        token_expires: null,
        activated_at: new Date().toISOString()
      };

      // Force password_hash to be marked as changed for the hook to hash it
      admin.changed('password_hash', true);
      await admin.save();

      console.log(`[B2B Activate] Account activated successfully for: ${email}`);
      console.log(`[B2B Activate] New password_hash: ${admin.password_hash}`);

      // Generate B2B JWT Token
      const payload = {
        admin: {
          id: admin.id,
          company_id: admin.company_id,
          role: admin.role,
          type: "b2b_admin"
        }
      };

      const authToken = jwt.sign(
        payload,
        process.env.JWT_SECRET || "fallback_secret_key_for_b2b",
        { expiresIn: "24h" }
      );

      res.json({
        status: "success",
        message: "Compte activé avec succès!",
        data: {
          token: authToken,
          user: {
            id: admin.id,
            email: admin.email,
            first_name: admin.first_name,
            last_name: admin.last_name,
            company_id: admin.company_id,
            role: admin.role,
            company: admin.company
          }
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/auth/login
   * @desc Authenticate a company admin & get B2B token
   */
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      console.log(`[B2B Login] Attempting login for email: ${email}`);

      // Find admin by email
      const admin = await CompanyAdmin.findOne({
        where: { email, is_active: true },
        include: [{ model: Company, as: "company" }]
      });

      console.log(`[B2B Login] Query result:`, admin ? `Admin found (id: ${admin.id}, is_active: ${admin.is_active})` : 'Admin NOT found');

      if (!admin) {
        // Try to find admin without is_active filter to see if it's inactive
        const anyAdmin = await CompanyAdmin.findOne({
          where: { email },
          include: [{ model: Company, as: "company" }]
        });

        if (anyAdmin) {
          console.log(`[B2B Login] Admin found but is_active is: ${anyAdmin.is_active}`);
        }

        return res.status(401).json({
          status: "error",
          message: "Identifiants invalides ou compte inactif."
        });
      }

      console.log(`[B2B Login] Admin found. Checking password...`);

      // Check password using BCrypt hook/method
      const isMatch = await admin.comparePassword(password);
      console.log(`[B2B Login] Password match: ${isMatch}`);

      if (!isMatch) {
        console.log(`[B2B Login] Password mismatch for: ${email}`);
        return res.status(401).json({
          status: "error",
          message: "Identifiants invalides."
        });
      }

      // Generate B2B JWT Token
      const payload = {
        admin: {
          id: admin.id,
          company_id: admin.company_id,
          role: admin.role,
          type: "b2b_admin" // important flag
        }
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || "fallback_secret_key_for_b2b",
        { expiresIn: "24h" }
      );

      // Update last login
      admin.last_login = new Date();
      await admin.save();

      res.json({
        status: "success",
        data: {
          token,
          user: {
            id: admin.id,
            email: admin.email,
            first_name: admin.first_name,
            last_name: admin.last_name,
            company_id: admin.company_id,
            role: admin.role,
            company: admin.company
          }
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/auth/me
   * @desc Get current admin profile
   */
  getMe: async (req, res, next) => {
    try {
      // req.admin is set by the isCompanyAdmin middleware
      const adminId = req.admin.id;

      const admin = await CompanyAdmin.findByPk(adminId, {
        include: [{ model: Company, as: "company" }]
      });

      if (!admin) {
        throw new NotFoundError("Administrateur introuvable.");
      }

      const adminJson = admin.toJSON();
      delete adminJson.password_hash;

      res.json({
        status: "success",
        data: {
          user: adminJson
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route PUT /api/v1/b2b/auth/profile
   * @desc Update current admin profile
   */
  updateProfile: async (req, res, next) => {
    try {
      const adminId = req.admin.id;
      const { first_name, last_name } = req.body;

      const admin = await CompanyAdmin.findByPk(adminId);

      if (!admin) {
        throw new NotFoundError("Administrateur introuvable.");
      }

      await admin.update({
        first_name: first_name || admin.first_name,
        last_name: last_name || admin.last_name
      });

      res.json({
        status: "success",
        message: "Profil mis à jour avec succès.",
        data: {
          id: admin.id,
          email: admin.email,
          first_name: admin.first_name,
          last_name: admin.last_name
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route PUT /api/v1/b2b/auth/password
   * @desc Change current admin password
   */
  changePassword: async (req, res, next) => {
    try {
      const adminId = req.admin.id;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        throw new BadRequestError("Le mot de passe actuel et le nouveau mot de passe sont requis.");
      }

      if (new_password.length < 6) {
        throw new BadRequestError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      }

      const admin = await CompanyAdmin.findByPk(adminId);

      if (!admin) {
        throw new NotFoundError("Administrateur introuvable.");
      }

      // Verify current password
      const isMatch = await admin.comparePassword(current_password);
      if (!isMatch) {
        throw new BadRequestError("Le mot de passe actuel est incorrect.");
      }

      // Update password
      admin.password_hash = new_password;
      admin.changed('password_hash', true);
      await admin.save();

      res.json({
        status: "success",
        message: "Mot de passe mis à jour avec succès."
      });
    } catch (err) {
      next(err);
    }
  }
};
