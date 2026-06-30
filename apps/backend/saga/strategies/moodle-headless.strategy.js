/**
 * MoodleHeadlessStrategy
 *
 * Inscription Moodle via Authoring Engine + provisionnement SSO Studies.
 *
 * Règles métier :
 * - Formation doit exister dans sl_course_mapping (SYNCED) — validée en amont.
 * - Moodle : findOrCreate utilisateur + enrol (Authoring Engine).
 * - SSO magic-link : UNIQUEMENT si l'utilisateur n'a pas encore activé son compte
 *   (keycloak_id NULL ou mot de passe vide).
 * - Déjà inscrit sur Moodle (409) : succès idempotent ; email adapté au profil SSO.
 * - ATDD : mock possible via SAGA_MOCK_MOODLE_ENROLLMENT=true (NODE_ENV=test).
 */
import { M2MHttpClient } from '../m2m-http-client.service.js';
import { Order, sequelize } from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { QueryTypes } from 'sequelize';
import { MailService } from '../../services/mail.service.js';
import { FormationMappingService } from '../../services/formation-mapping.service.js';
import crypto from 'crypto';

export class MoodleHeadlessStrategy {
  constructor() {
    this.m2mClient = new M2MHttpClient();
    this.frontendUrl = process.env.NEWSTUDIES_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3004';
  }

  async execute(event) {
    const { payload, correlationId, source } = event;
    const {
      customerEmail,
      customerName,
      customerSurname,
      formationId,
      orderReference,
      auctionId,
    } = payload;

    console.log(`[MoodleHeadlessStrategy:${correlationId}] Starting for order ${orderReference}`);

    await FormationMappingService.assertFormationMappable(formationId);

    const userCtx = await this.resolveUser(customerEmail, customerName, customerSurname, correlationId);
    const magicToken = userCtx.ssoPending ? this.generateMagicToken() : null;
    const activationLink = magicToken
      ? this.buildActivationLink(customerEmail, magicToken)
      : `${this.frontendUrl}/auth/login/student`;

    let response;
    const useAtddMock =
      process.env.NODE_ENV === 'test' &&
      process.env.SAGA_MOCK_MOODLE_ENROLLMENT !== 'false';

    if (useAtddMock) {
      console.log(`[MoodleHeadlessStrategy:${correlationId}] ATDD mock enrollment`);
      const mapping = await FormationMappingService.resolveSyncedFormation(formationId);
      response = {
        status: 201,
        success: true,
        data: {
          status: 'success',
          data: {
            enrollmentId: `qa-${orderReference}`,
            formationId: String(formationId),
            moodleUserId: 1,
            moodleCourseId: mapping?.moodleCourseId ?? 1,
          },
        },
        correlationId,
      };
    } else {
      response = await this.m2mClient.post(
        '/api/v1/authoring/enrollments',
        {
          email: customerEmail,
          formationId: String(formationId),
          orderReference,
          customerName,
          customerSurname,
          source: source || 'RETAIL',
          auctionId: auctionId || null,
        },
        correlationId,
      );
    }

    switch (response.status) {
      case 201:
        await this.handleEnrollmentSuccess(
          orderReference,
          userCtx,
          response,
          magicToken,
          correlationId,
          customerEmail,
        );
        return {
          success: true,
          orderReference,
          userId: userCtx.userId,
          keycloakPending: Boolean(magicToken),
          activationLink,
          details: response.data,
          status: 'COMPLETED',
        };

      case 409:
        console.log(`[MoodleHeadlessStrategy:${correlationId}] Already enrolled (409) — idempotent`);
        await this.handleEnrollmentSuccess(
          orderReference,
          userCtx,
          response,
          magicToken,
          correlationId,
          customerEmail,
          { idempotent: true },
        );
        return {
          success: true,
          orderReference,
          userId: userCtx.userId,
          keycloakPending: Boolean(magicToken),
          activationLink,
          details: response.data,
          status: 'COMPLETED_IDEMPOTENT',
        };

      case 422:
        console.error(`[MoodleHeadlessStrategy:${correlationId}] Invalid formation (422): ${formationId}`);
        await this.handleEnrollmentFailure(orderReference, response);
        return {
          success: false,
          orderReference,
          details: response.data,
          status: 'FAILED_INVALID_FORMATION',
        };

      case 503:
        throw new MoodleRetryableError(response.data?.message || 'Moodle unavailable');

      default:
        throw new MoodleRetryableError(`Unexpected status: ${response.status}`);
    }
  }

  /**
   * Résout kyd4_users — SSO en attente si pas de compte activé (pas de keycloak_id + mot de passe).
   */
  async resolveUser(email, firstName, lastName, correlationId) {
    const [existing] = await sequelize.query(
      `SELECT ID, keycloak_id, user_pass FROM kyd4_users WHERE user_email = :email LIMIT 1`,
      { replacements: { email }, type: QueryTypes.SELECT },
    );

    if (existing) {
      const ssoPending = this.isSsoPending(existing);
      console.log(
        `[MoodleHeadlessStrategy:${correlationId}] User ID=${existing.ID} keycloak_id=${existing.keycloak_id || 'NULL'} ssoPending=${ssoPending}`,
      );
      return {
        userId: Number(existing.ID),
        isNewUser: false,
        ssoPending,
      };
    }

    const username =
      email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_') +
      '_' +
      crypto.randomBytes(4).toString('hex');
    const tempPassword = crypto.randomBytes(24).toString('hex');
    const now = new Date();

    const [insertId] = await sequelize.query(
      `INSERT INTO kyd4_users
       (user_login, user_pass, user_nicename, user_email, display_name, user_registered, keycloak_id)
       VALUES (:username, :password, :nicename, :email, :displayName, :now, NULL)`,
      {
        replacements: {
          username,
          password: crypto.createHash('md5').update(tempPassword).digest('hex'),
          nicename: `${firstName} ${lastName}`.toLowerCase().replace(/\s+/g, '-'),
          email,
          displayName: `${firstName} ${lastName}`,
          now,
        },
        type: QueryTypes.INSERT,
      },
    );

    console.log(`[MoodleHeadlessStrategy:${correlationId}] Created user ID=${insertId} (SSO pending)`);
    return { userId: Number(insertId), isNewUser: true, ssoPending: true };
  }

  /** Compte SSO actif = keycloak_id renseigné ET mot de passe défini */
  isSsoPending(userRow) {
    const hasKeycloak = Boolean(userRow.keycloak_id);
    const hasPassword = Boolean(userRow.user_pass && String(userRow.user_pass).length > 8);
    return !(hasKeycloak && hasPassword);
  }

  generateMagicToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  buildActivationLink(email, token) {
    return `${this.frontendUrl}/auth/activate?token=${token}&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent('/student/dashboard')}`;
  }

  async handleEnrollmentSuccess(
    orderReference,
    userCtx,
    response,
    magicToken,
    correlationId,
    customerEmail,
    options = {},
  ) {
    const enrollmentData = response.data?.data || {};
    const metadata = {
      keycloak_pending: Boolean(magicToken),
      kyd4_user_id: userCtx.userId,
      moodle_enrollment_id: enrollmentData.enrollmentId || '',
      moodle_user_id: enrollmentData.moodleUserId || '',
      moodle_course_id: enrollmentData.moodleCourseId || '',
      enrolled_at: new Date().toISOString(),
      activation_redirect: '/student/dashboard',
      moodle_idempotent: Boolean(options.idempotent),
    };

    if (magicToken) {
      metadata.keycloak_magic_token = magicToken;
      metadata.keycloak_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    await Order.update(
      {
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
        metadata: sequelize.literal(
          `JSON_MERGE_PATCH(COALESCE(metadata, '{}'), '${JSON.stringify(metadata).replace(/'/g, "''")}')`,
        ),
      },
      { where: { reference: orderReference } },
    );

    if (magicToken) {
      await this.sendActivationEmail(orderReference, customerEmail, magicToken, enrollmentData, correlationId);
    } else {
      await this.sendExistingUserEmail(orderReference, customerEmail, enrollmentData, correlationId, options.idempotent);
    }
  }

  async handleEnrollmentFailure(orderReference, response) {
    const errorMessage = response.data?.message || 'Unknown error';
    const errorCode = response.data?.code || 'UNKNOWN';

    await Order.update(
      {
        status: OrderStatus.FAILED,
        metadata: sequelize.literal(
          `JSON_SET(COALESCE(metadata, '{}'),
            '$.saga_error', ${sequelize.escape(errorMessage)},
            '$.saga_error_code', ${sequelize.escape(errorCode)},
            '$.saga_failed_at', '${new Date().toISOString()}'
          )`,
        ),
      },
      { where: { reference: orderReference } },
    );
  }

  async sendActivationEmail(orderReference, customerEmail, magicToken, enrollmentData, correlationId) {
    const activationLink = this.buildActivationLink(customerEmail, magicToken);
    const loginUrl = `${this.frontendUrl}/auth/login/student`;

    try {
      await MailService.sendEmail({
        to: customerEmail,
        subject: 'Bienvenue sur Studies Learning — Activez votre compte SSO',
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto;">
            <div style="background: linear-gradient(135deg, #1d3557, #457b9d); color: white; padding: 40px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0;">Bienvenue sur Studies Learning</h1>
              <p style="margin-top: 10px; opacity: 0.9;">Votre formation est prête</p>
            </div>
            <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
              <p>Bonjour,</p>
              <p>Votre inscription à la formation a été confirmée sur notre plateforme Moodle.</p>
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Formation :</strong> ${enrollmentData.formationId || 'N/A'}</p>
                <p><strong>Référence :</strong> ${orderReference}</p>
              </div>
              <p><strong>Première connexion ?</strong> Activez votre compte SSO (lien à usage unique, 24h) :</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${activationLink}" style="background: #1d3557; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
                  Activez votre compte
                </a>
              </div>
              <p style="font-size: 14px; color: #64748b;">Déjà activé ? <a href="${loginUrl}">Connectez-vous ici</a>.</p>
            </div>
          </div>
        `,
      });
      console.log(`[MoodleHeadlessStrategy:${correlationId}] Activation email → ${customerEmail}`);
    } catch (err) {
      console.error(`[MoodleHeadlessStrategy] Activation email failed for ${orderReference}:`, err.message);
    }
  }

  async sendExistingUserEmail(orderReference, customerEmail, enrollmentData, correlationId, idempotent = false) {
    const loginUrl = `${this.frontendUrl}/auth/login/student`;
    const subject = idempotent
      ? 'Studies Learning — Vous êtes déjà inscrit à cette formation'
      : 'Studies Learning — Votre formation est disponible';

    try {
      await MailService.sendEmail({
        to: customerEmail,
        subject,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px;">
            <h1 style="color: #1d3557;">${idempotent ? 'Inscription confirmée' : 'Formation disponible'}</h1>
            <p>Bonjour,</p>
            <p>${
              idempotent
                ? 'Vous étiez déjà inscrit(e) à cette formation sur Moodle. Votre accès reste actif.'
                : 'Votre achat est confirmé et votre formation est accessible.'
            }</p>
            <p><strong>Formation :</strong> ${enrollmentData.formationId || 'N/A'} — <strong>Réf. :</strong> ${orderReference}</p>
            <p>Connectez-vous avec votre compte Studies Learning existant :</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${loginUrl}" style="background: #1d3557; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700;">
                Accéder à mon espace
              </a>
            </p>
            <p style="font-size: 14px; color: #64748b;">Aucun nouveau compte n'a été créé — vous utilisez vos identifiants habituels.</p>
          </div>
        `,
      });
      console.log(`[MoodleHeadlessStrategy:${correlationId}] Existing-user email → ${customerEmail}`);
    } catch (err) {
      console.error(`[MoodleHeadlessStrategy] Existing-user email failed:`, err.message);
    }
  }
}

export class MoodleRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MoodleRetryableError';
  }
}
