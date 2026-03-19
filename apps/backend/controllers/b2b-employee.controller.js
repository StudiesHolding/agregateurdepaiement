import { Employee, AccessRequest } from "../models/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import sequelize from "../config/database.js";

export const b2bEmployeeController = {
  /**
   * @route GET /api/v1/b2b/employees
   * @desc Get all employees for the company with license count
   */
  getAll: async (req, res, next) => {
    try {
      const companyId = req.company_id;
      const employees = await Employee.findAll({
        where: { company_id: companyId },
        order: [['last_name', 'ASC'], ['first_name', 'ASC']]
      });

      // Get license count for each employee (count of activated access requests)
      const employeeIds = employees.map(e => e.id);
      let licenseCounts = {};

      if (employeeIds.length > 0) {
        const accessCounts = await AccessRequest.findAll({
          where: {
            employee_id: employeeIds,
            status: 'activated'
          },
          attributes: [
            'employee_id',
            [sequelize.fn('COUNT', sequelize.col('id')), 'license_count']
          ],
          group: ['employee_id']
        });

        // Build a map of employee_id -> license_count
        accessCounts.forEach((record) => {
          licenseCounts[record.employee_id] = parseInt(record.dataValues.license_count) || 0;
        });
      }

      // Add license_count to each employee
      const employeesWithLicenses = employees.map(emp => ({
        ...emp.toJSON(),
        licenses: licenseCounts[emp.id] || 0
      }));

      res.json({
        status: "success",
        data: employeesWithLicenses
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/employees
   * @desc Add a new employee
   */
  create: async (req, res, next) => {
    try {
      const { first_name, last_name, email, department, position } = req.body;
      const companyId = req.company_id;

      // Check for existing employee with same email in SAME company
      const existing = await Employee.findOne({
        where: { company_id: companyId, email }
      });

      if (existing) {
        throw new BadRequestError("Un collaborateur avec cet email existe déjà dans votre entreprise.");
      }

      const newEmployee = await Employee.create({
        company_id: companyId,
        first_name,
        last_name,
        email,
        department,
        position
      });

      res.status(201).json({
        status: "success",
        data: newEmployee
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route PUT /api/v1/b2b/employees/:id
   * @desc Update an employee
   */
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { first_name, last_name, email, department, position, is_active } = req.body;
      const companyId = req.company_id;

      const employee = await Employee.findOne({
        where: { id, company_id: companyId }
      });

      if (!employee) {
        throw new NotFoundError("Collaborateur introuvable.");
      }

      await employee.update({
        first_name,
        last_name,
        email,
        department,
        position,
        is_active
      });

      res.json({
        status: "success",
        data: employee
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route DELETE /api/v1/b2b/employees/:id
   * @desc Delete an employee
   */
  delete: async (req, res, next) => {
    try {
      const { id } = req.params;
      const companyId = req.company_id;

      const employee = await Employee.findOne({
        where: { id, company_id: companyId }
      });

      if (!employee) {
        throw new NotFoundError("Collaborateur introuvable.");
      }

      // TODO: Check if employee has active licenses before deleting?
      // Or just soft-delete/deactivate.
      await employee.destroy();

      res.json({
        status: "success",
        message: "Collaborateur supprimé avec succès."
      });
    } catch (err) {
      next(err);
    }
  }
};
