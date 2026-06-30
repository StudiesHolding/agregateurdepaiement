/**
 * Assignation automatique de licences B2B — vision ATDD Journey 4.
 *
 * Email X (compte existant) → notification d'accès attribué
 * Email Y (nouveau compte)  → invitation magic-link SSO
 */
import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import {
  AccessRequest,
  Employee,
  CompanyPackage,
  FormationPackage,
  Company,
} from "../models/index.js";
import { MailService } from "./mail.service.js";
import { SsoActivationService } from "./sso-activation.service.js";

export class B2bLicenseAssignService {
  /**
   * Vérifie si l'email possède déjà un compte plateforme actif (Keycloak lié).
   */
  static async hasPlatformAccount(email) {
    const [row] = await sequelize.query(
      `SELECT ID, keycloak_id FROM kyd4_users
       WHERE user_email = :email AND keycloak_id IS NOT NULL AND keycloak_id != ''
       LIMIT 1`,
      { replacements: { email }, type: QueryTypes.SELECT },
    );
    return Boolean(row);
  }

  /**
   * Traite une demande d'accès : activation immédiate + email approprié.
   */
  static async processAccessRequest(accessRequestId) {
    const request = await AccessRequest.findByPk(accessRequestId, {
      include: [
        { model: Employee, as: "employee" },
        {
          model: CompanyPackage,
          as: "companyPackage",
          include: [{ model: FormationPackage, as: "package" }],
        },
      ],
    });

    if (!request?.employee) {
      throw new Error(`AccessRequest ${accessRequestId} introuvable`);
    }

    const employee = request.employee;
    const companyPackage = request.companyPackage;
    const pkg = companyPackage?.package;
    const company = await Company.findByPk(request.company_id);

    const packageName = pkg?.name || pkg?.title || "Formation";
    const companyName = company?.name || "Votre entreprise";
    const hasAccount = await this.hasPlatformAccount(employee.email);

    await request.update({
      status: "activated",
      processed_at: new Date(),
      admin_notes: hasAccount
        ? "Auto: notification compte existant"
        : "Auto: invitation magic-link envoyée",
    });

    if (hasAccount) {
      await MailService.sendCollaboratorAccessNotification(employee.email, {
        firstName: employee.first_name,
        lastName: employee.last_name,
        companyName,
        packageName,
      });
      return { type: "notification", email: employee.email };
    }

    const token = SsoActivationService.generateInvitationToken();
    const activationLink = SsoActivationService.buildActivationLink(
      employee.email,
      token,
      "/student/dashboard",
    );

    await employee.update({
      metadata: {
        ...(employee.metadata || {}),
        activation_token: token,
        token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        invitation_package: packageName,
      },
    });

    await MailService.sendCollaboratorInvitation(employee.email, {
      firstName: employee.first_name,
      lastName: employee.last_name,
      companyName,
      packageName,
      activationLink,
    });

    return { type: "invitation", email: employee.email, activationLink };
  }
}
