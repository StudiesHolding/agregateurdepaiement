# 🔍 ANALYSE BASE DE DONNÉES & AUTHENTIFICATION

## Conclusions Préalables à l'Implémentation

---

## 1. BASE DE DONNÉES ACTUELLE

### 1.1 Configuration

```javascript
// apps/backend/config/database.js
{
    dialect: 'mysql',
    host: process.env.DATABASE_HOST,
    port: 3306,
    pool: { max: 50, min: 5, acquire: 30000, idle: 10000 }
}
```

### 1.2 Tables Actuelles Liées aux Commandes

| Table                   | Modèle         | Description                          |
| ----------------------- | -------------- | ------------------------------------ |
| `aggp_orders`           | Order          | Commandes (LIMITE - voir ci-dessous) |
| `aggp_payment_intents`  | PaymentIntent  | Intentions de paiement               |
| `aggp_payment_attempts` | PaymentAttempt | Tentatives par provider              |
| `aggp_admin_audit_logs` | AdminAuditLog  | Logs actions admin (EXISTE)          |

### 1.3 Structure Actuelle Table `aggp_orders`

```sql
-- Structure ACTUELLE
+----------------+-------------+------+-----+---------+----------------+
| Field          | Type        | Null | Key | Default | Comment        |
+----------------+-------------+------+-----+---------+----------------+
| id             | bigint      | NO   | PRI | NULL    | auto_increment |
| reference      | varchar(100)| NO   | UNI | NULL    |                |
| customer_email | varchar(255)| NO   |     | NULL    |                |
| customer_name  | varchar(255)| YES  |     | NULL    |                |
| currency       | varchar(10) | NO   |     | NULL    |                |
| total_amount  | decimal(15,2)| NO   |     | NULL    |                |
| status         | enum(...)   | NO   |     | pending |                |
| metadata       | json        | YES  |     | NULL    |                |
| lms_item_id   | varchar(255)| YES  |     | NULL    | ID formation   |
| lms_item_type | enum        | YES  |     | NULL    | type item      |
| created_at    | datetime    | NO   |     | NULL    |                |
| updated_at    | datetime    | NO   |     | NULL    |                |
+----------------+-------------+------+-----+---------+----------------+
```

### 1.4 Décision: NOUVELLE Table vs Modification

**Décision:** Créer une **NOUVELLE TABLE** `aggp_order_audit_logs`

**Raisons:**

1. ⚠️ La table `aggp_orders` contient des données de PRODUCTION
2. ⚠️ Modifier une table prod = risque de perte de données
3. ✅Nouvelle table = zero impact sur l'existant
4. ✅ Meilleure traçabilité isolée
5. ✅ Plus flexible pour évolutions futures

---

## 2. AUTHENTIFICATION ADMIN

### 2.1 Système Actuel

```javascript
// Authentification par API Key
Header: x-api-key: <clé>

// Clés admin identifiées par préfixe:
owner: "admin:default-key"  // Admin
owner: "app:client-name"     // Client standard
```

### 2.2 Middleware Actuel

```javascript
// apps/backend/middlewares/auth.middleware.js
export const protect = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const isValid = await ApiKeyService.validate(apiKey);
  // ...
};

// apps/backend/middlewares/admin.middleware.js
export const protectAdmin = async (req, res, next) => {
  // Vérifie que la clé a le préfixe "admin:"
  if (!keyRecord.owner.startsWith("admin:")) {
    throw new ForbiddenError("Requires admin-level API Key");
  }
  req.adminIdentifier = keyRecord.owner; // ex: "admin:default-key"
};
```

### 2.3 Ce que je dois garder

| Élément                    | Action                         |
| -------------------------- | ------------------------------ |
| `x-api-key` header         | ✅ Garder                      |
| `req.adminIdentifier`      | ✅ Garder (ex: "admin:master") |
| `protectAdmin` middleware  | ✅ Garder                      |
| Master key bypass via .env | ✅ Garder                      |

---

## 3. AUTHENTIFICATION REQUISE POUR IMPLÉMENTATION

### 3.1 Données Admin Disponibles

Quand un admin fait une action, j'ai accès à:

```javascript
{
  adminIdentifier: "admin:default-key"; // OU "admin:master"
  apiKeyId: 0; // ID de la clé API
  ipAddress: "196.XXX.XXX.XXX";
  userAgent: "Mozilla/5.0...";
}
```

### 3.2 Ce que je dois enregistrer dans l'audit

```javascript
{
    actorType: 'admin',
    actorEmail: req.adminIdentifier,  // "admin:default-key"
    actorId: req.apiKeyId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
}
```

---

## 4. WEBSOCKET / TEMPS RÉEL

### 4.1 État Actuel

**Recherche dans le code:** `websocket`, `socket.io`, `sse`, `server-sent`

**Résultat:** ❌ **AUCUNE implémentation** de WebSocket ou SSE trouvée

### 4.2 Options pour Notifications Temps Réel

| Option                       | Avantages               | Inconvénients            | Recommandation  |
| ---------------------------- | ----------------------- | ------------------------ | --------------- |
| **Socket.IO**                | Temps réel,双向         | Plus complexe à intégrer | ⭐ Pour prod    |
| **SSE (Server-Sent Events)** | Simple, unidirectionnel | Uniquement server→client | ⭐ Pour MVP     |
| **Polling**                  | Très simple             | Pas vraiment temps réel  | ❌ Non souhaité |

### 4.3 Décision: SSE (Server-Sent Events)

**Raisons:**

1. ✅ Plus simple à intégrer sans refonte du server
2. ✅ Fonctionne avec HTTP standard
3. ✅ Parfait pour notifications admin→dashboard
4. ✅ Plus léger que Socket.IO
5. ✅ Compatible avec l'infrastructure existante

---

## 5. INTÉGRATION CAMPUS EXTERNE

### 5.1 Situation Actuelle

Le campus est un système **EXTERNE** - pas d'API.

**Processus:**

1. Admin valide la commande sur PSP Dashboard
2. Admin se connecte manuellement au campus
3. Admin crée le compte utilisateur
4. Admin revient sur PSP Dashboard
5. Admin saisit username/password
6. PSP envoie email avec credentials

### 5.2 Ce que je dois faire

```javascript
//rien pour l'intégration API - juste enregistrer les credentials
{
    campusUsername: "marie_dupont",
    credentialsSentAt: new Date(),
    credentialsSentTo: "marie@email.com"
}
```

---

## 6. PLAN D'EXÉCUTION SÉCURISÉ

### Phase 1: Base de données (Risque: FAIBLE)

```sql
-- Créer nouvelle table (zero impact sur l'existant)
CREATE TABLE IF NOT EXISTS aggp_order_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    order_reference VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    action_label VARCHAR(255) NOT NULL,
    actor_type ENUM('system','admin','webhook','api') DEFAULT 'system',
    actor_id BIGINT UNSIGNED,
    actor_email VARCHAR(255),
    previous_state JSON,
    new_state JSON,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    email_sent_to VARCHAR(255),
    email_sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);
```

### Phase 2: Backend API (Risque: MOYEN)

- Ajouter nouveaux statuts OrderStatus
- Créer OrderAuditLog model
- Créer OrderAuditService
- Ajouter endpoints validation/completion

### Phase 3: Notifications (Risque: FAIBLE)

- Implémenter SSE pour temps réel
- Intégrer au dashboard

### Phase 4: Dashboard (Risque: FAIBLE)

- Mise à jour page transactions
- Nouveaux composants UI
- Timeline visuelle

---

## 7. POINTS CRITIQUES DE SÉCURITÉ

| Point                    | Risque      | Mitigation                        |
| ------------------------ | ----------- | --------------------------------- |
| **Credentials en clair** | 🔴 Critique | HASH immediate, email direct      |
| **Base de données prod** | 🟡 Moyen    | ZERO modification table existante |
| **API existante**        | 🟡 Moyen    | Ajouter, ne pas supprimer         |
| **Session admin**        | 🟢 Faible   | IP logging, userAgent             |
| **Email credentials**    | 🔴 Critique | Jamais en base, juste en envoi    |

---

## 8. RÉCAPITULATIF

| Élément              | Décision                                  |
| -------------------- | ----------------------------------------- |
| Table audit          | ✅ NOUVELLE table `aggp_order_audit_logs` |
| Modifications Orders | ✅ Ajouter colonnes NULL (migration safe) |
| Auth admin           | ✅ Garder `adminIdentifier` existant      |
| Temps réel           | ✅ SSE (Server-Sent Events)               |
| Campus               | ✅rien - juste enregistrer credentials    |
| Credentials          | ⚠️ JAMAIS stockés - uniquement envoyés    |

---

_Analyse terminée - Prêt pour implémentation_  
_25 février 2026_
