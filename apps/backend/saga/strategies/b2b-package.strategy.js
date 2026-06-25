/**
 * B2BPackageStrategy
 *
 * Stratégie pour les achats B2B (packages d'entreprise).
 * Cycle de vie :
 * 1. Créer/trouver l'entreprise (Company)
 * 2. Créer le CompanyAdmin avec token d'activation
 * 3. Créer/mettre à jour le CompanyPackage (pool de licences)
 * 4. Lier la commande à l'entreprise (company_id)
 * 5. Marquer la commande comme COMPLETED
 * 6. Envoyer l'email d'activation au Manager B2B
 */
import crypto from 'crypto';
import {
  Company,
  CompanyAdmin,
  CompanyPackage,
  Order,
  sequelize,
} from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { MailService } from '../../services/mail.service.js';

export class B2BPackageStrategy {
  /**
   * Exécute la stratégie B2B
   * @param {Object} event - Événement de la queue
   * @returns {Promise<Object>}
   */
  async execute(event) {
    const { payload, correlationId } = event;
    const {
      companyName,
      companyEmail,
      adminEmail,
      adminFirstName,
      adminLastName,
      packageId,
      licenseCount,
      orderReference,
    } = payload;

    console.log(`[B2BPackageStrategy:${correlationId}] Provisioning for order ${orderReference}`);

    const transaction = await sequelize.transaction();

    try {
      // 1. Créer ou trouver l'entreprise (idempotent via email)
      const company = await this.findOrCreateCompany(companyName, companyEmail, orderReference, transaction);

      // 2. Créer le CompanyAdmin avec token d'activation
      const admin = await this.findOrCreateAdmin(company.id, adminEmail, adminFirstName, adminLastName, transaction);

      // 3. Créer ou mettre à jour le CompanyPackage
      const companyPackage = await this.provisionPackage(company.id, packageId, licenseCount, transaction);

      // 4. Lier la commande à l'entreprise et marquer COMPLETED
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

      // 5. Email d'activation (après commit)
      await this.sendActivationEmail(admin, company, orderReference);

      console.log(`[B2BPackageStrategy:${correlationId}] ✅ Order ${orderReference} provisioned`);
      console.log(`[B2BPackageStrategy] Company #${company.id}, Admin #${admin.id}, ${licenseCount} licenses`);

      return {
        success: true,
        orderReference,
        companyId: company.id,
        adminId: admin.id,
        packageId: companyPackage.id,
        licenseCount,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Trouve ou crée une entreprise
   */
  async findOrCreateCompany(name, email, orderReference, transaction) {
    let company = await Company.findOne({
      where: { email },
      transaction,
    });

    if (!company) {
      company = await Company.create({
        name,
        email,
        metadata: {
          source_order: orderReference,
          created_by_saga: true,
        },
      }, { transaction });
    }

    return company;
  }

  /**
   * Trouve ou crée un CompanyAdmin avec token d'activation
   */
  async findOrCreateAdmin(companyId, email, firstName, lastName, transaction) {
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let admin = await CompanyAdmin.findOne({
      where: { email },
      transaction,
    });

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
      // Mettre à jour le token même si l'admin existe déjà
      await admin.update({
        activation_token: activationToken,
        token_expires_at: tokenExpires,
        is_active: false,
      }, { transaction });
    }

    return admin;
  }

  /**
   * Crée ou met à jour un CompanyPackage (pool de licences)
   */
  async provisionPackage(companyId, packageId, licenseCount, transaction) {
    let companyPackage = await CompanyPackage.findOne({
      where: { company_id: companyId, package_id: Number(packageId) },
      transaction,
    });

    if (companyPackage) {
      const currentTotal = Number(companyPackage.total_licenses);
      await companyPackage.update({
        total_licenses: currentTotal + Number(licenseCount),
        status: 'active',
        purchase_date: new Date(),
      }, { transaction });
    } else {
      companyPackage = await CompanyPackage.create({
        company_id: companyId,
        package_id: Number(packageId),
        total_licenses: Number(licenseCount),
        used_licenses: 0,
        status: 'active',
        purchase_date: new Date(),
      }, { transaction });
    }

    return companyPackage;
  }

  /**
   * Envoie l'email d'activation au Manager B2B
   */
  async sendActivationEmail(admin, company, orderReference) {
    const dashboardUrl = process.env.B2B_DASHBOARD_URL || 'https://sl-business.studieslearning.com';
    const activationLink = `${dashboardUrl}/auth/activate?token=${admin.activation_token}&email=${admin.email}`;

    await MailService.sendEmail({
      to: admin.email,
      subject: `Activez votre espace B2B - ${company.name}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
          <div style="background: #1d3557; color: white; padding: 40px; text-align: center;">
            <h1>Bienvenue sur votre Dashboard B2B</h1>
            <p>${company.name}</p>
          </div>
          <div style="padding: 40px;">
            <p>Bonjour,</p>
            <p>Votre achat de package de formations a été validé avec succès.</p>
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
            <p>Une fois activé, vous pourrez gérer vos licences et collaborateurs.</p>
          </div>
        </div>
      `,
    });

    console.log(`[B2BPackageStrategy] Activation email sent to ${admin.email}`);
  }
}