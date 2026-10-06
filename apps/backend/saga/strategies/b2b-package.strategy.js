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
import {
  computeB2BAccessExpiryDate,
  getB2BAccessValidityMonths,
  isAdminActive,
  resolvePoolExpiryDate,
} from './b2b-access.js';


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
      companyId,
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
      // 0. Idempotence par commande : verrouiller la commande AVANT tout effet.
      //    Un rejeu (double notification PSP, job stalled rejoué après un
      //    plantage entre le commit et le marquage SUCCESS) ne doit pas ajouter
      //    les licences une seconde fois.
      const order = await Order.findOne({
        where: { reference: orderReference },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!order) {
        // Erreur définitive : jamais de provisionnement sans commande connue.
        throw new Error(`Order ${orderReference} not found: nothing provisioned`);
      }
      if (order.status === OrderStatus.COMPLETED) {
        await transaction.commit();
        console.log(`[B2BPackageStrategy:${correlationId}] Order ${orderReference} already provisioned — skipping`);
        return { success: true, alreadyProvisioned: true, orderReference };
      }

      // 1. Trouver l'entreprise (par id si fourni par le dashboard, sinon par e-mail)
      const company = await this.findOrCreateCompany(companyId, companyName, companyEmail, orderReference, transaction);

      // 2. Créer le CompanyAdmin avec token d'activation
      //    (un admin déjà actif ne doit être ni modifié, ni réactivé par e-mail)
      const { admin, sendActivationEmail } = await this.findOrCreateAdmin(
        company.id, adminEmail, adminFirstName, adminLastName, transaction
      );

      // 3. Créer ou mettre à jour le CompanyPackage (avec expiration d'accès)
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

      // 5. Email d'activation (après commit, uniquement si nécessaire)
      if (sendActivationEmail) {
        await this.sendActivationEmail(admin, company, orderReference);
      } else {
        console.log(`[B2BPackageStrategy:${correlationId}] Admin ${admin.email} already active — no activation email`);
      }

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
   * Trouve l'entreprise : par id (fixé côté serveur par le dashboard B2B
   * authentifié) si fourni, sinon recherche/création par e-mail.
   */
  async findOrCreateCompany(companyId, name, email, orderReference, transaction) {
    if (companyId) {
      const company = await Company.findByPk(companyId, { transaction });
      if (!company) {
        // Erreur définitive : jamais de création implicite sur un id serveur.
        throw new Error(`B2B company #${companyId} not found for order ${orderReference}`);
      }
      return company;
    }

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
   * Trouve ou crée un CompanyAdmin.
   * - Administrateur existant ET actif : ni jeton, ni is_active, ni e-mail modifiés.
   * - Administrateur existant inactif : nouveau jeton + e-mail d'activation.
   * - Nouvel administrateur : création + e-mail d'activation.
   *
   * @returns {Promise<{admin: Object, sendActivationEmail: boolean}>}
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
      return { admin, sendActivationEmail: true };
    }

    if (isAdminActive(admin)) {
      // Compte déjà actif : ne surtout pas le désactiver ni casser son jeton.
      return { admin, sendActivationEmail: false };
    }

    // Administrateur existant inactif : nouveau jeton d'activation
    await admin.update({
      activation_token: activationToken,
      token_expires_at: tokenExpires,
      is_active: false,
    }, { transaction });

    return { admin, sendActivationEmail: true };
  }

  /**
   * Crée ou met à jour un CompanyPackage (pool de licences) avec la date
   * d'expiration d'accès (accès B2B valable N mois après l'achat) :
   * - création ⇒ maintenant + durée ;
   * - pool actif avec expiry_date future ⇒ date inchangée ;
   * - pool expiré, sans date ou de statut non actif ⇒ maintenant + durée.
   */
  async provisionPackage(companyId, packageId, licenseCount, transaction) {
    const now = new Date();
    const months = getB2BAccessValidityMonths();

    let companyPackage = await CompanyPackage.findOne({
      where: { company_id: companyId, package_id: Number(packageId) },
      transaction,
    });

    if (companyPackage) {
      const currentTotal = Number(companyPackage.total_licenses);
      await companyPackage.update({
        total_licenses: currentTotal + Number(licenseCount),
        status: 'active',
        purchase_date: now,
        expiry_date: resolvePoolExpiryDate(companyPackage, now, months),
      }, { transaction });
    } else {
      companyPackage = await CompanyPackage.create({
        company_id: companyId,
        package_id: Number(packageId),
        total_licenses: Number(licenseCount),
        used_licenses: 0,
        status: 'active',
        purchase_date: now,
        expiry_date: computeB2BAccessExpiryDate(now, months),
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