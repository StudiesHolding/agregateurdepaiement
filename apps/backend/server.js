import app from "./app.js";
import { sequelize } from "./models/index.js";
import { validateCommissionCreditConfig } from "./services/sl-backend-commission.client.js";
import { assertJwtSecretConfigured } from "./utils/jwt-secret.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Sessions : jamais de secret de repli (ADR-0018, D5) — arrêt en production si JWT_SECRET est faible.
        try { assertJwtSecretConfigured(); } catch (e) { console.error(` [FATAL] ${e.message}`); process.exit(1); }
        // Validation de configuration — crédit de commission (S1-5) :
        // hors test, refuser le démarrage si SL_BACKEND_URL / INTERNAL_API_KEY
        // sont absentes alors que la fonctionnalité est activée (défaut : activée).
        const commissionConfig = validateCommissionCreditConfig();
        if (!commissionConfig.valid) {
            console.error(
                ` [FATAL] Crédit de commission activé (COMMISSION_CREDIT_ENABLED) mais variables manquantes :` +
                ` ${commissionConfig.missing.join(', ')}.` +
                ` Renseignez-les dans .env ou désactivez avec COMMISSION_CREDIT_ENABLED=false.`
            );
            process.exit(1);
        }
        if (commissionConfig.enabled) {
            console.log(" Crédit de commission activé (SL_BACKEND_URL + INTERNAL_API_KEY configurés)");
        } else {
            console.log(" Crédit de commission désactivé (COMMISSION_CREDIT_ENABLED=false)");
        }

        console.log(" Connecting to database...");
        await sequelize.authenticate();
        console.log(" Database connection established successfully.");

        // Sync models automatically with database (safe mode - only create missing tables)
        // In production, prefer running migration scripts separately
        try {
            if (process.env.NODE_ENV !== 'production') {
                await sequelize.sync({ force: false });
                console.log(" Database models synchronized.");
            } else {
                console.log(" Production mode: skipping auto-sync. Run migration scripts manually.");
                console.log("   npm run migrate:prod");
            }
        } catch (syncError) {
            console.warn(" Database sync warning:", syncError.message);
            console.log(" Continuing without model synchronization...");
        }

        // Plus de clé administrateur générée ni écrite dans les journaux au démarrage (ADR-0019) : l'équipe se connecte
        // par Studies Learning ; une clé d'intégration se crée volontairement avec scripts/create-machine-key.js.

        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(` Server running on http://0.0.0.0:${PORT}`);
            console.log(` Health check: http://localhost:${PORT}/health`);
        });

        // Notifications de l'espace finance : règles par défaut, surveillances périodiques (ADR-0019, D7).
        const { startNotificationWatchers } = await import('./services/notifications/notification-engine.js');
        startNotificationWatchers();

        // Workers Saga BullMQ (provisioning post-paiement + assignations B2B)
        try {
            await import('./saga/payment-saga.worker.js');
            await import('./saga/license-assign.worker.js');
            console.log(' Saga workers started (saga-payment, saga-license-assign)');
        } catch (workerError) {
            console.warn(' Saga workers not started:', workerError.message);
        }

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(` Port ${PORT} is already in use.`);
            } else {
                console.error(" Server error:", err);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error(" Unable to connect to the database:", error);
        process.exit(1);
    }
};

startServer();
