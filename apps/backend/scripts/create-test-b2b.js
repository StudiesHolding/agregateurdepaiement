import { Company, CompanyAdmin, sequelize } from "../models/index.js";
import { B2BProvisioningService } from "../services/b2b-provisioning.service.js";
import dotenv from "dotenv";

dotenv.config();

const createTestB2BAccess = async (companyName, adminEmail) => {
  console.log(`🚀 Création d'un accès test B2B pour : ${companyName} (${adminEmail})`);

  try {
    // Simuler une commande (Order) minimale pour le service de provisioning
    const mockOrder = {
      reference: `TEST-B2B-${Date.now()}`,
      customerName: companyName,
      customerEmail: adminEmail,
      formationId: 16, // Utilisation d'un ID existant dans sl_formation_packages
      metadata: {
        company_name: companyName,
        company_admin_email: adminEmail,
        licence_count: 5,
        is_b2b: true,
        formation_id: 16
      }
    };

    const result = await B2BProvisioningService.handleB2BOrder(mockOrder);

    if (result.success) {
      console.log("✅ Accès B2B créé avec succès !");
      console.log(`🏢 Entreprise ID : ${result.companyId}`);
      console.log(`📧 Un email d'activation a été envoyé à : ${adminEmail}`);
      
      // Récupérer le token pour affichage console (pour test sans email)
      const admin = await CompanyAdmin.findOne({ where: { email: adminEmail } });
      if (admin && admin.metadata && admin.metadata.activation_token) {
        const dashboardUrl = process.env.B2B_DASHBOARD_URL || "https://sl-business.studieslearning.com";
        const activationLink = `${dashboardUrl}/auth/activate?token=${admin.metadata.activation_token}&email=${admin.email}`;
        console.log(`\n🔗 Lien d'activation (pour test) : \n${activationLink}\n`);
      }
    }

  } catch (error) {
    console.error("❌ Erreur lors de la création de l'accès test :", error.message);
  } finally {
    await sequelize.close();
  }
};

// Récupération des arguments de la ligne de commande
const args = process.argv.slice(2);
const name = args[0] || "Entreprise Test";
const email = args[1] || "admin-test@example.com";

createTestB2BAccess(name, email);
