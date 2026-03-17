import { Company, CompanyAdmin, CompanyPackage, FormationPackage, Order } from "../models/index.js";
import { NotFoundError } from "../utils/errors.js";

export const AdminCompanyController = {
  /**
   * List all companies
   */
  list: async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await Company.findAndCountAll({
        include: [
          { model: CompanyAdmin, as: 'admins', attributes: ['id', 'email', 'is_active'] },
          { model: CompanyPackage, as: 'packages', include: [{ model: FormationPackage, as: 'package' }] }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      res.json({
        status: "success",
        data: rows,
        meta: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get company details
   */
  getById: async (req, res, next) => {
    try {
      const company = await Company.findByPk(req.params.id, {
        include: [
          { model: CompanyAdmin, as: 'admins' },
          { 
            model: CompanyPackage, 
            as: 'packages', 
            include: [{ model: FormationPackage, as: 'package' }] 
          },
          {
            model: Order,
            as: 'orders', // Need to check if this association exists, fallback to manual find if not
            limit: 5,
            order: [['created_at', 'DESC']]
          }
        ]
      });

      if (!company) throw new NotFoundError("Entreprise introuvable");

      res.json({ status: "success", data: company });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Manual activation of a company admin
   */
  toggleAdminStatus: async (req, res, next) => {
    try {
      const admin = await CompanyAdmin.findByPk(req.params.adminId);
      if (!admin) throw new NotFoundError("Administrateur introuvable");

      await admin.update({ is_active: !admin.is_active });

      res.json({
        status: "success",
        message: `Statut de l'administrateur ${admin.email} mis à jour.`,
        data: { is_active: admin.is_active }
      });
    } catch (err) {
      next(err);
    }
  }
};
