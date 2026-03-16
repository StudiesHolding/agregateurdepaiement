import jwt from "jsonwebtoken";
import { CompanyAdmin, Company } from "../models/index.js";
import { UnauthorizedError, NotFoundError } from "../utils/errors.js";

export const b2bAuthController = {
  /**
   * @route POST /api/v1/b2b/auth/login
   * @desc Authenticate a company admin & get B2B token
   */
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Find admin by email
      const admin = await CompanyAdmin.findOne({ 
        where: { email, is_active: true },
        include: [{ model: Company, as: "company" }]
      });

      if (!admin) {
        return res.status(401).json({
          status: "error",
          message: "Identifiants invalides ou compte inactif."
        });
      }

      // Check password using BCrypt hook/method
      const isMatch = await admin.comparePassword(password);

      if (!isMatch) {
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
  }
};
