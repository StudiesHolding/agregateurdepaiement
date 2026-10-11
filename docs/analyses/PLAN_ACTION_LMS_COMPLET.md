# 📋 PLAN D'ACTION - SYSTÈME D'INSCRIPTION LMS

## Phase 1: Analyse & Spécifications | Phase 2: Implémentation

---

# PARTIE 1: ANALYSE DU SYSTÈME ACTUEL

## 1.1 Architecture Actuelle - Synthèse

### Stack Technique

| Composant        | Technologie             | Status          |
| ---------------- | ----------------------- | --------------- |
| Backend          | Node.js + Express       | ✅ Stable       |
| Base de données  | MySQL + Sequelize       | ✅ Opérationnel |
| Dashboard        | Next.js 14 + TypeScript | ✅ Opérationnel |
| Authentification | API Keys + JWT          | ✅ Fonctionnel  |
| Notifications    | Nodemailer (SMTP)       | ✅ En place     |

### Modèle de Données Actuel - Order

```javascript
// apps/backend/models/order.model.js - ACTUEL
{
    id: BIGINT PRIMARY KEY,
    reference: STRING (unique),
    customerEmail: STRING,
    customerName: STRING,
    currency: STRING,
    totalAmount: DECIMAL,
    status: ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
    metadata: JSON,
    lmsItemId: STRING,
    lmsItemType: ENUM('course', 'package', 'subscription'),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
}
```

### États de Commande Actuels

```javascript
// apps/backend/enums/index.js - ACTUEL
const OrderStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
};
```

### Flux Actuel (Simplifié)

```
Commande créée → Paiement → Webhook → Email facture → Terminé
```

---

## 1.2 Forces du Système Actuel

| Aspect                                      | Évaluation                   |
| ------------------------------------------- | ---------------------------- |
| Multi-providers (Stripe, CinetPay, KKiaPay) | ✅ Excellent                 |
| Routing intelligent                         | ✅ Opérationnel              |
| Webhooks sécurisés                          | ✅ Avec validation signature |
| Audit logs admin                            | ✅ En place                  |
| Dashboard analytique                        | ✅ Complet                   |

---

## 1.3 Limites Identifiées

| #   | Limite                            | Impact                                                 |
| --- | --------------------------------- | ------------------------------------------------------ |
| 1   | **Pas de distinction self/gift**  | Impossible de savoir si achat pour soi ou autre        |
| 2   | **Facture envoyée trop tôt**      | Envoyée juste après paiement, avant validation         |
| 3   | **Pas de workflow de validation** | Aucune étape "admin vérifie puis valide"               |
| 4   | **Pas de création compte campus** | Pas de gestion des accès utilisateurs                  |
| 5   | **Traçabilité incomplète**        | Logs admin OK, mais pas de traçabilité du cycle de vie |
| 6   | **Order status trop simpliste**   | 5 états seulement, pas assez granulaires               |

---

# PARTIE 2: SPÉCIFICATIONS NOUVEAU WORKFLOW

## 2.1 Workflow Détaillé - Version Finale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: ACHAT (Formulaire)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Client remplit formulaire                                                │
│       ↓                                                                    │
│   ❓ "Cette formation est-elle pour vous?"                                 │
│       ↓                                                                    │
│   ├─→ OUI → [ customerEmail, customerName, customerSurname ]              │
│   │                                                                     │
│   └─→ NON → [ beneficiaryFirstName, beneficiaryLastName,                   │
│               beneficiaryEmail, beneficiaryPhone, relationship ]           │
│       ↓                                                                    │
│   Paiement via agrégateur                                                  │
│       ↓                                                                    │
│   Webhook: Paiement Succès / Échec                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: CONFIRMATION PAIEMENT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ✅ Paiement Confirmé                                                     │
│       ↓                                                                    │
│   1. Email client: "Paiement reçu - En attente validation"               │
│      (⚠️ PAS de facture!)                                                 │
│                                                                             │
│   2. Notification Dashboard Admin (HAUTE PRIORITÉ)                         │
│      → "Nouveau paiement à valider"                                        │
│                                                                             │
│   3. Order status: PAYMENT_CONFIRMED                                       │
│                                                                             │
│   4. Audit log: PAYMENT_CONFIRMED                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 3: VALIDATION ADMIN                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Admin voit commande dans dashboard                                       │
│       ↓                                                                    │
│   └─→ Vérifie le paiement sur interface agrégateur                         │
│       ↓                                                                    │
│   ┌─────────────────────┐    ┌─────────────────────┐                       │
│   │   VALIDER COMMANDE  │    │     REJETER         │                       │
│   │  (Bouton principal) │    │  (Si problème)     │                       │
│   └──────────┬──────────┘    └──────────┬──────────┘                       │
│              ↓                         ↓                                   │
│   1. Envoi EMAIL + FACTURE        1. Email: "Paiement                      │
│      automatique au client            rejeté"                               │
│   2. Order: VALIDATED            2. Order: REJECTED                        │
│   3. Prochaine phase:           3. Terminé                                 │
│      Création compte                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 4: CRÉATION COMPTE CAMPUS                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Status: VALIDATED                                                         │
│       ↓                                                                    │
│   Admin se connecte au Campus (système externe)                            │
│   et crée le compte utilisateur manuellement                               │
│       ↓                                                                    │
│   Admin revient sur Dashboard PSP                                          │
│       ↓                                                                    │
│   Clique "Finaliser la commande"                                           │
│       ↓                                                                    │
│   Saisie: Username + Password                                               │
│       ↓                                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  EMAIL AUTOMATIQUE ENVOYÉ                                           │  │
│   │  - Bienvenue + Felicitations                                        │  │
│   │  - Username + Password (en clair car campus externe)                │  │
│   │  - Lien connexion campus                                            │  │
│   │  - Facture en pièce jointe                                          │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│       ↓                                                                    │
│   Order status: COMPLETED                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2.2 Modèle de Données - Nouveau

```javascript
// ============================================================================
// NOUVEAU MODÈLE: Order (étendu)
// ============================================================================

Order.init({
    // === Identifiants ===
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    reference: { type: DataTypes.STRING(100), allowNull: false, unique: true },

    // === Client ===
    customerEmail: { type: DataTypes.STRING(255), allowNull: false },
    customerName: { type: DataTypes.STRING(255), allowNull: true },
    customerSurname: { type: DataTypes.STRING(255), allowNull: true },
    customerPhone: { type: DataTypes.STRING(50), allowNull: true },
    customerAddress: { type: DataTypes.STRING(500), allowNull: true },
    customerCity: { type: DataTypes.STRING(100), allowNull: true },

    // === TYPE D'ACHAT (NOUVEAU) ===
    purchaseType: {
        type: DataTypes.ENUM(['self', 'gift']),
        defaultValue: 'self',
        comment: 'Achat pour soi ou pour quelqu\'un d\'autre'
    },

    // === BÉNÉFICIAIRE (NOUVEAU - si purchaseType = 'gift') ===
    beneficiaryFirstName: { type: DataTypes.STRING(255), allowNull: true },
    beneficiaryLastName: { type: DataTypes.STRING(255), allowNull: true },
    beneficiaryEmail: { type: DataTypes.STRING(255), allowNull: true },
    beneficiaryPhone: { type: DataTypes.STRING(50), allowNull: true },
    beneficiaryRelationship: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Famille, Ami, Collègue, Autre'
    },

    // === Formation ===
    formationId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    formationName: { type: DataTypes.STRING(500), allowNull: false },
    formationPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false },

    // === NOUVEAUX STATUTS ===
    status: {
        type: DataTypes.ENUM([
            'pending',              // En attente paiement
            'processing',           // Paiement en cours
            'payment_failed',       // Paiement échoué
            'payment_confirmed',   // ✅ Paiement reçu, en attente validation
            'validated',           | ✅ Validé par admin, en attente finalisation
            'completed',            | ✅ Terminé - accès envoyés
            'rejected',            | Rejeté par admin
            'cancelled',           | Annulé
            'expired'              // Timeout
        ]),
        defaultValue: 'pending'
    },

    // === TIMESTAMPS PHASES ===
    paidAt: { type: DataTypes.DATE, allowNull: true },
    validatedAt: { type: DataTypes.DATE, allowNull: true },
    validatedBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },  // Admin ID
    completedAt: { type: DataTypes.DATE, allowNull: true },
    completedBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },

    // === CREDENTIALS ===
    campusUsername: { type: DataTypes.STRING(100), allowNull: true },
    credentialsSentAt: { type: DataTypes.DATE, allowNull: true },
    credentialsSentTo: { type: DataTypes.STRING(255), allowNull: true },

    // === NOTES ===
    adminNotes: { type: DataTypes.TEXT, allowNull: true },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },

    // === LIENS ===
    paymentIntentId: { type: DataTypes.STRING(255), allowNull: true },
    paymentProvider: { type: DataTypes.STRING(50), allowNull: true },
    transactionReference: { type: DataTypes.STRING(255), allowNull: true },

    // === MÉTADONNÉES ===
    metadata: { type: DataTypes.JSON, allowNull: true }
}, {
    sequelize,
    modelName: "Order",
    tableName: "aggp_orders"
});
```

---

## 2.3 Spécification API - Endpoints Requis

### A. Création Commande

```javascript
// POST /api/payments/initialize
// NOUVELLE VERSION

{
    // === Client ===
    customerEmail: "jean@email.com",
    customerName: "Jean",
    customerSurname: "Dupont",
    customerPhone: "+237612345678",

    // === TYPE D'ACHAT (NOUVEAU) ===
    purchaseType: "self" | "gift",

    // === BÉNÉFICIAIRE (si gift) ===
    beneficiaryFirstName: "Marie",
    beneficiaryLastName: "Dupont",
    beneficiaryEmail: "marie@email.com",
    beneficiaryPhone: "+237698765432",
    beneficiaryRelationship: "famille",

    // === Formation ===
    formationId: 123,
    formationName: "Formation Python Avancé",
    formationPrice: 50000,
    currency: "XAF",

    // === Paiement ===
    paymentMethod: "mobile_money",
    countryCode: "CM"
}
```

### B. Validation Commande (Admin)

```javascript
// POST /api/admin/orders/:id/validate

{
    action: "validate" | "reject",
    notes: "Paiement vérifié OK" // optionnel
}

// Si action = "reject", envoyer:
// - Email client: paiement rejeté
// - Order status: "rejected"
```

### C. Finalisation Commande (Admin)

```javascript
// POST /api/admin/orders/:id/complete

{
    username: "marie_dupont",
    password: "MonSuperPassword123"
}

// Actions automatiques:
// 1. Email avec username + password + facture
// 2. Order status: "completed"
// 3. Audit log complet
```

### D. Liste Commandes (Admin)

```javascript
// GET /api/admin/orders

// Filtres:
{
    status: "payment_confirmed", // nouvelle commande à valider
    purchaseType: "gift",       // seulement les achats cadeau
    formationId: 123,
    dateFrom: "2026-01-01",
    dateTo: "2026-12-31",
    search: "jean@email.com"
}
```

---

# PARTIE 3: PLAN D'ACTION

## 3.1 Objectifs Stratégiques

| Objectif   | Description                                                       | Priorité |
| ---------- | ----------------------------------------------------------------- | -------- |
| **OBJ-01** | Implémenter le nouveau workflow d'achat avec question "pour qui"  | 🔴 P1    |
| **OBJ-02** | Modifier le flux des emails (facture uniquement après validation) | 🔴 P1    |
| **OBJ-03** | Créer le système de validation admin                              | 🔴 P1    |
| **OBJ-04** | Implémenter la création et envoi des credentials                  | 🔴 P1    |
| **OBJ-05** | Développer une traçabilité complète et moderne                    | 🟡 P2    |
| **OBJ-06** | Mettre à jour le dashboard commandes                              | 🟡 P2    |
| **OBJ-07** | Implémenter les tests de non-régression                           | 🟢 P3    |

---

## 3.2 Plan d'Implémentation - Phase par Phase

### ═══════════════════════════════════════════════════════════

# PHASE 1: MODIFICATIONS BACKEND (Semaine 1-2)

### ═══════════════════════════════════════════════════════════

#### TÂCHE 1.1: Mise à jour du Modèle de Données

| Action | Détail                                                  | Fichier          |
| ------ | ------------------------------------------------------- | ---------------- |
| 1.1.1  | Ajouter champs purchaseType, beneficiary\*              | `order.model.js` |
| 1.1.2  | Ajouter nouveaux statuts                                | `enums/index.js` |
| 1.1.3  | Ajouter champs validatedAt, completedAt, campusUsername | `order.model.js` |
| 1.1.4  | Créer migration Sequelize                               | `migrations/`    |

#### TÂCHE 1.2: Mise à jour du Contrôleur de Paiement

| Action | Détail                                         | Fichier                 |
| ------ | ---------------------------------------------- | ----------------------- |
| 1.2.1  | Mettre à jour validation schema (Zod)          | `validators.js`         |
| 1.2.2  | Stocker purchaseType et beneficiary dans Order | `payment.controller.js` |

#### TÂCHE 1.3: Mise à jour Webhook Processor

| Action | Détail                                | Fichier                             |
| ------ | ------------------------------------- | ----------------------------------- |
| 1.3.1  | Modifier pour NE PLUS envoyer facture | `webhook-processor.service.js`      |
| 1.3.2  | Changer status → 'payment_confirmed'  | `webhook-processor.service.js`      |
| 1.3.3  | Créer notification dashboard admin    | `notification.service.js` (nouveau) |

#### TÂCHE 1.4: Nouveaux Endpoints API

| Action | Détail                                    | Fichier           |
| ------ | ----------------------------------------- | ----------------- |
| 1.4.1  | POST /admin/orders/:id/validate           | `admin.routes.js` |
| 1.4.2  | POST /admin/orders/:id/complete           | `admin.routes.js` |
| 1.4.3  | GET /admin/orders (avec nouveaux filtres) | `admin.routes.js` |
| 1.4.4  | GET /admin/orders/:id                     | `admin.routes.js` |

#### TÂCHE 1.5: Service d'Audit Ultra-Complet

| Action | Détail                                          | Fichier                           |
| ------ | ----------------------------------------------- | --------------------------------- |
| 1.5.1  | Créer OrderAuditLog model                       | `models/order-audit-log.model.js` |
| 1.5.2  | Logger TOUTES les actions                       | Middleware audit                  |
| 1.5.3  | Inclure: IP, UserAgent, Timestamp, Before/After | Service audit                     |

---

### ═══════════════════════════════════════════════════════════

# PHASE 2: NOTIFICATIONS & EMAILS (Semaine 2)

### ═══════════════════════════════════════════════════════════

#### TÂCHE 2.1: Templates Emails

| Action | Détail                                     | Fichier           |
| ------ | ------------------------------------------ | ----------------- |
| 2.1.1  | Email confirmation paiement (SANS facture) | `mail.service.js` |
| 2.1.2  | Email validation + FACTURE (automatique)   | `mail.service.js` |
| 2.1.3  | Email rejection                            | `mail.service.js` |
| 2.1.4  | Email welcome + credentials + FACTURE      | `mail.service.js` |

#### TÂCHE 2.2: Notifications Dashboard

| Action | Détail                                          | Fichier                   |
| ------ | ----------------------------------------------- | ------------------------- |
| 2.2.1  | Notifications temps réel (WebSocket ou Polling) | `notification.service.js` |
| 2.2.2  | Badge "Nouvelles commandes"                     | Dashboard                 |

---

### ═══════════════════════════════════════════════════════════

# PHASE 3: DASHBOARD (Semaine 3)

### ═══════════════════════════════════════════════════════════

#### TÂCHE 3.1: Page Commandes (Nouvelle Version)

| Action | Détail                                         | Fichier                 |
| ------ | ---------------------------------------------- | ----------------------- |
| 3.1.1  | Liste commandes avec filtres avancés           | `transactions/page.tsx` |
| 3.1.2  | Indicateur visuel purchaseType (self/gift)     | UI component            |
| 3.1.3  | Boutons d'action (Valider, Rejeter, Finaliser) | UI component            |

#### TÂCHE 3.2: Modal de Validation

| Action | Détail                              | Fichier                      |
| ------ | ----------------------------------- | ---------------------------- |
| 3.2.1  | Affichage détails commande complète | `transactions/[id]/page.tsx` |
| 3.2.2  | Bouton "Valider & Envoyer Facture"  | Action button                |
| 3.2.3  | Bouton "Rejeter" avec motif         | Action button                |

#### TÂCHE 3.3: Modal de Finalisation

| Action | Détail                          | Fichier                      |
| ------ | ------------------------------- | ---------------------------- |
| 3.3.1  | Formulaire: Username + Password | `transactions/[id]/page.tsx` |
| 3.3.2  | Preview email avant envoi       | Email preview component      |
| 3.3.3  | Bouton "Envoyer & Finaliser"    | Action button                |

#### TÂCHE 3.4: Page Historique/Audit

| Action | Détail                         | Fichier                      |
| ------ | ------------------------------ | ---------------------------- |
| 3.4.1  | Timeline visuelle par commande | `transactions/[id]/page.tsx` |
| 3.4.2  | Filtres par type d'action      | `audit/page.tsx`             |
| 3.4.3  | Export PDF/Excel               | Feature                      |

---

### ═══════════════════════════════════════════════════════════

# PHASE 4: TESTS & DÉPLOIEMENT (Semaine 4)

### ═══════════════════════════════════════════════════════════

#### TÂCHE 4.1: Tests

| Action | Détail                             | Couverture |
| ------ | ---------------------------------- | ---------- |
| 4.1.1  | Tests unitaires nouveaux endpoints | 80%+       |
| 4.1.2  | Tests d'intégration workflow       | Complet    |
| 4.1.3  | Tests UI dashboard                 | E2E        |

#### TÂCHE 4.2: Documentation

| Action | Détail                      |
| ------ | --------------------------- |
| 4.2.1  | Mise à jour API docs        |
| 4.2.2  | Guide utilisateur dashboard |
| 4.2.3  | Guide administrateur        |

---

# PARTIE 4: TRAÇABILITÉ COMPLÈTE

## 4.1 Modèle de Journalisation (OrderAuditLog)

```javascript
// NOUVEAU: Traçabilité granulaire par commande
OrderAuditLog.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    // Commande associée
    orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

    // Action effectuée
    action: {
      type: DataTypes.ENUM([
        "ORDER_CREATED",
        "PAYMENT_RECEIVED",
        "PAYMENT_FAILED",
        "PAYMENT_CONFIRMED_VIEWED", // Admin a consulté
        "ORDER_VALIDATED",
        "ORDER_REJECTED",
        "ORDER_COMPLETED",
        "CREDENTIALS_SENT",
        "FACTURE_SENT",
        "ORDER_EXPIRED",
      ]),
      allowNull: false,
    },

    // Qui a fait l'action
    actorType: {
      type: DataTypes.ENUM(["system", "admin", "api"]),
      defaultValue: "system",
    },
    actorId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    actorEmail: { type: DataTypes.STRING(255), allowNull: true },

    // Données avant/après (pour rollback)
    previousState: { type: DataTypes.JSON, allowNull: true },
    newState: { type: DataTypes.JSON, allowNull: true },

    // Contexte
    ipAddress: { type: DataTypes.STRING(45), allowNull: true },
    userAgent: { type: DataTypes.STRING(500), allowNull: true },

    // Métadonnées additionnelles
    metadata: { type: DataTypes.JSON, allowNull: true },

    // Timestamp
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: "OrderAuditLog",
    tableName: "aggp_order_audit_logs",
    indexes: [
      { fields: ["orderId"] },
      { fields: ["action"] },
      { fields: ["createdAt"] },
      { fields: ["actorId"] },
    ],
  },
);
```

## 4.2 Timeline Visualisée (Dashboard)

```
COMMANDE #ORD-2026-0125
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ 2026-02-25 14:30:00
   👤 Jean Dupont
   📝 Commande créée (Achat pour: Marie Dupont - Famille)
   💰 50,000 XAF - Formation Python Avancé

⏰ 2026-02-25 14:32:15
   💳 Paiement reçu (CinetPay - Mobile Money)
   ✅ Statut: PAYMENT_CONFIRMED

⏰ 2026-02-25 14:32:16
   📧 Email envoyé: "Paiement reçu - En attente validation"

⏰ 2026-02-25 15:45:00
   👁️ Admin (admin@studieslearning.com) a consulté la commande

⏰ 2026-02-25 16:20:00
   ✅ Commande validée par Admin
   📧 Email + Facture envoyés automatiquement
   📝 Statut: VALIDATED

⏰ 2026-02-25 16:45:00
   👤 Admin crée compte sur Campus (marie_dupont)

⏰ 2026-02-25 16:50:00
   ✅ Commande finalisée
   📧 Email: Bienvenue + Credentials + Facture → marie@email.com
   📝 Statut: COMPLETED
```

---

# PARTIE 5: MATRICE RESPONSABILITÉS

| Phase | Tâche              | Développeur | Lead Tech | Product Owner |
| ----- | ------------------ | ----------- | --------- | ------------- |
| 1     | Modèle + Migration | ⬜          | ✅        | ⬜            |
| 1     | API Endpoints      | ⬜          | ✅        | ✅            |
| 1     | Audit Log          | ⬜          | ✅        | ⬜            |
| 2     | Emails             | ⬜          | ✅        | ✅            |
| 3     | Dashboard          | ⬜          | ⬜        | ✅            |
| 4     | Tests              | ⬜          | ✅        | ⬜            |

---

# PARTIE 6: RISQUES & MITIGATIONS

| Risque                | Impact      | Probabilité | Mitigation                             |
| --------------------- | ----------- | ----------- | -------------------------------------- |
| Regression paiement   | 🔴 Critique | Moyenne     | Tests intensifs, environnement staging |
| Perte credentials     | 🔴 Critique | Faible      | 双重 vérification avant envoi          |
| Email non délivré     | 🟡 Moyen    | Moyenne     | Setup bounce handling, DKIM            |
| Admin timeout         | 🟡 Moyen    | Faible      | Auto-save form draft                   |
| Doublon compte campus | 🟡 Moyen    | Faible      | Vérification avant création            |

---

# ANNEXE: CHECKLIST DE LIVRAISON

- [ ] Nouveau modèle Order avec tous champs
- [ ] Migration base de données
- [ ] Nouveaux endpoints API validés
- [ ] Emails templates créés et testés
- [ ] Dashboard commandes avec filtres
- [ ] Modal validation avec envoi automatique facture
- [ ] Modal finalisation avec credentials
- [ ] Timeline visualisée
- [ ] Audit logs complets
- [ ] Tests unitaires > 80%
- [ ] Documentation API mise à jour

---

_Document généré le 25 février 2026_  
_Par: Architecte Solution Senior_  
_Projet: AgregateurDePaiement / Studies Learning LMS_
