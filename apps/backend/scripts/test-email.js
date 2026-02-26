/**
 * Script de test d'envoi d'emails
 * Usage: node scripts/test-email.js
 */

import 'dotenv/config';
import nodemailer from 'nodemailer';

async function testEmail() {
    console.log('📧 Test de configuration SMTP...\n');

    // Configuration du transporteur
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'smtp.ionos.fr',
        port: parseInt(process.env.MAIL_PORT) || 465,
        secure: true, // SSL
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    });

    // Vérifier la connexion
    console.log('🔌 Connexion au serveur SMTP...');
    try {
        await transporter.verify();
        console.log('✅ Connexion SMTP réussie!\n');
    } catch (error) {
        console.error('❌ Erreur de connexion SMTP:', error.message);
        process.exit(1);
    }

    // Email de test
    const testOrder = {
        reference: 'ORD-TEST-001',
        customerName: 'Jean Dupont',
        totalAmount: 50000,
        currency: 'XAF',
        lmsItemId: 'COURSE-001',
        lmsItemType: 'course',
        createdAt: new Date(),
    };

    console.log('📤 Envoi du email de test (Paiement confirmé)...');
    
    const mailOptions = {
        from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
        to: 'booalbert60@gmail.com', // Email de test fourni par l'utilisateur
        subject: '🧪 Test - Paiement confirmé - Studies Learning',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Studies Learning</h1>
                        <p style="color: white; margin: 10px 0 0; opacity: 0.9;">Paiement Confirmé</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px;">
                        <h2 style="color: #333; margin-top: 0;">Bonjour ${testOrder.customerName},</h2>
                        
                        <p style="color: #666; line-height: 1.6;">
                            Nous avons reçu votre paiement. Votre commande est en cours de traitement.
                        </p>
                        
                        <!-- Order Details -->
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                            <h3 style="margin: 0 0 15px; color: #333; font-size: 16px;">Détails de la commande</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #666;">Référence</td>
                                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #667eea;">${testOrder.reference}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666;">Formation</td>
                                    <td style="padding: 8px 0; text-align: right;">${testOrder.lmsItemId}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666;">Montant</td>
                                    <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #28a745;">${(testOrder.totalAmount / 100).toLocaleString('fr-FR')} ${testOrder.currency}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6;">
                            Vous recevrez un email de confirmation une fois votre commande validée par notre équipe.
                        </p>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">Suivre ma commande</a>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                        <p style="color: #999; margin: 0; font-size: 12px;">
                            © 2026 Studies Learning. Tous droits réservés.<br>
                            Cet email a été envoyé à des fins de test.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email envoyé avec succès!');
        console.log('📬 Message ID:', info.messageId);
        console.log('📧 Destinataire:', info.accepted.join(', '));
        console.log('\n📝 Vérifiez votre boîte mail (et spam)!');
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi:', error.message);
        process.exit(1);
    }
}

// Exécuter le test
testEmail();
