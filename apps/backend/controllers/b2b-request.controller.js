import { AccessRequest, Employee, CompanyPackage, FormationPackage, sequelize } from "../models/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

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
   * @route GET /api/v1/b2b/requests/:id
   * @desc Get a single access request
   */
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const companyId = req.company_id;

      const request = await AccessRequest.findOne({
        where: { id, company_id: companyId },
        include: [
          { model: Employee, as: 'employee' },
          { model: CompanyPackage, as: 'companyPackage', include: [{ model: FormationPackage, as: 'package' }] }
        ]
      });

      if (!request) {
        throw new NotFoundError("Demande introuvable.");
      }

      res.json({
        status: "success",
        data: request
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route PUT /api/v1/b2b/requests/:id/status
   * @desc Update the status of an access request
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
  },

  /**
   * @route POST /api/v1/b2b/requests/:id/approve
   * @desc Approve an access request and trigger license activation
   */
  approve: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const companyId = req.company_id;

      const request = await AccessRequest.findOne({
        where: { id, company_id: companyId },
        include: [
          { model: Employee, as: 'employee' },
          { model: CompanyPackage, as: 'companyPackage' }
        ]
      });

      if (!request) {
        throw new NotFoundError("Demande introuvable.");
      }

      if (request.status === 'activated') {
        throw new BadRequestError("Cette demande est déjà activée.");
      }

      if (request.status === 'rejected') {
        throw new BadRequestError("Impossible d'approuver une demande rejetée.");
      }

      // Update request status to activated
      await request.update({
        status: 'activated',
        processed_at: new Date()
      }, { transaction });

      await transaction.commit();

      // TODO: Send activation email to employee

      res.json({
        status: "success",
        message: "Demande approuvée. Le collaborateur va recevoir un email d'activation.",
        data: request
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/requests/:id/reject
   * @desc Reject an access request and release the license
   */
  reject: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const companyId = req.company_id;

      const request = await AccessRequest.findOne({
        where: { id, company_id: companyId },
        include: [
          { model: Employee, as: 'employee' },
          { model: CompanyPackage, as: 'companyPackage' }
        ]
      });

      if (!request) {
        throw new NotFoundError("Demande introuvable.");
      }

      if (request.status === 'activated') {
        // If already activated, we need to decrement the license count
        if (request.companyPackage) {
          await request.companyPackage.decrement('used_licenses', { by: 1, transaction });
        }
      }

      // Update request status to rejected
      await request.update({
        status: 'rejected',
        rejection_reason: reason || 'Rejeté par l\'administrateur',
        processed_at: new Date()
      }, { transaction });

      await transaction.commit();

      res.json({
        status: "success",
        message: "Demande rejetée. La licence a été libérée.",
        data: request
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  }
};
