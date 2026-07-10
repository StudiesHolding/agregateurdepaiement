/**
 * Activation SSO — magic-link post-achat MOODLE_HEADLESS / invitation B2B collaborateur.
 */
import crypto from "crypto";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import { Order, Employee } from "../models/index.js";
import { OrderStatus } from "../enums/index.js";

export class SsoActivationService {
  static get frontendUrl() {
    return process.env.FRONTEND_URL || process.env.NEWSTUDIES_FRONTEND_URL || "http://localhost:3004";
  }

  static buildActivationLink(email, token, redirect = "/student/dashboard") {
    const base = this.frontendUrl.replace(/\/$/, "");
    return `${base}/auth/activate?token=${token}&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirect)}`;
  }

  static generateInvitationToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Active un compte via magic-link.
   */
  static async activate({ token, email, password }) {
    if (!token || !email || !password) {
      throw Object.assign(new Error("token, email et password requis"), { statusCode: 400 });
    }

    if (password.length < 8) {
      throw Object.assign(new Error("Le mot de passe doit contenir au moins 8 caractères"), {
        statusCode: 400,
      });
    }

    const context = await this.resolveActivationContext(token, email);
    if (!context) {
      throw Object.assign(new Error("Lien d'activation invalide ou expiré"), { statusCode: 401 });
    }

    const expiresAt = context.expiresAt ? new Date(context.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      throw Object.assign(new Error("Le lien d'activation a expiré"), { statusCode: 401 });
    }

    let [user] = await sequelize.query(
      `SELECT ID, keycloak_id, user_pass FROM kyd4_users WHERE user_email = :email LIMIT 1`,
      { replacements: { email }, type: QueryTypes.SELECT },
    );

    const hasActiveSso =
      user?.keycloak_id && user?.user_pass && String(user.user_pass).length > 8;

    if (hasActiveSso) {
      throw Object.assign(
        new Error(
          "Ce compte est déjà activé. Connectez-vous avec votre email et votre mot de passe.",
        ),
        { statusCode: 409, code: "SSO_ALREADY_ACTIVE" },
      );
    }

    if (!user) {
      const username = email.split("@")[0].replace(/[^a-z0-9]/g, "_");
      const [insertId] = await sequelize.query(
        `INSERT INTO kyd4_users (user_login, user_pass, user_email, user_registered, display_name, keycloak_id)
         VALUES (:login, '', :email, NOW(), :displayName, NULL)`,
        {
          replacements: {
            login: `${username}_${Date.now().toString(36)}`,
            email,
            displayName: email,
          },
          type: QueryTypes.INSERT,
        },
      );
      user = { ID: insertId, keycloak_id: null };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const keycloakId = user.keycloak_id || `kc-${crypto.randomUUID()}`;

    await sequelize.query(
      `UPDATE kyd4_users SET user_pass = :pass, keycloak_id = :kcId WHERE ID = :id`,
      {
        replacements: { pass: passwordHash, kcId: keycloakId, id: user.ID },
      },
    );

    if (context.orderId) {
      await this.ensureStudentRole(user.ID, true);
      await Order.update(
        {
          metadata: sequelize.literal(
            `JSON_SET(COALESCE(metadata, '{}'),
              '$.keycloak_pending', false,
              '$.keycloak_activated_at', '${new Date().toISOString()}',
              '$.keycloak_magic_token', NULL
            )`,
          ),
        },
        { where: { id: context.orderId } },
      );
    }

    if (context.employeeId) {
      const employee = await Employee.findByPk(context.employeeId);
      if (employee) {
        const meta = { ...(employee.metadata || {}), activated_at: new Date().toISOString() };
        delete meta.activation_token;
        delete meta.token_expires;
        await employee.update({ metadata: meta, is_active: true });
      }
    }

    return {
      success: true,
      email,
      keycloakId,
      redirect: context.redirect || "/student/dashboard",
    };
  }

  static parseMetadata(raw) {
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  }

  static async resolveActivationContext(token, email) {
    const orders = await Order.findAll({
      where: { customerEmail: email },
      order: [["updated_at", "DESC"]],
      limit: 30,
    });

    for (const order of orders) {
      const meta = this.parseMetadata(order.metadata);
      if (meta.keycloak_magic_token === token) {
        return {
          orderId: order.id,
          expiresAt: meta.keycloak_token_expires,
          redirect: meta.activation_redirect || "/student/dashboard",
        };
      }
    }

    const employee = await Employee.findOne({ where: { email } });
    let meta = employee?.metadata || {};
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = {};
      }
    }

    if (employee && meta.activation_token === token) {
      return {
        employeeId: employee.id,
        expiresAt: meta.token_expires,
        redirect: "/student/dashboard",
      };
    }

    return null;
  }

  /**
   * Obtient un token admin Keycloak pour créer des utilisateurs.
   */
  static async getKeycloakAdminToken() {
    const baseUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'studies-learning';
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'admin-cli';
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
    
    const res = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    
    if (!res.ok) {
      throw new Error(`Keycloak token error: ${res.status}`);
    }
    
    const data = await res.json();
    return data.access_token;
  }

  /** Rôle étudiant WordPress (subscriber → student côté NewStudies) */
  static async ensureStudentRole(userId, force = false) {
    const caps = 'a:1:{s:10:"subscriber";b:1;}';
    const [existing] = await sequelize.query(
      `SELECT umeta_id FROM kyd4_usermeta WHERE user_id = :id AND meta_key = 'kyd4_capabilities' LIMIT 1`,
      { replacements: { id: userId }, type: QueryTypes.SELECT },
    );
    if (existing && !force) return;
    if (existing) {
      await sequelize.query(
        `UPDATE kyd4_usermeta SET meta_value = :caps WHERE user_id = :id AND meta_key = 'kyd4_capabilities'`,
        { replacements: { id: userId, caps } },
      );
    } else {
      await sequelize.query(
        `INSERT INTO kyd4_usermeta (user_id, meta_key, meta_value) VALUES (:id, 'kyd4_capabilities', :caps)`,
        { replacements: { id: userId, caps } },
      );
    }
  }
}
