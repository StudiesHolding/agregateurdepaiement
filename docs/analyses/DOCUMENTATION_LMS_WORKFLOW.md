# Documentation Technique - Module Commandes LMS

## 1. Vue d'Ensemble

Ce document décrit les modifications apportées au système d'agrégation de paiements pour implémenter un workflow complet de gestion des commandes LMS avec traçabilité et notifications.

### 1.1 Objectifs

- ✅ Workflow de commande complet (PENDING → COMPLETED)
- ✅ Système de validation administrative
- ✅ Traçabilité complète des actions (audit logs)
- ✅ Notifications par email automatisées
- ✅ Interface dashboard pour la gestion

---

## 2. Architecture de la Base de Données

### 2.1 Tables Modifiées

#### Table: `aggp_orders`

Nouvelles colonnes ajoutées:

```sql
-- Informations client étendues
customer_surname VARCHAR(255)      -- Prénom
customer_phone VARCHAR(50)         -- Téléphone
customer_city VARCHAR(100)         -- Ville

-- Type d'achat
purchase_type ENUM('self', 'gift') -- Achat personnel ou cadeau

-- Informations bénéficiaire (si cadeau)
beneficiary_first_name VARCHAR(255)
beneficiary_last_name VARCHAR(255)
beneficiary_email VARCHAR(255)
beneficiary_phone VARCHAR(50)

-- Timestamps de validation
validated_at DATETIME              -- Date de validation
validated_by VARCHAR(255)          -- Admin qui a validé

-- Timestamps de complétion
completed_at DATETIME              -- Date de finalisation
completed_by VARCHAR(255)          -- Admin qui a finalisé

-- Envoi des identifiants
credentials_sent_at DATETIME        -- Quand les identifiants ont été envoyés
credentials_email VARCHAR(255)     -- À qui les identifiants ont été envoyés
```

### 2.2 Table Nouvelle: `aggp_order_audit_logs`

```sql
CREATE TABLE aggp_order_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Référence commande
    order_id BIGINT UNSIGNED NOT NULL,
    order_reference VARCHAR(100) NOT NULL,

    -- Type d'action
    action VARCHAR(50) NOT NULL,
    action_label VARCHAR(255) NOT NULL,

    -- Acteur (qui a fait l'action)
    actor_type ENUM('system', 'admin', 'webhook', 'api') DEFAULT 'system',
    actor_id BIGINT UNSIGNED NULL,
    actor_email VARCHAR(255) NULL,

    -- Changements d'état (JSON)
    previous_state JSON NULL,
    new_state JSON NULL,

    -- Connexion
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,

    -- Tracking email
    email_sent_to VARCHAR(255) NULL,
    email_sent_at DATETIME NULL,

    -- Timestamp
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Index
    INDEX idx_order_id (order_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);
```

---

## 3. Modèles Sequelize

### 3.1 OrderAuditLog

**Fichier**: `apps/backend/models/order-audit-log.model.js`

```javascript
// Constantes d'actions d'audit
export const OrderAuditAction = {
  ORDER_CREATED: "ORDER_CREATED",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  ORDER_VALIDATED: "ORDER_VALIDATED",
  ORDER_REJECTED: "ORDER_REJECTED",
  ORDER_COMPLETED: "ORDER_COMPLETED",
  CREDENTIALS_SENT: "CREDENTIALS_SENT",
  EMAIL_SENT: "EMAIL_SENT",
};

// Types d'acteurs
export const OrderAuditActorType = {
  SYSTEM: "system",
  ADMIN: "admin",
  WEBHOOK: "webhook",
  API: "api",
};
```

---

## 4. Services

### 4.1 OrderAuditService

**Fichier**: `apps/backend/services/order-audit.service.js`

#### Méthodes disponibles:

```javascript
// Logger une action
await OrderAuditService.log({
    orderId: number,
    orderReference: string,
    action: string,
    actionLabel: string,
    actorType: 'system' | 'admin' | 'webhook' | 'api',
    actorId?: number,
    actorEmail?: string,
    previousState?: object,
    newState?: object,
    ipAddress?: string,
    userAgent?: string,
    emailSentTo?: string,
    emailSentAt?: Date,
});

// Logger une action admin
await OrderAuditService.logAdminAction({
    orderId: number,
    orderReference: string,
    action: 'ORDER_VALIDATED' | 'ORDER_REJECTED' | 'ORDER_COMPLETED',
    adminEmail: string,
    adminId?: number,
    notes?: string,
    ipAddress?: string,
});

// Logger une action système
await OrderAuditService.logSystemAction({
    orderId: number,
    orderReference: string,
    action: string,
    previousState?: object,
    newState?: object,
});

// Récupérer l'historique
const history = await OrderAuditService.getOrderHistory(orderId);
```

---

## 5. API Endpoints

### 5.1 Liste des Commandes

```
GET /api/admin/orders

Paramètres Query:
- status: string (PENDING, PROCESSING, PAYMENT_CONFIRMED, etc.)
- purchaseType: string (self, gift)
- search: string (recherche par référence, email, nom)
- dateFrom: date
- dateTo: date
- page: number (défaut: 1)
- limit: number (défaut: 50)

Réponse:
{
  "success": true,
  "data": [Order],
  "meta": { total, page, perPage, totalPages }
}
```

### 5.2 Détail d'une Commande

```
GET /api/admin/orders/:id

Réponse:
{
  "success": true,
  "data": {
    "order": Order,
    "auditHistory": [OrderAuditLog]
  }
}
```

### 5.3 Valider/Rejeter une Commande

```
POST /api/admin/orders/:id/validate

Body:
{
  "action": "validate" | "reject",
  "notes": "Motif optionnel"
}

Réponse:
{
  "success": true,
  "data": Order
}
```

### 5.4 Finaliser une Commande

```
POST /api/admin/orders/:id/complete

Body:
{
  "username": "identifiant_campus",
  "password": "mot_de_passe"
}

Réponse:
{
  "success": true,
  "data": Order
}
```

### 5.5 Historique d'Audit

```
GET /api/admin/orders/:id/audit

Réponse:
{
  "success": true,
  "data": [OrderAuditLog]
}
```

---

## 6. Notifications Email

### 6.1 Méthodes du MailService

**Fichier**: `apps/backend/services/mail.service.js`

```javascript
// Paiement confirmé
await MailService.sendPaymentConfirmed(order, customerEmail);

// Commande validée par admin
await MailService.sendOrderValidated(order, customerEmail, adminEmail);

// Commande rejetée
await MailService.sendOrderRejected(order, customerEmail, reason);

// Commande terminée - envoi des identifiants
await MailService.sendOrderCompleted(order, customerEmail, username, password);
```

### 6.2 Configuration SMTP

```env
MAIL_HOST=smtp.ionos.fr
MAIL_PORT=465
MAIL_USER=no-reply@studieslearning.com
MAIL_PASS=@@Studies2025Holding
MAIL_FROM_NAME=Studies Learning
MAIL_FROM_EMAIL=no-reply@studieslearning.com
```

---

## 7. Dashboard UI

### 7.1 Pages Créées

#### Liste des Commandes

- **URL**: `/orders`
- **Fichier**: `apps/dashboard/src/app/(dashboard)/orders/page.tsx`
- **Fonctionnalités**:
  - Tableau avec filtres
  - Pagination
  - Badges de statut
  - Type d'achat (personnel/cadeau)

#### Détail d'une Commande

- **URL**: `/orders/:id`
- **Fichier**: `apps/dashboard/src/app/(dashboard)/orders/[id]/page.tsx`
- **Fonctionnalités**:
  - Informations client complètes
  - Timeline d'audit
  - Boutons d'action (Valider/Rejeter/Compléter)

---

## 8. Flux de Travail

### 8.1 Cycle de Vie d'une Commande

```
1. CRÉATION
   └─> Client achète une formation
   └─> Order status: PENDING
   └─> Audit: ORDER_CREATED

2. PAIEMENT
   └─> Paiement réussi via provider
   └─> Webhook reçoit confirmation
   └─> Order status: PAYMENT_CONFIRMED
   └─> Audit: PAYMENT_RECEIVED
   └─> Email: Paiement confirmé envoyé

3. VALIDATION (Admin)
   └─> Admin vérifie le paiement
   └─> Admin clique "Valider" dans dashboard
   └─> Order status: VALIDATED
   └─> validated_at, validated_by remplis
   └─> Audit: ORDER_VALIDATED
   └─> Email: Commande validée envoyée

4. COMPLÉTION (Admin)
   └─> Admin génère identifiants campus
   └─> Admin clique "Finaliser" dans dashboard
   └─> Order status: COMPLETED
   └─> completed_at, completed_by remplis
   └─> credentials_sent_at, credentials_email remplis
   └─> Audit: ORDER_COMPLETED + CREDENTIALS_SENT
   └─> Email: Identifiants envoyés
```

### 8.2 Cas de Rejet

```
3. REJET (Admin)
   └─> Admin clique "Rejeter"
   └─> Admin ajoute un motif
   └─> Order status: REJECTED
   └─> Audit: ORDER_REJECTED
   └─> Email: Commande rejetée envoyée
```

---

## 9. Tests

### 9.1 Tests API

```bash
# Liste des commandes
curl -X GET http://localhost:3000/api/admin/orders \
  -H "x-api-key: admin:studies:secret"

# Détail commande
curl -X GET http://localhost:3000/api/admin/orders/199 \
  -H "x-api-key: admin:studies:secret"

# Valider commande
curl -X POST http://localhost:3000/api/admin/orders/199/validate \
  -H "x-api-key: admin:studies:secret" \
  -H "Content-Type: application/json" \
  -d '{"action": "validate", "notes": "Paiement vérifié"}'

# Compléter commande
curl -X POST http://localhost:3000/api/admin/orders/199/complete \
  -H "x-api-key: admin:studies:secret" \
  -H "Content-Type: application/json" \
  -d '{"username": "etudiant123", "password": "motdepasse"}'
```

---

## 10. Dépannage

### 10.1 Erreurs Courantes

| Erreur           | Cause                | Solution                          |
| ---------------- | -------------------- | --------------------------------- |
| 401 Unauthorized | Clé API invalide     | Vérifier `x-api-key` header       |
| 403 Forbidden    | Clé non admin        | Utiliser clé avec prefix `admin:` |
| 400 Bad Request  | Données invalides    | Vérifier le body JSON             |
| 404 Not Found    | Commande inexistante | Vérifier l'ID                     |

### 10.2 Logs

Les logs sont disponibles dans la console du serveur:

```
[2026-02-25T17:01:24.965Z] GET /api/admin/orders/199
```

---

## 11. Sécurité

### 11.1 Authentification

- Toutes les routes `/api/admin/*` nécessitent une clé API
- Format: `admin:KEY` ou `KEY` (legacy)
- Clé master: `admin:studies:secret`

### 11.2 Audit

Chaque action est tracée avec:

- IP source
- User Agent
- Timestamp précis
- Identifiant acteur

---

## 12. Maintenance

### 12.1 Commandes Utiles

```bash
# Redémarrer backend
cd apps/backend && npm run dev

# Redémarrer dashboard
cd apps/dashboard && npm run dev

# Vérifier les logs
tail -f apps/backend/logs/console.log
```

---

_Document généré le 25 février 2026_
_Version: 1.0_
