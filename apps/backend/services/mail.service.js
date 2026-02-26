import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { InvoiceService } from "./invoice.service.js";
import { NotificationSettings } from "../models/index.js";

dotenv.config();

/**
 * Service to handle professional email communications
 */
export class MailService {
  static _transporter = null;

  /**
   * Initialize transporter lazily to ensure env vars are loaded
   */
  static getTransporter() {
    if (!this._transporter) {
      console.log(
        `[MailService] Initializing SMTP with host: ${process.env.MAIL_HOST}`,
      );
      this._transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT || "465"),
        secure: true,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });
    }
    return this._transporter;
  }

  /**
   * Send a professional email
   */
  static async sendEmail({ to, subject, html, attachments = [] }) {
    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
        to,
        subject,
        html,
        attachments,
      });
      console.log(`[MailService] Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`[MailService] Error sending email to ${to}:`, error);
      return null;
    }
  }

  /**
   * Send payment confirmation email with Invoice PDF
   * Falls back to email without PDF if Puppeteer is not available
   */
  static async sendPaymentSuccessNotification(intent, order) {
    let attachments = [];

    // Try to generate PDF invoice
    try {
      const pdfBuffer = await InvoiceService.generateInvoiceBuffer(
        intent,
        order,
      );
      if (pdfBuffer) {
        attachments = [
          {
            filename: `facture_${order.reference}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ];
      }
    } catch (pdfError) {
      console.warn(
        "[MailService] PDF generation failed (Puppeteer not available), sending email without attachment",
      );
    }

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #2c3e50; text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px;">Confirmation de Paiement</h2>
        <p>Bonjour <strong>${order.customerName}</strong>,</p>
        <p>Nous avons le plaisir de vous confirmer la réception de votre paiement.</p>
        <div style="background-color: #f4f7f6; padding: 20px; border-left: 4px solid #27ae60; margin: 20px 0;">
          <p style="margin: 0;"><strong>Montant :</strong> ${intent.amount} ${intent.currency}</p>
          <p style="margin: 0;"><strong>Commande :</strong> ${order.reference}</p>
          <p style="margin: 0;"><strong>Référence de paiement :</strong> ${intent.id}</p>
          <p style="margin: 0;"><strong>Statut :</strong> Payé</p>
        </div>
        ${attachments.length > 0
        ? "<p>Vous trouverez ci-joint la facture correspondant à cette transaction.</p>"
        : "<p>Votre facture sera disponible sous peu dans votre espace membre.</p>"
      }
        <p>Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:support@studieslearning.com" style="color: #2980b9;">support@studieslearning.com</a>.</p>
        <p>Cordialement,<br>L'équipe Studies Learning</p>
      </div>
    `;

    return await this.sendEmail({
      to: order.customerEmail,
      subject: `[Studies Learning] Confirmation de Paiement - ${order.reference}`,
      html,
      attachments,
    });
  }

  /**
   * Send payment failure notification
   */
  static async sendPaymentFailureNotification(
    intent,
    order,
    reason = "Échec de la transaction",
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #e74c3c; text-align: center; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">Problème de Paiement</h2>
        <p>Bonjour <strong>${order.customerName || "client"}</strong>,</p>
        <p>Nous n'avons pas pu valider votre paiement de <strong>${intent.amount} ${intent.currency}</strong> pour la commande <strong>${order.reference}</strong>.</p>
        <div style="background-color: #fdf2f2; padding: 20px; border-left: 4px solid #e74c3c; margin: 20px 0;">
          <p style="margin: 0;"><strong>Motif :</strong> ${reason}</p>
        </div>
        <p>Nous vous invitons à réessayer avec un autre moyen de paiement ou à contacter votre banque.</p>
        <p>Cordialement,<br>L'équipe Studies Learning</p>
      </div>
    `;

    return await this.sendEmail({
      to: order.customerEmail,
      subject: `[Important] Problème de Paiement - Commande ${order.reference}`,
      html,
    });
  }

  /**
   * Notify client that an installment plan has been set up
   */
  static async sendInstallmentPlanConfirmation(order, plan, payments) {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #2c3e50; text-align: center; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Échéancier de Paiement Activé</h2>
        <p>Bonjour <strong>${order.customerName}</strong>,</p>
        <p>Conformément à votre demande, un plan de paiement en <strong>${plan.numberOfInstallments} fois</strong> a été activé pour votre commande <strong>${order.reference}</strong>.</p>
        
        <h3 style="color: #2980b9; margin-top: 25px;">Votre Calendrier de Paiement</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 10px; border: 1px solid #eee; text-align: left;">Échéance</th>
              <th style="padding: 10px; border: 1px solid #eee; text-align: left;">Date Prévue</th>
              <th style="padding: 10px; border: 1px solid #eee; text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${payments
        .map(
          (p) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #eee;">N°${p.installmentNumber}</td>
                <td style="padding: 10px; border: 1px solid #eee;">${new Date(p.dueDate).toLocaleDateString("fr-FR")}</td>
                <td style="padding: 10px; border: 1px solid #eee; text-align: right;">${p.amount} ${plan.currency}</td>
              </tr>
            `,
        )
        .join("")}
          </tbody>
        </table>

        <p style="margin-top: 20px; font-size: 14px; background-color: #fff9db; padding: 10px; border-radius: 4px;">
          <strong>Note :</strong> Un rappel vous sera envoyé 3 jours avant chaque échéance. Merci de vous assurer que votre moyen de paiement est approvisionné.
        </p>

        <p>Nous restons à votre entière disposition.</p>
        <p>Cordialement,<br>L'équipe Studies Learning</p>
      </div>
    `;

    return await this.sendEmail({
      to: order.customerEmail,
      subject: `[Studies Learning] Activation de votre plan de paiement - ${order.reference}`,
      html,
    });
  }

  /**
   * Send a reminder for an upcoming installment payment
   */
  static async sendInstallmentReminder(order, installment, plan) {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #e67e22; text-align: center; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Rappel d'Échéance</h2>
        <p>Bonjour <strong>${order.customerName}</strong>,</p>
        <p>Ceci est un rappel concernant votre prochaine échéance de paiement pour la commande <strong>${order.reference}</strong>.</p>
        <div style="background-color: #fffaf0; padding: 20px; border-left: 4px solid #e67e22; margin: 20px 0;">
          <p style="margin: 0;"><strong>Échéance N° :</strong> ${installment.installmentNumber}</p>
          <p style="margin: 0;"><strong>Date limite :</strong> ${new Date(installment.dueDate).toLocaleDateString("fr-FR")}</p>
          <p style="margin: 0;"><strong>Montant :</strong> ${installment.amount} ${plan.currency}</p>
        </div>
        <p>Le prélèvement sera tenté automatiquement ou vous pouvez procéder au règlement via votre espace client.</p>
        <p>Cordialement,<br>L'équipe Studies Learning</p>
      </div>
    `;

    return await this.sendEmail({
      to: order.customerEmail,
      subject: `[Rappel] Votre échéance de paiement Studies Learning - ${order.reference}`,
      html,
    });
  }

  /**
   * Send a verification code for email validation
   */
  static async sendVerificationCode(email, code) {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #2c3e50; text-align: center; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Vérification de votre Email</h2>
        <p>Bonjour,</p>
        <p>Pour sécuriser votre achat sur <strong>Studies Learning</strong>, veuillez utiliser le code de vérification suivant :</p>
        <div style="background-color: #f4f7f6; padding: 30px; border-radius: 8px; text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #2c3e50;">${code}</span>
        </div>
        <p>Ce code est valable pendant <strong>15 minutes</strong>. Si vous n'avez pas initié cette demande, vous pouvez ignorer cet email.</p>
        <p>Cordialement,<br>L'équipe Studies Learning</p>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject: `[Studies Learning] Votre code de vérification : ${code}`,
      html,
    });
  }

  /**
   * Send notification to administrative stakeholders
   */
  static async sendAdminNotification(subject, message, toEmail = null) {
    const adminEmail = toEmail || process.env.ADMIN_EMAIL || "admin@studiesholding.com";
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #444; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e1e4e8; padding: 25px; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #0366d6; margin: 0;">PSP Backend Monitor</h2>
          <span style="font-size: 12px; color: #586069;">Alerte Système Automatique</span>
        </div>
        <p style="font-weight: bold; font-size: 16px;">${subject}</p>
        <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; border: 1px solid #d1d5da;">
          <p style="white-space: pre-wrap; margin: 0;">${message}</p>
        </div>
        <p style="font-size: 12px; color: #6a737d; margin-top: 20px; text-align: center;">
          Généré par le module Orchestrator le ${new Date().toLocaleString("fr-FR")}
        </p>
      </div>
    `;

    // Don't fail the main process if admin notification fails
    try {
      return await this.sendEmail({
        to: adminEmail,
        subject: `🚩 [PSP-ALERT] ${subject}`,
        html,
      });
    } catch (error) {
      console.warn(
        "[MailService] Admin notification failed (non-critical):",
        error.message,
      );
      return null;
    }
  }

  /**
   * Notify LMS Admins based on their settings
   */
  static async notifyLmsAdmins(eventType, order, intent = null) {
    try {
      const admins = await NotificationSettings.findAll({ where: { isActive: true } });
      if (!admins.length) return;

      const adminEmails = admins.filter(admin => {
        if (eventType === 'success' && admin.notifyOnSuccess) return true;
        if (eventType === 'failure' && admin.notifyOnFailure) return true;
        if (eventType === 'suspicious' && admin.notifyOnSuspicious) return true;
        return false;
      }).map(a => a.adminEmail);

      if (!adminEmails.length) return;

      let subject = '';
      let message = '';

      if (eventType === 'success') {
        subject = `✅ Succès Paiement LMS - ${order.reference}`;
        message = `Une nouvelle vente a été effectuée avec succès !\n\n` +
          `Client: ${order.customerName} (${order.customerEmail})\n` +
          `Montant: ${intent ? intent.amount + ' ' + intent.currency : 'N/A'}\n` +
          `Produit LMS: ID ${order.lmsItemId} (${order.lmsItemType})\n` +
          `Référence: ${order.reference}`;
      } else if (eventType === 'failure') {
        subject = `❌ Échec Paiement LMS - ${order.reference}`;
        message = `Une tentative de paiement a échoué.\n\n` +
          `Client: ${order.customerName} (${order.customerEmail})\n` +
          `Produit LMS: ID ${order.lmsItemId} (${order.lmsItemType})\n` +
          `Référence: ${order.reference}`;
      }

      for (const email of adminEmails) {
        await this.sendAdminNotification(subject, message, email);
      }
    } catch (error) {
      console.error("[MailService] Failed to notify LMS admins:", error);
    }
  }

  // ============================================================================
  // NOUVEAUX TEMPLATES - WORKFLOW LMS ORDERS
  // ============================================================================

  /**
   * Email: Confirmation paiement (SANS facture) - Phase 2
   * Envoyé automatiquement après réception du paiement
   */
  static async sendPaymentConfirmed(order) {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #27ae60; text-align: center; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">✅ Paiement Reçu</h2>
        
        <p>Bonjour <strong>${order.customerName || 'Client'}</strong>,</p>
        
        <p>Nous avons bien reçu votre paiement de <strong>${order.formationPrice} ${order.currency}</strong> pour la formation <strong>${order.formationName}</strong>.</p>
        
        <div style="background-color: #f4f7f6; padding: 20px; border-left: 4px solid #27ae60; margin: 20px 0;">
          <p style="margin: 0;"><strong>Référence:</strong> ${order.reference}</p>
          <p style="margin: 0;"><strong>Statut:</strong> En attente de validation</p>
        </div>
        
        <p>Notre équipe va vérifier votre paiement et traiter votre inscription dans les <strong>24 à 48 heures</strong>.</p>
        
        <p>Vous recevrez un email avec vos accès au campus une fois l'inscription finalisée.</p>
        
        <p>Cordialement,<br>L'équipe Studies Learning</p>
      </div>
    `;

    return await this.sendEmail({
      to: order.customerEmail,
      subject: `[Studies Learning] Paiement reçu - ${order.reference}`,
      html,
    });
  }

  /**
   * Email: Validation + Facture - Phase 3 (automatique après validation admin)
   */
  static async sendOrderValidated(order) {
    const recipientEmail = order.purchaseType === 'gift'
      ? order.beneficiaryEmail
      : order.customerEmail;

    const recipientName = order.purchaseType === 'gift'
      ? `${order.beneficiaryFirstName} ${order.beneficiaryLastName}`
      : order.customerName;

    let attachments = [];
    try {
      const pdfBuffer = await InvoiceService.generateInvoiceBuffer(null, order);
      if (pdfBuffer) {
        attachments = [{
          filename: `facture_${order.reference}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        }];
      }
    } catch (e) {
      console.warn("[MailService] PDF Invoice generation failed for validation email:", e.message);
    }

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -1px;">Félicitations !</h1>
          <p style="margin: 5px 0 0; opacity: 0.9; font-weight: 600;">Votre inscription est validée</p>
        </div>
        
        <div style="padding: 40px;">
          <p style="font-size: 16px; margin-top: 0;">Bonjour <strong>${recipientName || 'Étudiant'}</strong>,</p>
          
          <p>Nous avons le plaisir de vous informer que votre inscription à la formation <strong>${order.formationName}</strong> a été officiellement <strong>validée</strong> par notre équipe pédagogique.</p>
          
          <div style="background-color: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 30px 0;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #64748b; padding-bottom: 8px;">Référence</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a; padding-bottom: 8px;">${order.reference}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding-bottom: 8px;">Formation</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a; padding-bottom: 8px;">${order.formationName}</td>
              </tr>
              <tr>
                <td style="color: #64748b;">Montant Réglé</td>
                <td style="text-align: right; font-weight: 800; color: #10b981;">${order.formationPrice} ${order.currency}</td>
              </tr>
            </table>
          </div>
          
          <p style="background: #ecfdf5; color: #065f46; padding: 15px; border-radius: 8px; font-size: 14px; text-align: center; font-weight: 600;">
            📄 Votre facture officielle est jointe à cet email en format PDF.
          </p>
          
          <p>Nos services préparent actuellement la configuration de vos accès personnels au campus numérique <strong>Studies Learning</strong>. Vous recevrez très prochainement un email contenant vos identifiants sécurisés.</p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 13px;">L'équipe Studies Learning</p>
            <p style="margin: 5px 0 0; font-weight: 700; color: #0f172a;">Études. Inscriptions. Réussite.</p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `[Studies Learning] Validation d'inscription et Facture - ${order.reference}`,
      html,
      attachments,
    });
  }

  /**
   * Email: Rejet de commande - Phase 3
   */
  static async sendOrderRejected(order) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background: #ef4444; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Information d'Inscription</h1>
          <p style="margin: 5px 0 0; opacity: 0.9;">Concernant votre commande ${order.reference}</p>
        </div>
        
        <div style="padding: 40px;">
          <p>Bonjour <strong>${order.customerName || 'Client'}</strong>,</p>
          
          <p>Nous vous informons qu'après examen, votre paiement pour la formation <strong>${order.formationName}</strong> n'a pas pu être validé par nos services.</p>
          
          <div style="background-color: #fef2f2; padding: 20px; border-left: 4px solid #ef4444; border-radius: 4px; margin: 25px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: 600;">Motif du rejet :</p>
            <p style="margin: 5px 0 0; color: #b91c1c;">${order.rejectionReason || 'Preuve de paiement illisible ou transaction non confirmée.'}</p>
          </div>
          
          <p>Nous vous invitons à contacter notre support à <a href="mailto:support@studieslearning.com" style="color: #3b82f6;">support@studieslearning.com</a> pour régulariser votre situation.</p>
          
          <p style="margin-top: 30px;">Cordialement,<br>L'équipe Studies Learning</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: order.customerEmail,
      subject: `[Important] Statut de votre inscription Studies Learning - ${order.reference}`,
      html,
    });
  }

  /**
   * Email: Finalisation + Credentials + Facture - Phase 4
   * Ce email contient les identifiants de connexion au campus
   */
  static async sendOrderCompleted(order, credentials) {
    const recipientEmail = order.purchaseType === 'gift'
      ? order.beneficiaryEmail
      : order.customerEmail;

    const recipientName = order.purchaseType === 'gift'
      ? `${order.beneficiaryFirstName} ${order.beneficiaryLastName}`
      : order.customerName;

    let attachments = [];
    try {
      const pdfBuffer = await InvoiceService.generateInvoiceBuffer(null, order);
      if (pdfBuffer) {
        attachments = [{
          filename: `facture_${order.reference}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        }];
      }
    } catch (e) {
      console.warn("[MailService] PDF Invoice generation failed for completion email:", e.message);
    }

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #3b82f6, #1e3a8a); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -1px;">Bienvenue sur le Campus !</h1>
          <p style="margin: 5px 0 0; opacity: 0.9; font-weight: 600;">Vos accès sont maintenant prêts</p>
        </div>
        
        <div style="padding: 40px;">
          <p style="font-size: 16px; margin-top: 0;">Bonjour <strong>${recipientName || 'Étudiant'}</strong>,</p>
          
          <p>Félicitations ! Votre inscription à la formation <strong>${order.formationName}</strong> est maintenant terminée. Vous avez désormais accès à l'intégralité des ressources pédagogiques sur notre campus numérique.</p>
          
          <div style="background: #eff6ff; padding: 30px; border-radius: 16px; border: 1px solid #dbeafe; margin: 30px 0; text-align: center;">
            <h3 style="margin: 0 0 20px 0; color: #1e40af; font-size: 18px;">🔐 Vos Identifiants de Connexion</h3>
            <div style="display: inline-block; text-align: left; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Nom d'utilisateur :</p>
              <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #0f172a; font-family: monospace;">${credentials.username}</p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Mot de passe temporaire :</p>
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; font-family: monospace;">${credentials.password}</p>
            </div>
            <p style="margin: 20px 0 0 0; font-size: 12px; color: #3b82f6; font-weight: 600;">⚠️ Pour votre sécurité, changez votre mot de passe dès votre première connexion.</p>
          </div>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="https://campus.studieslearning.com" style="background: #2563eb; color: white; padding: 18px 35px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.4);">
              Accéder au Campus
            </a>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 30px 0; font-size: 13px; color: #64748b;">
             <strong>📄 Rappel :</strong> Votre facture acquittée est jointe à cet email pour vos archives administratives.
          </div>
          
          <p>Nous vous souhaitons un excellent parcours d'apprentissage !</p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 13px;">L'équipe pédagogique Studies Learning</p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `[Bienvenue] Vos accès au Campus Studies Learning - ${order.reference}`,
      html,
      attachments,
    });
  }
}
