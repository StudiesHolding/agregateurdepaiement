#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const setupMonitoring = async () => {
  try {
    console.log("🔧 MISE EN PLACE DU MONITORING DE BASE DE DONNÉES");
    console.log("=" .repeat(80));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Create monitoring directory
    const monitoringDir = path.join(process.cwd(), 'monitoring');
    if (!fs.existsSync(monitoringDir)) {
      fs.mkdirSync(monitoringDir);
    }
    
    console.log("📦 Création des scripts de monitoring...");
    
    // 1. Create startup validation script
    await createStartupValidation();
    
    // 2. Create health check script
    await createHealthCheck();
    
    // 3. Create weekly report script
    await createWeeklyReport();
    
    // 4. Update server.js to include startup validation
    await updateServerWithMonitoring();
    
    console.log("\n" + "=".repeat(80));
    console.log("🎉 MONITORING MIS EN PLACE AVEC SUCCÈS");
    console.log("=".repeat(80));
    
    console.log("📋 Composants créés:");
    console.log("   ✅ Validation au démarrage du serveur");
    console.log("   ✅ Health check automatique");
    console.log("   ✅ Rapports hebdomadaires");
    console.log("   ✅ Alertes sur incohérences");
    
    console.log("\n🚀 Prochaines étapes:");
    console.log("   • Redémarrez le serveur pour activer le monitoring");
    console.log("   • Exécutez 'npm run db:health-check' pour tester");
    console.log("   • Consultez 'monitoring/' pour les rapports");
    
  } catch (error) {
    console.error("❌ Erreur lors de la mise en place du monitoring:", error);
    console.error("Détails:", error.message);
    process.exit(1);
  }
};

const createStartupValidation = async () => {
  const startupValidationScript = `
import { sequelize } from "../models/index.js";

export const validateDatabaseOnStartup = async () => {
  try {
    console.log("🔍 Validation de la base de données au démarrage...");
    
    await sequelize.authenticate();
    
    const models = sequelize.models;
    const issues = [];
    
    for (const [modelName, model] of Object.entries(models)) {
      try {
        // Test basic model operation
        await model.count();
        
        // Check structure
        const modelColumns = Object.keys(model.rawAttributes);
        const [tableColumns] = await sequelize.query(\`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = DATABASE() AND table_name = '\${model.tableName}'
        \`);
        
        const actualColumns = tableColumns.map(col => col.column_name);
        const missingColumns = modelColumns.filter(col => !actualColumns.includes(col));
        
        if (missingColumns.length > 0) {
          issues.push({
            model: modelName,
            type: 'missing_columns',
            columns: missingColumns
          });
        }
        
      } catch (error) {
        issues.push({
          model: modelName,
          type: 'model_error',
          error: error.message
        });
      }
    }
    
    if (issues.length > 0) {
      console.log("⚠️  Problèmes détectés au démarrage:");
      issues.forEach(issue => {
        console.log(\`   • \${issue.model}: \${issue.type}\${issue.columns ? \` (\${issue.columns.join(', ')})\` : ''}\`);
      });
      
      // Save issues to monitoring file
      const monitoringPath = path.join(process.cwd(), 'monitoring', 'startup-issues.json');
      fs.writeFileSync(monitoringPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        issues
      }, null, 2));
      
      return false;
    }
    
    console.log("✅ Base de données validée au démarrage");
    return true;
    
  } catch (error) {
    console.error("❌ Erreur lors de la validation au démarrage:", error.message);
    return false;
  }
};
`;
  
  const filePath = path.join(process.cwd(), 'scripts', 'startup-db-validation.js');
  fs.writeFileSync(filePath, startupValidationScript);
  console.log("   ✅ Script de validation au démarrage créé");
};

const createHealthCheck = async () => {
  const healthCheckScript = `#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import fs from 'fs';
import path from 'path';

const runHealthCheck = async () => {
  try {
    console.log("🏥 HEALTH CHECK DE LA BASE DE DONNÉES");
    console.log("=" .repeat(60));
    
    const startTime = Date.now();
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion OK");
    
    const models = sequelize.models;
    let healthyModels = 0;
    let unhealthyModels = 0;
    const issues = [];
    
    for (const [modelName, model] of Object.entries(models)) {
      try {
        const testStart = Date.now();
        await model.count();
        const testTime = Date.now() - testStart;
        
        healthyModels++;
        console.log(\`   ✅ \${modelName} (\${testTime}ms)\`);
        
      } catch (error) {
        unhealthyModels++;
        issues.push({
          model: modelName,
          error: error.message
        });
        console.log(\`   ❌ \${modelName}: \${error.message}\`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log("\\n" + "=".repeat(60));
    console.log("📊 RÉSULTATS DU HEALTH CHECK");
    console.log("=".repeat(60));
    console.log(\`⏱️  Temps total: \${totalTime}ms\`);
    console.log(\`✅ Modèles sains: \${healthyModels}\`);
    console.log(\`❌ Modèles en erreur: \${unhealthyModels}\`);
    
    // Save health check results
    const healthPath = path.join(process.cwd(), 'monitoring', 'health-check.json');
    const healthData = {
      timestamp: new Date().toISOString(),
      totalTime,
      healthyModels,
      unhealthyModels,
      issues
    };
    
    fs.writeFileSync(healthPath, JSON.stringify(healthData, null, 2));
    
    if (unhealthyModels === 0) {
      console.log("🎉 BASE DE DONNÉES EN PARFAITE SANTÉ");
      process.exit(0);
    } else {
      console.log("⚠️  PROBLÈMES DÉTECTÉS - Voir le rapport détaillé");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Erreur lors du health check:", error.message);
    process.exit(1);
  }
};

runHealthCheck();
`;
  
  const filePath = path.join(process.cwd(), 'scripts', 'db-health-check.js');
  fs.writeFileSync(filePath, healthCheckScript);
  fs.chmodSync(filePath, '755'); // Make executable
  console.log("   ✅ Script de health check créé");
};

const createWeeklyReport = async () => {
  const weeklyReportScript = `#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import fs from 'fs';
import path from 'path';

const generateWeeklyReport = async () => {
  try {
    console.log("📊 GÉNÉRATION DU RAPPORT HEBDOMADAIRE");
    console.log("=" .repeat(60));
    
    const reportData = {
      timestamp: new Date().toISOString(),
      week: new Date().getWeek(),
      database: {
        connection: false,
        totalModels: 0,
        healthyModels: 0,
        issues: []
      },
      performance: {
        slowQueries: [],
        modelPerformance: {}
      },
      recommendations: []
    };
    
    // Test connection
    await sequelize.authenticate();
    reportData.database.connection = true;
    console.log("✅ Connexion OK");
    
    // Analyze all models
    const models = sequelize.models;
    reportData.database.totalModels = Object.keys(models).length;
    
    for (const [modelName, model] of Object.entries(models)) {
      try {
        const startTime = Date.now();
        const count = await model.count();
        const responseTime = Date.now() - startTime;
        
        reportData.database.healthyModels++;
        reportData.performance.modelPerformance[modelName] = {
          recordCount: count,
          responseTime,
          status: responseTime > 1000 ? 'slow' : 'ok'
        };
        
        if (responseTime > 1000) {
          reportData.performance.slowQueries.push({
            model: modelName,
            responseTime,
            recordCount: count
          });
        }
        
      } catch (error) {
        reportData.database.issues.push({
          model: modelName,
          error: error.message
        });
      }
    }
    
    // Generate recommendations
    if (reportData.performance.slowQueries.length > 0) {
      reportData.recommendations.push("Considérer l'ajout d'indexes pour les modèles lents");
    }
    
    if (reportData.database.issues.length > 0) {
      reportData.recommendations.push("Résoudre les problèmes de modèles détectés");
    }
    
    // Save report
    const reportsDir = path.join(process.cwd(), 'monitoring', 'weekly-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }
    
    const reportPath = path.join(reportsDir, \`week-\${reportData.week}.json\`);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(\`📋 Rapport sauvegardé: week-\${reportData.week}.json\`);
    console.log(\`✅ \${reportData.database.healthyModels}/\${reportData.database.totalModels} modèles sains\`);
    
    if (reportData.recommendations.length > 0) {
      console.log("💡 Recommandations:");
      reportData.recommendations.forEach(rec => {
        console.log(\`   • \${rec}\`);
      });
    }
    
  } catch (error) {
    console.error("❌ Erreur lors de la génération du rapport:", error.message);
  }
};

// Helper to get week number
Date.prototype.getWeek = function() {
  const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};

generateWeeklyReport();
`;
  
  const filePath = path.join(process.cwd(), 'scripts', 'db-weekly-report.js');
  fs.writeFileSync(filePath, weeklyReportScript);
  fs.chmodSync(filePath, '755'); // Make executable
  console.log("   ✅ Script de rapport hebdomadaire créé");
};

const updateServerWithMonitoring = async () => {
  const serverPath = path.join(process.cwd(), 'server.js');
  
  if (!fs.existsSync(serverPath)) {
    console.log("   ⚠️  server.js non trouvé, mise à jour ignorée");
    return;
  }
  
  let serverContent = fs.readFileSync(serverPath, 'utf8');
  
  // Check if monitoring is already added
  if (serverContent.includes('validateDatabaseOnStartup')) {
    console.log("   ℹ️  Monitoring déjà présent dans server.js");
    return;
  }
  
  // Add monitoring import and call
  const importLine = `import { validateDatabaseOnStartup } from "./scripts/startup-db-validation.js";`;
  const validationCall = `
    // Database validation on startup
    const dbValidation = await validateDatabaseOnStartup();
    if (!dbValidation) {
      console.log("⚠️  Database validation failed - check monitoring/startup-issues.json");
    }
`;
  
  // Insert import after existing imports
  const lines = serverContent.split('\n');
  const importIndex = lines.findIndex(line => line.includes('import') && line.includes('sequelize'));
  
  if (importIndex !== -1) {
    lines.splice(importIndex + 1, 0, importLine);
    
    // Find where to insert validation call (after DB connection)
    const dbConnectionIndex = lines.findIndex(line => line.includes('Database connection established successfully'));
    
    if (dbConnectionIndex !== -1) {
      lines.splice(dbConnectionIndex + 1, 0, validationCall);
    }
    
    serverContent = lines.join('\n');
    fs.writeFileSync(serverPath, serverContent);
    console.log("   ✅ server.js mis à jour avec le monitoring");
  } else {
    console.log("   ⚠️  Impossible de mettre à jour server.js automatiquement");
  }
};

// Setup monitoring
setupMonitoring();
