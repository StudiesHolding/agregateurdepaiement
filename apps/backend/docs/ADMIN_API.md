# 🔐 Admin API — Documentation Complète

> **Phase 0** du Payment Operations Dashboard.  
> Tous les endpoints sont protégés par une clé API de niveau admin.

---

## 1. Authentification

Toute requête vers `/api/admin/*` doit inclure un header `x-api-key` contenant une clé dont le propriétaire est préfixé **`admin:`**.

```http
x-api-key: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Générer une clé admin

```bash
cd apps/backend
node -e "
import('./services/api-key.service.js').then(async ({ ApiKeyService }) => {
  const r = await ApiKeyService.generate('admin:dashboard');
  console.log('Key:', r.key);
});
"
```

> **Convention RBAC :**  
>
> - `admin:<name>` → accès complet aux endpoints admin  
> - `app:<name>` ou sans préfixe → accès API paiement uniquement (403 sur routes admin)

---

## 2. Format des Réponses

**Succès**

```json
{ "status": "success", "data": { ... } }
```

**Erreur**

```json
{ "status": "fail", "message": "Description de l'erreur" }
```

**Pagination**

```json
{
  "status": "success",
  "data": [...],
  "meta": {
    "total": 1250,
    "page": 1,
    "perPage": 25,
    "totalPages": 50
  }
}
```

---

## 3. KPIs & Analytics

### `GET /api/admin/kpis/overview`

Métriques globales pour le Command Center dashboard.

**Réponse**

```json
{
  "data": {
    "revenue24h": 245670.50,
    "transactionCount24h": 183,
    "successRate": 94.5,
    "failoverRate": 8.2,
    "failoverCount": 15,
    "trends": {
      "revenue": 12.4,
      "transactions": -3.1
    }
  }
}
```

| Champ | Type | Description |
|---|---|---|
| `revenue24h` | float | Revenus (transactions succeeded) sur 24h |
| `successRate` | float | % de succès sur 24h |
| `failoverRate` | float | % d'intentions ayant nécessité >1 tentative |
| `trends.revenue` | float | Δ% vs les 24h précédentes |

---

### `GET /api/admin/kpis/timeseries?period=30d`

Données temporelles pour les graphiques de revenus.

**Paramètres**

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `period` | `24h`, `7d`, `30d`, `90d` | `30d` |

**Réponse**

```json
{
  "data": [
    {
      "period": "2026-02-20",
      "totalCount": 45,
      "successCount": 42,
      "revenue": 89500.00,
      "successRate": "93.3"
    }
  ]
}
```

---

### `GET /api/admin/kpis/lms?period=30d&limit=10`

Analytics spécifiques au LMS Studies Learning.

**Réponse**

```json
{
  "data": {
    "topFormations": [
      {
        "courseId": "123",
        "courseName": "Développement Web Full-Stack",
        "packageType": "premium",
        "salesCount": 47,
        "totalRevenue": 234000.00,
        "avgAmount": 4978.72,
        "currency": "XAF"
      }
    ],
    "walletSummary": {
      "activeWallets": 28,
      "totalBalance": 1245670.00,
      "monthlyCredit": 345000.00,
      "topFormateurs": [...]
    },
    "formationsStats": {
      "totalPublished": 156,
      "newThisMonth": 12
    }
  }
}
```

> **Note :** `topFormations` requiert que les commandes stockent `courseId` et `courseName` dans le champ `metadata` de la table `aggp_orders`.  
> Exemple de payload à envoyer lors de l'initiation de paiement :
>
> ```json
> { "metadata": { "courseId": "123", "courseName": "Formation X", "packageType": "premium" } }
> ```

---

### `GET /api/admin/analytics/geo?period=30d`

Répartition géographique (volume et taux de succès par pays).

```json
{
  "data": [
    {
      "countryCode": "CM",
      "totalAttempts": 340,
      "successCount": 312,
      "volume": 1560000.00,
      "successRate": "91.8"
    }
  ]
}
```

---

### `GET /api/admin/analytics/providers?period=24h`

Performance détaillée par provider.

**Paramètres** : `period` → `1h`, `24h`, `7d`, `30d`

```json
{
  "data": [
    {
      "providerId": 1,
      "name": "CinetPay",
      "code": "cinetpay",
      "isActive": true,
      "totalAttempts": 150,
      "successCount": 138,
      "failureCount": 12,
      "successRate": 92.0,
      "healthStatus": "operational"
    }
  ]
}
```

**Statuts de santé**

| `healthStatus` | Condition |
|---|---|
| `operational` | actif + taux succès ≥ 80% |
| `degraded` | actif + taux succès 50–79% |
| `critical` | actif + taux succès < 50% |
| `idle` | actif + 0 tentatives sur la période |
| `inactive` | désactivé |

---

## 4. Gestion des Providers

### `GET /api/admin/providers`

Liste tous les providers avec leur santé (24h par défaut).

---

### `GET /api/admin/providers/factory-codes`

Codes providers actuellement supportés côté factory.

```json
{ "data": ["stripe", "cinetpay", "kkiapay", "maviance"] }
```

---

### `GET /api/admin/providers/:id/sparkline`

Taux de succès horaire sur 48h (pour les mini-graphiques des cartes provider).

---

### `GET /api/admin/providers/:id/errors?period=24h`

Top 10 des codes d'erreur d'un provider.

```json
{
  "data": [
    { "errorCode": "INSUFFICIENT_FUNDS", "errorMessage": "...", "occurrences": 8 }
  ]
}
```

---

### `POST /api/admin/providers`

Enregistrer un nouveau provider.

```json
// Body
{
  "code": "wave",
  "name": "Wave Money",
  "supportCard": false,
  "supportMobileMoney": true,
  "apiEndpoint": "https://api.wave.com/v1",
  "credentials": {
    "apiKey": "wv_live_xxxxxx",
    "webhookSecret": "whsec_xxxxxx"
  }
}
```

```json
// Réponse 201
{
  "status": "success",
  "data": { "id": 5, "code": "wave", "name": "Wave Money", "isActive": false },
  "message": "Provider 'Wave Money' registered. Configure routes to activate.",
  "webhookUrl": "/api/webhooks/wave"
}
```

> **Note :** Le provider est créé en état **inactif**. Il faut configurer au moins une route de routage pour l'activer.

---

### `PUT /api/admin/providers/:id`

Mettre à jour le nom, endpoint, méthodes supportées ou credentials.

---

### `PUT /api/admin/providers/:id/toggle`

Activer/désactiver un provider (toggle).

```json
{
  "data": { "id": 1, "name": "CinetPay", "isActive": false },
  "message": "Provider 'CinetPay' is now INACTIVE"
}
```

---

### `POST /api/admin/providers/:id/test`

Teste que l'adapter peut être instancié (format credentials OK).

---

## 5. Règles de Routage

### `GET /api/admin/routes/matrix`

Matrice complète Pays × Provider.

```json
{
  "data": {
    "matrix": {
      "CM": {
        "cinetpay": { "routeId": 1, "priority": 1, "isActive": true, "currency": "XAF" },
        "maviance":  { "routeId": 2, "priority": 2, "isActive": true, "currency": "XAF" }
      },
      "SN": {
        "cinetpay": { "routeId": 3, "priority": 1, "isActive": true, "currency": "XOF" }
      }
    },
    "countries": ["CM", "SN"],
    "providers": [
      { "id": 1, "name": "CinetPay", "code": "cinetpay" }
    ]
  }
}
```

---

### `POST /api/admin/routes/simulate`

**Simuler le routage** avant mise en production.

```json
// Body
{
  "countryCode": "CM",
  "currency": "XAF",
  "amount": 50000,
  "paymentMethod": "mobile_money"
}
```

```json
// Réponse
{
  "data": {
    "input": { "countryCode": "CM", "currency": "XAF", "amount": 50000, "paymentMethod": "mobile_money" },
    "selectedProvider": {
      "position": 1,
      "providerName": "CinetPay",
      "providerCode": "cinetpay",
      "priority": 1
    },
    "fallbackChain": [
      { "position": 2, "providerName": "Maviance", "priority": 2 }
    ],
    "totalCandidates": 2
  }
}
```

---

### `POST /api/admin/routes`

Créer une règle de routage.

```json
{
  "providerId": 1,
  "countryCode": "CI",
  "currency": "XOF",
  "minAmount": 0,
  "maxAmount": null,
  "priority": 1
}
```

---

### `PUT /api/admin/routes/:id` / `DELETE /api/admin/routes/:id`

Modifier ou supprimer une règle.

---

## 6. Transactions

### `GET /api/admin/transactions`

**Paramètres de filtre/pagination**

| Param | Type | Exemple |
|---|---|---|
| `status` | string | `succeeded`, `failed`, `pending` |
| `provider` | string | `cinetpay` |
| `currency` | string | `XAF` |
| `from` | ISO date | `2026-02-01` |
| `to` | ISO date | `2026-02-20` |
| `search` | string | email ou référence commande |
| `page` | int | `1` |
| `limit` | int | `25` (max 100) |

---

### `GET /api/admin/transactions/:transactionNumber`

Drill-down complet d'une transaction : intent + order + **toutes les tentatives** (failover visible).

---

## 7. Webhooks

### `GET /api/admin/webhooks`

Liste + statistiques 24h intégrées dans la réponse.

### `POST /api/admin/webhooks/:id/replay`

Rejoue un événement webhook non traité. ⚠️ Génère une entrée dans le journal d'audit.

---

## 8. Journal d'Audit

### `GET /api/admin/audit-logs?action=TOGGLE_PROVIDER`

Actions enregistrées automatiquement

| `action` | Déclencheur |
|---|---|
| `CREATE_PROVIDER` | POST /providers |
| `UPDATE_PROVIDER` | PUT /providers/:id |
| `TOGGLE_PROVIDER` | PUT /providers/:id/toggle |
| `CREATE_ROUTE` | POST /routes |
| `UPDATE_ROUTE` | PUT /routes/:id |
| `DELETE_ROUTE` | DELETE /routes/:id |
| `REPLAY_WEBHOOK` | POST /webhooks/:id/replay |

---

## 9. CRON — Stats Cache

Pré-calcul des performances providers toutes les **5 minutes** :

```bash
# Exécution manuelle
node scripts/cron-stats.js

# Planification cron système (crontab -e)
0/5 * * * * cd /path/to/apps/backend && node scripts/cron-stats.js >> logs/cron.log 2>&1

# Avec PM2
pm2 start scripts/cron-stats.js --cron-restart "*/5 * * * *" --name psp-stats-cron
```

Le script écrit dans `aggp_provider_stats_cache` (périodes : 1h, 24h, 7d, 30d par provider).
