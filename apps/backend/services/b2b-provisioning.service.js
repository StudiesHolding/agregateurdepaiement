import { Company, CompanyAdmin, CompanyPackage, Order, sequelize } from "../models/index.js";
import { MailService } from "./mail.service.js";
import { InvoiceService } from "./invoice.service.js";
import { v4 as uuidv4 } from "../utils/uuid.js";
import crypto from "crypto";

export class B2BProvisioningService {
  /**
   * Main entry point for B2B fulfillment
   * Called by WebhookProcessor when an order is successful and is_b2b is true
   */
  static async handleB2BOrder(order) {
    console.log(`[B2BProvisioning] Starting fulfillment for Order ${order.reference}...`);

    const transaction = await sequelize.transaction();

    try {
      const metadata = order.metadata || {};
      const companyName = metadata.company_name || order.customerName || "Nouvelle Entreprise";
      const adminEmail = metadata.company_admin_email || order.customerEmail;

      // 1. Create or Find Company (Idempotent)
      let company = await Company.findOne({ where: { email: adminEmail }, transaction });

      if (!company) {
        company = await Company.create({
          name: companyName,
          email: adminEmail,
          metadata: {
            industry: metadata.company_industry,
            source_order: order.reference
          }
        }, { transaction });
      }

      // 2. Create CompanyAdmin (Disabled, awaiting activation)
      let admin = await CompanyAdmin.findOne({ where: { email: adminEmail }, transaction });

      const activationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      console.log(`[B2BProvisioning] Creating activation token for ${adminEmail}: ${activationToken}`);

      if (!admin) {
        admin = await CompanyAdmin.create({
          company_id: company.id,
          email: adminEmail,
          password_hash: "AWAITING_ACTIVATION_" + uuidv4(), // Temporary placeholder
          is_active: false,
          role: "admin",
          metadata: {
            activation_token: activationToken,
            token_expires: tokenExpires
          }
        }, { transaction });
        console.log(`[B2BProvisioning] Admin created with metadata:`, admin.metadata);
      } else {
        // Admin exists - update with new activation token and ensure is_active is false
        const updatedMetadata = {
          ...(admin.metadata || {}),
          activation_token: activationToken,
          token_expires: tokenExpires
        };
        console.log(`[B2BProvisioning] Updating admin metadata:`, updatedMetadata);
        await admin.update({
          is_active: false,
          metadata: updatedMetadata
        }, { transaction });

        // Reload to verify
        await admin.reload({ transaction });
        console.log(`[B2BProvisioning] Admin metadata after update:`, admin.metadata);
      }

      // 3. Provision the Package (Idempotent - update if exists)
      const existingPackage = await CompanyPackage.findOne({
        where: { company_id: company.id, package_id: order.formationId },
        transaction
      });

      if (existingPackage) {
        // Update existing package with new license count
        await existingPackage.update({
          total_licenses: metadata.licence_count || existingPackage.total_licenses,
          status: 'active',
          purchase_date: new Date()
        }, { transaction });
      } else {
        // Create new package
        await CompanyPackage.create({
          company_id: company.id,
          package_id: order.formationId,
          total_licenses: metadata.licence_count || 1,
          used_licenses: 0,
          status: 'active',
          purchase_date: new Date()
        }, { transaction });
      }

      await transaction.commit();

      // 4. Send Activation Email with Invoice
      await this.sendActivationEmail(admin, company, activationToken, order);

      console.log(`[B2BProvisioning] Successfully provisioned B2B account for ${adminEmail}`);
      return { success: true, companyId: company.id };

    } catch (error) {
      await transaction.rollback();
      console.error(`[B2BProvisioning] Fulfillment FAILED for Order ${order.reference}:`, error);
      throw error;
    }
  }

  /**
   * Send the activation email with the secure link and attach invoice
   */
  static async sendActivationEmail(admin, company, token, order = null) {
    const dashboardUrl = process.env.B2B_DASHBOARD_URL || "https://sl-business.studieslearning.com";
    const activationLink = `${dashboardUrl}/auth/activate?token=${token}&email=${admin.email}`;

    // Generate invoice PDF if order is provided
    let attachment = null;
    if (order) {
      try {
        const pdfBuffer = await InvoiceService.generateInvoiceBuffer(null, order);
        if (pdfBuffer) {
          attachment = {
            filename: `facture-${order.reference}.pdf`,
            content: pdfBuffer
          };
        }
      } catch (error) {
        console.warn("[B2BProvisioning] Failed to generate invoice PDF:", error.message);
      }
    }

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: #1d3557; color: white; padding: 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Bienvenue sur votre Dashboard B2B</h1>
          <p style="margin-top: 10px; opacity: 0.9;">${company.name}</p>
        </div>
        <div style="padding: 40px;">
          <p>Bonjour,</p>
          <p>Votre achat de package de formations a été validé avec succès. Votre espace de gestion B2B est prêt.</p>
          <p>Pour des raisons de sécurité, veuillez cliquer sur le bouton ci-dessous pour activer votre compte et définir votre mot de passe :</p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${activationLink}" style="background: #e63946; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">Activer mon Espace B2B</a>
          </div>

          <p style="font-size: 14px; color: #64748b; background: #f8fafc; padding: 15px; border-radius: 8px;">
            <strong>Note :</strong> Ce lien est à usage unique et expirera dans 24 heures. Si le bouton ne fonctionne pas, copiez-collez ce lien : <br>
            <span style="word-break: break-all; opacity: 0.8;">${activationLink}</span>
          </p>

          <p style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Une fois activé, vous pourrez attribuer vos licences à vos collaborateurs directement depuis votre dashboard.
          </p>
          
          <p>Cordialement,<br>L'équipe Studies Learning</p>
        </div>
      </div>
    `;

    return await MailService.sendEmail({
      to: admin.email,
      subject: `Activez votre espace B2B - ${company.name}`,
      html,
      attachments: attachment ? [attachment] : []
    });
  }
}
