# 🚀 Deployment Checklist - Backend

## 📋 Pré-Déploiement

### 1. Variables d'Environnement
```bash
# Database
DB_HOST=your-production-db-host
DB_PORT=3306
DB_NAME=studies_psp_prod
DB_USER=studies_user
DB_PASSWORD=secure_password

# App
NODE_ENV=production
PORT=3000
ADMIN_API_KEY=your-secure-admin-key

# Emails
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=noreply@studieslearning.com
SMTP_PASS=your-email-password

# URLs
NEXT_PUBLIC_API_BASE_URL=https://api.studieslearning.com
B2B_DASHBOARD_URL=https://sl-business.studieslearning.com
CORS_ALLOWED_ORIGINS=https://dashboard.studieslearning.com,https://sl-business.studieslearning.com

# Payment Providers
CINETPAY_API_KEY=prod_key
CINETPAY_SITE_ID=prod_site_id
CINETPAY_WEBHOOK_NOTIFY_URL=https://api.studieslearning.com/api/webhooks/cinetpay
```

### 2. Permissions Base de Données
```sql
-- Assurez-vous que l'utilisateur DB a les permissions nécessaires:
GRANT CREATE, ALTER, INDEX, SELECT, INSERT, UPDATE, DELETE ON studies_psp_prod.* TO 'studies_user'@'%';
GRANT ALL PRIVILEGES ON studies_psp_prod.* TO 'studies_user'@'%';
FLUSH PRIVILEGES;
```

## 🔄 Processus de Déploiement

### Étape 1: Déployer le Code
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm ci --production

# 3. Run database migration
npm run migrate:prod

# 4. Seed production data
npm run seed:prod

# 5. Start application
npm start
```

### Étape 2: Vérification Post-Déploiement
```bash
# Health check
curl https://api.studieslearning.com/health

# Test admin API
curl -H "x-api-key: YOUR_ADMIN_KEY" https://api.studieslearning.com/api/admin/kpis/overview

# Test webhooks endpoint
curl -X POST https://api.studieslearning.com/api/webhooks/cinetpay
```

## 🔧 Scripts Disponibles

### Migration Production
```bash
npm run migrate:prod
```
- Crée les tables manquantes
- Met à jour les schémas existants (sans alter: true)
- Affiche les tables créées/mises à jour

### Seeding Production
```bash
npm run seed:prod
```
- Crée la clé API admin si absente
- Affiche la clé générée (à conserver précieusement)

### Setup Complet
```bash
npm run deploy:setup
```
- Exécute migration + seeding en une commande

## ⚠️ Notes Importantes

### 1. Mode Production
- Le `sequelize.sync()` automatique est désactivé en production
- Utilisez toujours les scripts de migration manuels
- Cela évite les modifications accidentelles de schéma

### 2. Sécurité
- La clé API admin générée doit être stockée sécurément
- Changez-la après le premier login
- Utilisez des variables d'environnement fortes

### 3. Monitoring
- Surveillez les logs de migration
- Vérifiez que toutes les tables sont créées
- Testez les endpoints critiques

## 🚨 Dépannage

### Si la migration échoue:
1. Vérifiez la connexion DB
2. Vérifiez les permissions utilisateur
3. Vérifiez les variables d'environnement
4. Consultez les logs d'erreur

### Si le seeding échoue:
1. Vérifiez que la migration a réussi
2. Vérifiez les permissions sur la table `api_keys`
3. Consultez les logs d'erreur

### Si l'application ne démarre pas:
1. Vérifiez le health endpoint
2. Consultez les logs de l'application
3. Vérifiez les variables d'environnement
4. Vérifiez la connexion DB
