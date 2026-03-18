import { AccessRequest, Employee, CompanyPackage, FormationPackage, Company, sequelize } from "../models/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { MailService } from "../services/mail.service.js";
import crypto from "crypto";

export const AdminRequestController = {
    /**
     * @route GET /api/admin/requests
     * @desc Get all access requests across all companies
     */
    getAll: async (req, res, next) => {
        try {
            const { status, company_id, page = 1, limit = 25 } = req.query;

            const where = {};
            if (status) where.status = status;
            if (company_id) where.company_id = company_id;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            const { count, rows } = await AccessRequest.findAndCountAll({
                where,
                include: [
                    { model: Employee, as: 'employee' },
                    { model: CompanyPackage, as: 'companyPackage', include: [{ model: FormationPackage, as: 'package' }] },
                    { model: Company, as: 'company' }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset
            });

            // Get stats
            const stats = await AccessRequest.findAll({
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['status'],
                raw: true
            });

            res.json({
                status: "success",
                data: rows,
                stats,
                meta: {
                    total: count,
                    page: parseInt(page),
                    perPage: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * @route GET /api/admin/requests/:id
     * @desc Get a single access request with full details
     */
    getById: async (req, res, next) => {
        try {
            const { id } = req.params;

            const request = await AccessRequest.findOne({
                where: { id },
                include: [
                    { model: Employee, as: 'employee' },
                    { model: CompanyPackage, as: 'companyPackage', include: [{ model: FormationPackage, as: 'package' }] },
                    { model: Company, as: 'company' }
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
     * @route POST /api/admin/requests/:id/approve
     * @desc Approve a single access request and create employee credentials
     */
    approve: async (req, res, next) => {
        const transaction = await sequelize.transaction();

        try {
            const { id } = req.params;
            const { username, password, admin_notes } = req.body;

            // Validate required fields
            if (!username || !password) {
                throw new BadRequestError("Le nom d'utilisateur et le mot de passe sont requis.");
            }

            const request = await AccessRequest.findOne({
                where: { id },
                include: [
                    { model: Employee, as: 'employee' },
                    { model: CompanyPackage, as: 'companyPackage' },
                    { model: Company, as: 'company' }
                ],
                transaction
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

            // ==================== SECOND SECURITY VERIFICATION ====================
            // This is the admin-level verification: validate company, package, and request legitimacy
            const pkg = request.companyPackage;

            if (!pkg) {
                throw new BadRequestError("Package company introuvable pour cette demande.");
            }

            // SECURITY CHECK 1: Verify company exists and is in good standing
            const company = request.company;
            if (!company) {
                throw new BadRequestError("Entreprise introuvable pour cette demande.");
            }
            if (company.status !== 'active') {
                throw new BadRequestError(`Entreprise non active (statut: ${company.status}). Veuillez vérifier le statut de l'entreprise.`);
            }

            // SECURITY CHECK 2: Verify package is valid and active
            if (pkg.status !== 'active') {
                throw new BadRequestError("Le package n'est pas actif. Veuillez vérifier le package.");
            }

            // SECURITY CHECK 3: (Removed - license is already reserved when request was created)
            // The license was consumed at request creation time, so we don't check availability here

            // SECURITY CHECK 4: Verify employee belongs to the same company
            if (request.employee.company_id !== request.company_id) {
                throw new BadRequestError("Erreur de sécurité: L'employé n'appartient pas à cette entreprise.");
            }

            // SECURITY CHECK 5: Verify employee is active
            if (!request.employee.is_active) {
                throw new BadRequestError("Le compte employé est inactif. Veuillez d'abord activer le compte employé.");
            }

            // All security checks passed - proceed with approval
            console.log(`[AdminRequestController] ✓ All security checks passed for request ${id}`);

            // Generate LMS credentials for the employee
            const lmsUsername = username;
            const lmsPassword = password; // In production, hash this

            // Update employee with LMS credentials
            const employee = request.employee;
            await employee.update({
                lms_username: lmsUsername,
                lms_password: lmsPassword,
                lms_access_enabled: true
            }, { transaction });

            // Update request status
            await request.update({
                status: 'activated',
                admin_notes: admin_notes || null,
                processed_at: new Date(),
                activated_at: new Date()
            }, { transaction });

            // NOTE: used_licenses was already incremented when the request was created
            // This is the "reservation" - now we're confirming it

            await transaction.commit();

            // Send activation email to employee
            try {
                await MailService.sendEmployeeAccessEmail(
                    employee.email,
                    {
                        firstName: employee.first_name,
                        lastName: employee.last_name,
                        companyName: request.company?.name || 'Votre entreprise',
                        username: lmsUsername,
                        password: lmsPassword,
                        packageName: request.companyPackage?.package?.title || 'Formation'
                    }
                );
            } catch (emailError) {
                console.error("[AdminRequestController] Failed to send employee email:", emailError.message);
            }

            res.json({
                status: "success",
                message: "Demande approuvée. L'employé va recevoir un email d'activation.",
                data: {
                    id: request.id,
                    status: 'activated',
                    employee: {
                        id: employee.id,
                        email: employee.email,
                        first_name: employee.first_name,
                        last_name: employee.last_name,
                        lms_username: lmsUsername
                    }
                }
            });
        } catch (err) {
            await transaction.rollback();
            next(err);
        }
    },

    /**
     * @route POST /api/admin/requests/batch-approve
     * @desc Approve multiple access requests at once
     */
    batchApprove: async (req, res, next) => {
        const transaction = await sequelize.transaction();

        try {
            const { request_ids, credentials, admin_notes } = req.body;

            // Validate required fields
            if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
                throw new BadRequestError("Au moins une demande doit être sélectionnée.");
            }

            if (!credentials || !credentials.username || !credentials.password) {
                throw new BadRequestError("Le nom d'utilisateur et le mot de passe sont requis.");
            }

            const { username, password } = credentials;

            // Get all requests
            const requests = await AccessRequest.findAll({
                where: { id: request_ids },
                include: [
                    { model: Employee, as: 'employee' },
                    { model: CompanyPackage, as: 'companyPackage' },
                    { model: Company, as: 'company' }
                ],
                transaction
            });

            if (requests.length === 0) {
                throw new BadRequestError("Aucune demande trouvée.");
            }

            // Filter valid requests
            const validRequests = requests.filter(r =>
                r.status === 'pending' || r.status === 'processing'
            );

            if (validRequests.length === 0) {
                throw new BadRequestError("Aucune demande valide à approuver.");
            }

            const results = [];
            const emailJobs = [];

            for (const request of validRequests) {
                // ==================== SECURITY VERIFICATION PER REQUEST ====================
                const pkg = request.companyPackage;

                // SKIP: Package not found
                if (!pkg) {
                    results.push({
                        request_id: request.id,
                        status: 'failed',
                        reason: 'Package introuvable'
                    });
                    continue;
                }

                // SKIP: Company not active
                if (!request.company || request.company.status !== 'active') {
                    results.push({
                        request_id: request.id,
                        status: 'failed',
                        reason: 'Entreprise non active'
                    });
                    continue;
                }

                // SKIP: Package not active
                if (pkg.status !== 'active') {
                    results.push({
                        request_id: request.id,
                        status: 'failed',
                        reason: 'Package inactif'
                    });
                    continue;
                }

                // NOTE: License availability check removed - license is reserved at request creation

                const employee = request.employee;

                // Update employee with LMS credentials
                await employee.update({
                    lms_username: username,
                    lms_password: password,
                    lms_access_enabled: true
                }, { transaction });

                // Update request status
                await request.update({
                    status: 'activated',
                    admin_notes: admin_notes || null,
                    processed_at: new Date(),
                    activated_at: new Date()
                }, { transaction });

                // NOTE: used_licenses was already incremented when the request was created

                results.push({
                    request_id: request.id,
                    status: 'success',
                    employee: {
                        id: employee.id,
                        email: employee.email,
                        name: `${employee.first_name} ${employee.last_name}`
                    }
                });

                // Queue email
                emailJobs.push({
                    email: employee.email,
                    firstName: employee.first_name,
                    lastName: employee.last_name,
                    companyName: request.company?.name || 'Votre entreprise',
                    username,
                    password,
                    packageName: request.companyPackage?.package?.title || 'Formation'
                });
            }

            await transaction.commit();

            // Send emails in background
            for (const job of emailJobs) {
                try {
                    await MailService.sendEmployeeAccessEmail(job.email, job);
                } catch (emailError) {
                    console.error(`[AdminRequestController] Failed to send email to ${job.email}:`, emailError.message);
                }
            }

            const successCount = results.filter(r => r.status === 'success').length;
            const failCount = results.filter(r => r.status === 'failed').length;

            res.json({
                status: "success",
                message: `${successCount} demande(s) approuvée(s). ${failCount} échouée(s).`,
                data: {
                    results,
                    summary: {
                        total: results.length,
                        success: successCount,
                        failed: failCount
                    }
                }
            });
        } catch (err) {
            await transaction.rollback();
            next(err);
        }
    },

    /**
     * @route POST /api/admin/requests/:id/reject
     * @desc Reject an access request
     */
    reject: async (req, res, next) => {
        const transaction = await sequelize.transaction();

        try {
            const { id } = req.params;
            const { reason, admin_notes } = req.body;

            const request = await AccessRequest.findOne({
                where: { id },
                include: [
                    { model: Employee, as: 'employee' },
                    { model: CompanyPackage, as: 'companyPackage' }
                ],
                transaction
            });

            if (!request) {
                throw new NotFoundError("Demande introuvable.");
            }

            // RELEASE: Decrement used_licenses to release the reserved license
            // The license was reserved when the request was created, so we release it on rejection
            if (request.companyPackage) {
                await request.companyPackage.decrement('used_licenses', { by: 1, transaction });
            }

            // Update request status to rejected
            await request.update({
                status: 'rejected',
                rejection_reason: reason || 'Rejeté par l\'administrateur',
                admin_notes: admin_notes || null,
                processed_at: new Date()
            }, { transaction });

            await transaction.commit();

            // Send rejection email to employee
            try {
                await MailService.sendEmployeeRejectionEmail(
                    request.employee.email,
                    {
                        firstName: request.employee.first_name,
                        lastName: request.employee.last_name,
                        reason: reason || 'Demande rejetée par l\'administrateur'
                    }
                );
            } catch (emailError) {
                console.error("[AdminRequestController] Failed to send rejection email:", emailError.message);
            }

            res.json({
                status: "success",
                message: "Demande rejetée.",
                data: request
            });
        } catch (err) {
            await transaction.rollback();
            next(err);
        }
    },

    /**
     * @route POST /api/admin/requests/batch-reject
     * @desc Reject multiple access requests at once
     */
    batchReject: async (req, res, next) => {
        const transaction = await sequelize.transaction();

        try {
            const { request_ids, reason, admin_notes } = req.body;

            if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
                throw new BadRequestError("Au moins une demande doit être sélectionnée.");
            }

            const requests = await AccessRequest.findAll({
                where: { id: request_ids },
                include: [
                    { model: Employee, as: 'employee' },
                    { model: CompanyPackage, as: 'companyPackage' }
                ],
                transaction
            });

            if (requests.length === 0) {
                throw new BadRequestError("Aucune demande trouvée.");
            }

            const results = [];

            for (const request of requests) {
                // RELEASE: Decrement used_licenses to release the reserved license
                // The license was reserved when the request was created, so we release it on rejection
                if (request.companyPackage) {
                    await request.companyPackage.decrement('used_licenses', { by: 1, transaction });
                }

                await request.update({
                    status: 'rejected',
                    rejection_reason: reason || 'Rejeté par l\'administrateur',
                    admin_notes: admin_notes || null,
                    processed_at: new Date()
                }, { transaction });

                results.push({
                    request_id: request.id,
                    status: 'success',
                    employee: {
                        email: request.employee.email,
                        name: `${request.employee.first_name} ${request.employee.last_name}`
                    }
                });
            }

            await transaction.commit();

            res.json({
                status: "success",
                message: `${results.length} demande(s) rejetée(s).`,
                data: {
                    results,
                    summary: {
                        total: results.length,
                        success: results.length,
                        failed: 0
                    }
                }
            });
        } catch (err) {
            await transaction.rollback();
            next(err);
        }
    }
};

export default AdminRequestController;
