/**
 * MoodleHeadlessStrategy
 *
 * Stratégie d'enrollment via l'Authoring Engine (Moodle Headless).
 * Gère le cycle de vie SSO Keycloak :
 * 1. Vérifie/crée l'utilisateur dans kyd4_users avec keycloak_id = NULL
 * 2. Génère le magic-link d'activation Keycloak
 * 3. Appelle POST /api/v1/authoring/enrollments (M2M HMAC)
 * 4. Analyse les codes retour (201, 409 = succès / 422 = fail / 503 = retry)
 * 5. Met à jour les métadonnées avec keycloak_pending = true
 * 6. Envoie l'email de bienvenue avec lien d'activation SSO
 */
import { M2MHttpClient } from '../m2m-http-client.service.js';
import { Order, sequelize } from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { QueryTypes } from 'sequelize';
import { MailService } from '../../services/mail.service.js';
import crypto from 'crypto';

export class MoodleHeadlessStrategy {
  constructor() {
    this.m2mClient = new M2MHttpClient();
    this.keycloakBaseUrl = process.env.KEYCLOAK_BASE_URL || 'https://sso.studieslearning.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://studieslearning.com';
  }

  /**
   * Exécute la stratégie d'enrollment avec provisionnement SSO Keycloak
   * @param {Object} event - Événement de la queue
   * @returns {Promise<Object>}
   */
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

    // ÉTAPE 1 : Résoudre ou créer l'utilisateur dans kyd4_users
    const { userId, isNewUser } = await this.resolveUser(
      customerEmail, customerName, customerSurname, correlationId
    );

    // ÉTAPE 2 : Générer le magic-link d'activation Keycloak
    const magicToken = this.generateMagicToken();
    const activationLink = this.buildActivationLink(customerEmail, magicToken);

    // ÉTAPE 3 : Appel sécurisé à l'Authoring Engine
    const response = await this.m2mClient.post(
      '/api/v1/authoring/enrollments',
      {
        email: customerEmail,
        formationId,
        orderReference,
        customerName,
        customerSurname,
        source: source || 'RETAIL',
        auctionId: auctionId || null,
      },
      correlationId
    );

    // ÉTAPE 4 : Analyse du code retour
    switch (response.status) {
      case 201:
        await this.handleEnrollmentSuccess(
          orderReference, userId, response, magicToken, correlationId
        );
        return {
          success: true,
          orderReference,
          userId,
          keycloakPending: true,
          activationLink,
          details: response.data,
          status: 'COMPLETED',
        };

      case 409:
        // Déjà inscrit — considéré comme un succès (idempotence)
        console.log(`[MoodleHeadlessStrategy:${correlationId}] User already enrolled (409) — idempotent success`);
        await this.handleEnrollmentSuccess(
          orderReference, userId, response, magicToken, correlationId
        );
        return {
          success: true,
          orderReference,
          userId,
          keycloakPending: true,
          activationLink,
          details: response.data,
          status: 'COMPLETED_IDEMPOTENT',
        };

      case 422:
        // Formation invalide — erreur métier définitive
        console.error(`[MoodleHeadlessStrategy:${correlationId}] Invalid formation (422): ${formationId}`);
        await this.handleEnrollmentFailure(orderReference, response);
        return {
          success: false,
          orderReference,
          details: response.data,
          status: 'FAILED_INVALID_FORMATION',
        };

      case 503:
        // Moodle indisponible — retry BullMQ
        console.warn(`[MoodleHeadlessStrategy:${correlationId}] Moodle unavailable (503) — will retry`);
        throw new MoodleRetryableError(response.data?.message || 'Moodle unavailable');

      default:
        console.warn(`[MoodleHeadlessStrategy:${correlationId}] Unexpected status ${response.status} — will retry`);
        throw new MoodleRetryableError(`Unexpected status: ${response.status}`);
    }
  }

  /**
   * Résout le kyd4_users.ID : trouve ou crée l'utilisateur.
   * keycloak_id = NULL tant que l'utilisateur n'a pas activé son SSO.
   */
  async resolveUser(email, firstName, lastName, correlationId) {
    const [existing] = await sequelize.query(
      `SELECT ID, keycloak_id FROM kyd4_users WHERE user_email = :email LIMIT 1`,
      {
        replacements: { email },
        type: QueryTypes.SELECT,
      }
    );

    if (existing) {
      console.log(`[MoodleHeadlessStrategy:${correlationId}] Found existing user ID=${existing.ID}, keycloak_id=${existing.keycloak_id || 'NULL'}`);
      return {
        userId: Number(existing.ID),
        isNewUser: false,
      };
    }

    // Création du compte avec keycloak_id = NULL (activation SSO en attente)
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_')
      + '_' + crypto.randomBytes(4).toString('hex');
    const tempPassword = crypto.randomBytes(24).toString('hex');
    const now = new Date();

    const [result] = await sequelize.query(
      `INSERT INTO kyd4_users
       (user_login, user_pass, user_nicename, user_email, display_name,
        user_registered, keycloak_id)
       VALUES (:username, :password, :nicename, :email, :displayName,
               :now, NULL)`,
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
      }
    );

    console.log(`[MoodleHeadlessStrategy:${correlationId}] Created new user ID=${result} with keycloak_id=NULL`);
    return {
      userId: Number(result),
      isNewUser: true,
    };
  }

  /**
   * Génère un token d'activation unique pour le SSO Keycloak
   */
  generateMagicToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Construit le lien d'activation Keycloak (magic-link)
   * L'utilisateur clique sur ce lien pour activer son SSO au premier login
   */
  buildActivationLink(email, token) {
    return `${this.frontendUrl}/auth/activate?token=${token}&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent('/dashboard')}`;
  }

  /**
   * Gère le succès d'enrollment : met à jour la commande et notifie l'utilisateur
   */
  async handleEnrollmentSuccess(orderReference, userId, response, magicToken, correlationId) {
    const metadata = {
      keycloak_pending: true,
      keycloak_magic_token: magicToken,
      kyd4_user_id: userId,
      moodle_enrollment_id: response.data?.data?.enrollmentId || '',
      moodle_user_id: response.data?.data?.moodleUserId || '',
      moodle_course_id: response.data?.data?.moodleCourseId || '',
      enrolled_at: new Date().toISOString(),
    };

    await Order.update(
      {
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
        metadata: sequelize.literal(
          `JSON_MERGE_PATCH(COALESCE(metadata, '{}'), '${JSON.stringify(metadata).replace(/'/g, "''")}')`
        ),
      },
      { where: { reference: orderReference } }
    );

    // Envoi de l'email de bienvenue avec le lien d'activation Keycloak
    await this.sendWelcomeEmail(orderReference, response, correlationId);

    console.log(`[MoodleHeadlessStrategy:${correlationId}] ✅ Order ${orderReference} completed — SSO pending`);
  }

  /**
   * Gère l'échec définitif (formation invalide)
   */
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
          )`
        ),
      },
      { where: { reference: orderReference } }
    );

    console.error(`[MoodleHeadlessStrategy] Order ${orderReference} FAILED: ${errorCode} — ${errorMessage}`);
  }

  /**
   * Envoie l'email de bienvenue avec le magic-link d'activation Keycloak
   */
  async sendWelcomeEmail(orderReference, response, correlationId) {
    const enrollmentData = response.data?.data || {};

    try {
      await MailService.sendEmail({
        to: correlationId.includes('@') ? correlationId : 'destinataire', // Note: à remplacer par customerEmail du payload
        subject: 'Bienvenue sur Studies Learning — Activez votre compte SSO',
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto;">
            <div style="background: linear-gradient(135deg, #1d3557, #457b9d); color: white; padding: 40px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0;">Bienvenue sur Studies Learning</h1>
              <p style="margin-top: 10px; opacity: 0.9;">Votre formation est prête</p>
            </div>
            <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
              <p>Bonjour,</p>
              <p>Votre accès à la formation a été créé avec succès.</p>
              ${enrollmentData.moodleCourseId ? `
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Formation :</strong> ${enrollmentData.formationId || 'N/A'}</p>
                  <p><strong>Référence :</strong> ${orderReference}</p>
                </div>
              ` : ''}
              <p>Pour activer votre compte et accéder à votre espace de formation, cliquez sur le bouton ci-dessous :</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${this.buildActivationLink(correlationId, '')}"
                   style="background: #1d3557; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
                  Activer mon compte
                </a>
              </div>
              <p style="font-size: 14px; color: #64748b;">Ce lien est à usage unique et expirera dans 24 heures.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              <p style="font-size: 14px; color: #64748b;">Une fois votre compte activé, vous pourrez vous connecter avec votre email et le mot de passe que vous aurez défini.</p>
              <p>Cordialement,<br>L'équipe Studies Learning</p>
            </div>
          </div>
        `,
      });

      console.log(`[MoodleHeadlessStrategy] Welcome email sent for order ${orderReference}`);
    } catch (err) {
      console.error(`[MoodleHeadlessStrategy] Failed to send welcome email for ${orderReference}:`, err.message);
      // L'échec d'email ne doit pas bloquer la saga
    }
  }
}

/**
 * Erreur retryable pour BullMQ
 * Levée quand Moodle est indisponible (503) ou en cas de code inattendu
 */
export class MoodleRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MoodleRetryableError';
  }
}