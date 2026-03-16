import { CompanyPackage, Employee, AccessRequest, FormationPackage } from "../models/index.js";

export const b2bDashboardController = {
  /**
   * @route GET /api/v1/b2b/dashboard/stats
   * @desc Get overview statistics for the B2B dashboard
   */
  getStats: async (req, res, next) => {
    try {
      const companyId = req.company_id;

      // 1. Total & Used Licenses
      const packages = await CompanyPackage.findAll({
        where: { company_id: companyId, status: 'active' },
        include: [{ model: FormationPackage, as: 'package' }]
      });

      const totalLicenses = packages.reduce((acc, p) => acc + (p.total_licenses || 0), 0);
      const usedLicenses = packages.reduce((acc, p) => acc + (p.used_licenses || 0), 0);

      // 2. Total Employees
      const totalEmployees = await Employee.count({
        where: { company_id: companyId, is_active: true }
      });

      // 3. Pending Requests
      const pendingRequests = await AccessRequest.count({
        where: { company_id: companyId, status: 'pending' }
      });

      // 4. Usage by Package
      const usageByPackage = packages.map(p => ({
        name: p.package?.title || "Package inconnu",
        total: p.total_licenses,
        used: p.used_licenses
      }));

      // 5. Recent Activity
      const recentActivities = await AccessRequest.findAll({
        where: { company_id: companyId },
        include: [
          { model: Employee, as: 'employee' },
          { model: CompanyPackage, as: 'companyPackage', include: [{ model: FormationPackage, as: 'package' }] }
        ],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      const recentActivityFormatted = recentActivities.map(activity => ({
        id: activity.id,
        user: `${activity.employee?.first_name} ${activity.employee?.last_name}`,
        action: 'access_requested', 
        package: activity.companyPackage?.package?.title || "N/A",
        status: activity.status,
        time: activity.created_at 
      }));

      res.json({
        status: "success",
        data: {
          total_licenses: totalLicenses,
          used_licenses: usedLicenses,
          total_employees: totalEmployees,
          pending_requests: pendingRequests,
          usage_by_package: usageByPackage,
          recent_activity: recentActivityFormatted
        }
      });
    } catch (err) {
      next(err);
    }
  }
};
