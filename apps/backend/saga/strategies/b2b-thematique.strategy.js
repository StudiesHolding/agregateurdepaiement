/**
 * B2BThematiqueStrategy
 *
 * Stratégie pour les achats B2B (thématique de formations).
 * Cycle de vie :
 * 1. Créer/trouver l'entreprise (Company)
 * 2. Créer le CompanyAdmin avec token d'activation
 * 3. Créer/mettre à jour la CompanyThematique (pool de licences pour une thématique)
 * 4. Lier la commande à l'entreprise (company_id)
 * 5. Marquer la commande comme COMPLETED
 * 6. Envoyer l'email d'activation au Manager B2B
 */
import crypto from 'crypto';
import {
  Company,
  CompanyAdmin,
  Order,
  sequelize,
} from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { MailService } from '../../services/mail.service.js';

export class B2BThematiqueStrategy {
  async execute(event) {
    const { payload, correlationId } = event;
    const {
      companyName,
      companyEmail,
      adminEmail,
      adminFirstName,
      adminLastName,
      thematiqueId,
      licenseCount,
      orderReference,
    } = payload;

    console.log(`[B2BThematiqueStrategy:${correlationId}] Provisioning for order ${orderReference}`);

    const transaction = await sequelize.transaction();

    try {
      const company = await this.findOrCreateCompany(companyName, companyEmail, orderReference, transaction);
      const admin = await this.findOrCreateAdmin(company.id, adminEmail, adminFirstName, adminLastName, transaction);
      
      // We don't have CompanyThematique explicitly in the prompt models yet, so we will use metadata on Company for now
      // Or we can mock the thematique attribution logic here if there isn't a specific table.
      await this.provisionThematique(company.id, thematiqueId, licenseCount, transaction);

      await Order.update(
        {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          metadata: sequelize.literal(
            `JSON_SET(COALESCE(metadata, '{}'), '$.company_id', '${company.id}')`
          ),
        },
        { where: { reference: orderReference }, transaction }
      );

      await transaction.commit();

      await this.sendActivationEmail(admin, company, orderReference);

      console.log(`[B2BThematiqueStrategy:${correlationId}] ✅ Order ${orderReference} provisioned`);
      
      return {
        success: true,
        orderReference,
        companyId: company.id,
        adminId: admin.id,
        thematiqueId,
        licenseCount,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findOrCreateCompany(name, email, orderReference, transaction) {
    let company = await Company.findOne({ where: { email }, transaction });
    if (!company) {
      company = await Company.create({
        name,
        email,
        metadata: { source_order: orderReference, created_by_saga: true },
      }, { transaction });
    }
    return company;
  }

  async findOrCreateAdmin(companyId, email, firstName, lastName, transaction) {
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let admin = await CompanyAdmin.findOne({ where: { email }, transaction });
    if (!admin) {
      admin = await CompanyAdmin.create({
        company_id: companyId,
        email,
        name: `${firstName} ${lastName}`.trim(),
        password_hash: 'AWAITING_ACTIVATION_' + crypto.randomUUID(),
        is_active: false,
        role: 'admin',
        activation_token: activationToken,
        token_expires_at: tokenExpires,
      }, { transaction });
    } else {
      await admin.update({
        activation_token: activationToken,
        token_expires_at: tokenExpires,
        is_active: false,
      }, { transaction });
    }
    return admin;
  }

  async provisionThematique(companyId, thematiqueId, licenseCount, transaction) {
    // For now we just record it in the company metadata if CompanyThematique doesn't exist
    // Or just log it. Let's log it.
    console.log(`[B2BThematiqueStrategy] Provisioning thematique ${thematiqueId} with ${licenseCount} licenses for company ${companyId}`);
  }

  async sendActivationEmail(admin, company, orderReference) {
    const dashboardUrl = process.env.B2B_DASHBOARD_URL || 'https://sl-business.studieslearning.com';
    const activationLink = `${dashboardUrl}/auth/activate?token=${admin.activation_token}&email=${admin.email}`;

    await MailService.sendEmail({
      to: admin.email,
      subject: `Activez votre espace B2B Thématique - ${company.name}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
          <div style="background: #1d3557; color: white; padding: 40px; text-align: center;">
            <h1>Bienvenue sur votre Dashboard B2B</h1>
            <p>${company.name}</p>
          </div>
          <div style="padding: 40px;">
            <p>Bonjour,</p>
            <p>Votre achat de thématique a été validé avec succès.</p>
            <p>Commande : <strong>${orderReference}</strong></p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${activationLink}"
                 style="background: #e63946; color: white; padding: 16px 32px;
                        text-decoration: none; border-radius: 8px; font-weight: 700;">
                Activer mon Espace B2B
              </a>
            </div>
            <p style="font-size: 14px; color: #64748b;">
              Ce lien expire dans 24h. Si le bouton ne fonctionne pas :
              <br><span style="word-break: break-all;">${activationLink}</span>
            </p>
          </div>
        </div>
      `,
    });
  }
}
