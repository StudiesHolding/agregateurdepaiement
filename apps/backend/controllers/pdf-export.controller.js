/**
 * PDF Export Controller
 * Handles PDF generation for access requests and invoices
 */

import { Company, Employee, AccessRequest, CompanyPackage, FormationPackage, Order } from '../models/index.js';
import { generateAccessRequestsPDF, generateInvoicePDF } from '../services/pdf-export.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

export const PdfExportController = {
  /**
   * @route GET /api/v1/b2b/requests/export-pdf
   * @desc Export access requests as PDF
   */
  exportRequestsPDF: async (req, res, next) => {
    try {
      const companyId = req.company_id;

      // Get company
      const company = await Company.findByPk(companyId);
      if (!company) {
        throw new NotFoundError("Entreprise introuvable.");
      }

      // Get all access requests for this company with employee and package info
      const accessRequests = await AccessRequest.findAll({
        where: { company_id: companyId },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'first_name', 'last_name', 'email', 'department', 'position']
          },
          {
            model: CompanyPackage,
            as: 'companyPackage',
            include: [
              {
                model: FormationPackage,
                as: 'package',
                attributes: ['id', 'title', 'description', 'price']
              }
            ]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      if (accessRequests.length === 0) {
        throw new BadRequestError("Aucune demande d'accès à exporter.");
      }

      // Generate PDF
      const pdfBuffer = await generateAccessRequestsPDF(
        JSON.parse(JSON.stringify(accessRequests)),
        JSON.parse(JSON.stringify(company))
      );

      // Send PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="demandes-acces-${company.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/orders/:id/export-invoice
   * @desc Export invoice as PDF
   */
  exportInvoicePDF: async (req, res, next) => {
    try {
      const { id } = req.params;
      const companyId = req.company_id;

      // Get company
      const company = await Company.findByPk(companyId);
      if (!company) {
        throw new NotFoundError("Entreprise introuvable.");
      }

      // Get order
      const order = await Order.findByPk(id);
      if (!order) {
        throw new NotFoundError("Commande introuvable.");
      }

      // Parse metadata if string
      let metadata = order.metadata || {};
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }

      // Verify ownership
      const metaCompanyId = metadata.company_id;
      const matchesCompanyId = metaCompanyId !== undefined &&
        (String(metaCompanyId) === String(companyId) || metaCompanyId === companyId);
      const matchesEmail = company.email && order.customerEmail === company.email;
      const matchesName = company.name && order.customerName === company.name;
      const matchesMetaName = metadata.company_name &&
        metadata.company_name.toLowerCase() === company.name?.toLowerCase();
      const isB2BOrder = metadata.is_b2b === true || metadata.b2b_purchase === true;

      if (!isB2BOrder || !(matchesCompanyId || matchesEmail || matchesName || matchesMetaName)) {
        throw new NotFoundError("Commande introuvable.");
      }

      // Generate PDF
      const pdfBuffer = await generateInvoicePDF(
        JSON.parse(JSON.stringify(order)),
        JSON.parse(JSON.stringify(company))
      );

      // Send PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="facture-${order.reference}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
};

export default PdfExportController;
