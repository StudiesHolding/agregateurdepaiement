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
  CompanyThematique,
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


export class B2BThematiqueStrategy {
  async execute(event) {
    const { payload, correlationId } = event;
    const {
      companyName,
      companyEmail,
      companyId,
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
      // 0. Idempotence par commande : verrouiller la commande AVANT tout effet.
      //    Un rejeu ne doit pas re-provisionner une commande déjà traitée.
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
        console.log(`[B2BThematiqueStrategy:${correlationId}] Order ${orderReference} already provisioned — skipping`);
        return { success: true, alreadyProvisioned: true, orderReference };
      }

      // 1. Trouver l'entreprise (par id si fourni par le dashboard, sinon par e-mail)
      const company = await this.findOrCreateCompany(companyId, companyName, companyEmail, orderReference, transaction);

      // 2. CompanyAdmin (un admin déjà actif ne doit être ni modifié, ni réactivé)
      const { admin, sendActivationEmail } = await this.findOrCreateAdmin(
        company.id, adminEmail, adminFirstName, adminLastName, transaction
      );

      // 3. Créer/mettre à jour la CompanyThematique (avec expiration d'accès)
      await this.provisionThematique(company.id, thematiqueId, orderReference, transaction);

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

      if (sendActivationEmail) {
        await this.sendActivationEmail(admin, company, orderReference);
      } else {
        console.log(`[B2BThematiqueStrategy:${correlationId}] Admin ${admin.email} already active — no activation email`);
      }

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
      return { admin, sendActivationEmail: true };
    }

    if (isAdminActive(admin)) {
      // Compte déjà actif : ne surtout pas le désactiver ni casser son jeton.
      return { admin, sendActivationEmail: false };
    }

    await admin.update({
      activation_token: activationToken,
      token_expires_at: tokenExpires,
      is_active: false,
    }, { transaction });

    return { admin, sendActivationEmail: true };
  }

  /**
   * Crée ou met à jour une CompanyThematique (droit d'accès) avec la date
   * d'expiration (accès B2B valable N mois après l'achat) :
   * - création ⇒ maintenant + durée ;
   * - accès actif avec expiry_date future ⇒ date inchangée ;
   * - accès expiré, sans date ou de statut non actif ⇒ maintenant + durée ;
   * - les accès `cancelled` (comportement antérieur) ET `expired` sont réactivés.
   */
  async provisionThematique(companyId, thematiqueId, orderReference, transaction) {
    console.log(`[B2BThematiqueStrategy] Provisioning thematique ${thematiqueId} for company ${companyId}`);

    const now = new Date();
    const months = getB2BAccessValidityMonths();

    let companyThematique = await CompanyThematique.findOne({
      where: { company_id: companyId, authoring_thematique_id: thematiqueId },
      transaction,
    });

    if (companyThematique) {
      const update = { expiry_date: resolvePoolExpiryDate(companyThematique, now, months) };
      if (companyThematique.status === 'cancelled' || companyThematique.status === 'expired') {
        update.status = 'active'; // réactivation (annulées ET expirées)
      }
      await companyThematique.update(update, { transaction });
      console.log(`[B2BThematiqueStrategy] Thematique ${thematiqueId} already provisioned for company ${companyId} (status: ${companyThematique.status})`);
    } else {
      companyThematique = await CompanyThematique.create({
        company_id: companyId,
        authoring_thematique_id: thematiqueId,
        purchase_order_id: orderReference,
        purchase_date: now,
        status: 'active',
        expiry_date: computeB2BAccessExpiryDate(now, months),
      }, { transaction });
    }

    return companyThematique;
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
