import { AccessRequest, Employee, CompanyPackage, FormationPackage } from "../models/index.js";
import { NotFoundError } from "../utils/errors.js";

export const b2bRequestController = {
  /**
   * @route GET /api/v1/b2b/requests
   * @desc Get all access requests for the company
   */
  getAll: async (req, res, next) => {
    try {
      const companyId = req.company_id;
      const requests = await AccessRequest.findAll({
        where: { company_id: companyId },
        include: [
          { model: Employee, as: 'employee' },
          { model: CompanyPackage, as: 'companyPackage', include: [{ model: FormationPackage, as: 'package' }] }
        ],
        order: [['created_at', 'DESC']]
      });
      
      res.json({
        status: "success",
        data: requests
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route PUT /api/v1/b2b/requests/:id/status
   * @desc Update the status of an access request (Admin Platform action usually, but available for B2B admin rejection maybe?)
   */
  updateStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;
      const companyId = req.company_id;

      const request = await AccessRequest.findOne({ 
        where: { id, company_id: companyId } 
      });

      if (!request) {
        throw new NotFoundError("Demande introuvable.");
      }

      await request.update({ 
        status, 
        admin_notes: admin_notes || request.admin_notes,
        processed_at: new Date()
      });

      res.json({
        status: "success",
        data: request
      });
    } catch (err) {
      next(err);
    }
  }
};
