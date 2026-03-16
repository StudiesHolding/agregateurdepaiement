import { 
  CompanyPackage, 
  FormationPackage, 
  AccessRequest, 
  Employee, 
  Course, 
  PostMeta, 
  PackageFormation, 
  SpecificFormation, 
  Order,
  sequelize 
} from "../models/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

export const b2bPackageController = {
  /**
   * @route GET /api/v1/b2b/packages
   * @desc Get all packages owned by the company
   */
  getPackages: async (req, res, next) => {
    try {
      const companyId = req.company_id;
      const packages = await CompanyPackage.findAll({
        where: { company_id: companyId },
        include: [{ 
          model: FormationPackage, 
          as: 'package',
          include: [
            {
              model: PackageFormation,
              as: 'packageFormations',
              include: [
                { 
                  model: Course, 
                  as: 'globalCourse',
                  include: [{ model: PostMeta, as: 'meta' }]
                },
                { model: SpecificFormation, as: 'specificCourse' }
              ]
            }
          ]
        }]
      });
      
      res.json({
        status: "success",
        data: packages
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/packages/:id
   * @desc Get detailed information for a specific package
   */
  getPackageById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const pkg = await FormationPackage.findByPk(id, {
        include: [
          {
            model: PackageFormation,
            as: 'packageFormations',
            include: [
              { 
                model: Course, 
                as: 'globalCourse',
                include: [{ model: PostMeta, as: 'meta' }]
              },
              { model: SpecificFormation, as: 'specificCourse' }
            ]
          },
          { model: SpecificFormation, as: 'specificFormations' }
        ]
      });

      if (!pkg) {
        throw new NotFoundError("Package introuvable.");
      }
      
      res.json({
        status: "success",
        data: pkg
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/packages/catalog
   * @desc Get all available packages for purchase
   */
  getCatalog: async (req, res, next) => {
    try {
      const catalog = await FormationPackage.findAll({
        where: { is_active: true },
        include: [
          {
            model: PackageFormation,
            as: 'packageFormations',
            include: [
              { 
                model: Course, 
                as: 'globalCourse',
                include: [{ model: PostMeta, as: 'meta' }]
              },
              { model: SpecificFormation, as: 'specificCourse' }
            ]
          },
          { model: SpecificFormation, as: 'specificFormations' }
        ]
      });
      
      res.json({
        status: "success",
        data: catalog
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/licenses/assign
   * @desc Assign a license (Create Access Request)
   */
  assignLicense: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { employee_id, company_package_id } = req.body;
      const companyId = req.company_id;

      // 1. Verify Company Package & Availability
      const companyPackage = await CompanyPackage.findOne({
        where: { id: company_package_id, company_id: companyId, status: 'active' },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!companyPackage) {
        throw new NotFoundError("Le package spécifié est introuvable ou inactif.");
      }

      if (companyPackage.used_licenses >= companyPackage.total_licenses) {
        throw new BadRequestError("Toutes les licences de ce package ont été attribuées.");
      }

      // 2. Verify Employee
      const employee = await Employee.findOne({
        where: { id: employee_id, company_id: companyId, is_active: true },
        transaction
      });

      if (!employee) {
        throw new NotFoundError("Le collaborateur spécifié est introuvable ou inactif.");
      }

      // 3. Check for existing request or activation
      const existingRequest = await AccessRequest.findOne({
        where: { 
          employee_id, 
          company_package_id,
          status: ['pending', 'processing', 'activated']
        },
        transaction
      });

      if (existingRequest) {
        throw new BadRequestError("Une demande d'accès est déjà en cours ou activée pour ce collaborateur sur ce package.");
      }

      // 4. Create Access Request
      const newRequest = await AccessRequest.create({
        company_id: companyId,
        employee_id,
        company_package_id,
        status: 'pending'
      }, { transaction });

      // 5. Update used count
      await companyPackage.increment('used_licenses', { by: 1, transaction });

      await transaction.commit();

      res.status(201).json({
        status: "success",
        data: newRequest
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/licenses/revoke
   * @desc Revoke a license (Deactivate request & restore count)
   */
  revokeLicense: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { access_request_id } = req.body;
      const companyId = req.company_id;

      const request = await AccessRequest.findOne({
        where: { id: access_request_id, company_id: companyId },
        transaction
      });

      if (!request) {
        throw new NotFoundError("Demande d'accès introuvable.");
      }

      if (request.status === 'rejected') {
         throw new BadRequestError("Cette demande est déjà rejetée.");
      }

      const companyPackage = await CompanyPackage.findByPk(request.company_package_id, { transaction });

      // Decrement used count if it was previously counted (pending, processing, activated)
      if (['pending', 'processing', 'activated'].includes(request.status)) {
        await companyPackage.decrement('used_licenses', { by: 1, transaction });
      }

      await request.destroy({ transaction });

      await transaction.commit();

      res.json({
        status: "success",
        message: "Licence révoquée avec succès."
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/packages/purchase
   * @desc Purchase a package (Simulation)
   */
  purchasePackage: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { package_id, total_licenses } = req.body;
      const companyId = req.company_id;

      // 1. Get package details
      const pkg = await FormationPackage.findByPk(package_id, { transaction });
      if (!pkg) {
        throw new NotFoundError("Package introuvable.");
      }

      // 2. Create Company Package
      // We check if company already has this package active to maybe increment licenses?
      // For simplicity in this simulation, we create a new entry or update existing.
      const companyPackage = await CompanyPackage.create({
        company_id: companyId,
        package_id,
        total_licenses,
        used_licenses: 0,
        status: 'active',
        purchase_date: new Date()
      }, { transaction });

      // 3. Create simulated Order
      const totalAmount = (pkg.price || 0) * 1; // Price per package or per license? 
      // In B2B often it's a fixed price for the package with a set number of licenses.
      
      await Order.create({
        reference: `B2B-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerEmail: req.company_email || 'b2b@enterprise.com',
        customerName: req.company_name || 'Enterprise Client',
        currency: pkg.currency || 'XOF',
        totalAmount: totalAmount,
        status: 'completed',
        lmsItemId: package_id.toString(),
        lmsItemType: 'package',
        formationId: package_id,
        formationName: pkg.title,
        paidAt: new Date(),
        paymentProvider: 'SIMULATED',
        metadata: {
          b2b_purchase: true,
          company_id: companyId,
          total_licenses
        }
      }, { transaction });

      await transaction.commit();

      res.status(201).json({
        status: "success",
        message: "Package acheté avec succès.",
        data: companyPackage
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  }
};
