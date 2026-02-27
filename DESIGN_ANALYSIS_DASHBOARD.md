# 🎨 ANALYSE DESIGN DASHBOARD & RECOMMANDATIONS UI/UX

## Respect du Design System Existant & Amélioration Traçabilité

---

# PARTIE 1: ANALYSE DU DESIGN SYSTEM ACTUEL

## 1.1 Palette de Couleurs

Le dashboard utilise une palette de couleurs **Studies Learning** cohérente :

```css
/* === COULEURS PRIMAIRES === */
--primary: #4f46e5 (Indigo - Actions principales) --primary-dark: #4338ca
  --primary-light: #e0e7ff /* === COULEURS STATUT === */ --success: #10b981
  (Vert - Succès) --success-light: #d1fae5 --success-dark: #065f46
  --warning: #f59e0b (Orange - Attention) --warning-light: #fef3c7
  --warning-dark: #92400e --danger: #ef4444 (Rouge - Erreur/Suppression)
  --danger-light: #fee2e2 --danger-dark: #7f1d1d --secondary: #0ea5e9
  (Bleu - Informations) --secondary-light: #e0f2fe /* === NEUTRES === */
  --surface: #ffffff --background: #f8fafc --border: #e2e8f0
  --text-main: #1e293b --text-light: #64748b;
```

## 1.2 Typographie

- **Police principale** : `Outfit` (Google Fonts)
- **Fallback** : Inter, system-ui
- **Weights** : 300, 400, 500, 600, 700, 800

```css
/* Classes utilitaires déjà existantes */
.text-xs    /* 12px */
.text-sm    /* 14px */
.text-base  /* 16px */
.text-lg    /* 18px */
.text-xl    /* 20px */
.text-2xl   /* 24px */
.text-3xl   /* 30px */

/* Weights */
.font-medium    /* 500 */
.font-semibold  /* 600 */
.font-bold      /* 700 */
.font-black     /* 900 */
```

## 1.3 Composants UI Existants

### A. Cards

```css
.card {
  @apply bg-surface rounded-2xl border border-border shadow-card;
  transition:
    box-shadow 0.25s ease,
    transform 0.25s ease;
}

.card:hover {
  @apply shadow-card-hover;
}

.card-interactive {
  @apply card cursor-pointer;
}
.card-interactive:hover {
  @apply -translate-y-0.5;
}
```

### B. Boutons

```css
.btn-primary {
  @apply bg-primary text-white px-4 py-2 rounded-xl font-semibold;
  @apply hover:bg-primary-dark transition-colors;
}

.btn-ghost {
  @apply bg-transparent text-text-light px-3 py-2 rounded-xl;
  @apply hover:bg-background hover:text-text-main transition-colors;
}

.btn-danger {
  @apply bg-danger text-white px-4 py-2 rounded-xl font-semibold;
  @apply hover:bg-danger-dark transition-colors;
}
```

### C. Badges / Status Chips

```css
.badge {
  @apply px-3 py-1 rounded-full text-xs font-bold;
}

.badge-success {
  @apply bg-success-light text-success-dark border border-success/20;
}

.badge-warning {
  @apply bg-warning-light text-warning-dark border border-warning/20;
}

.badge-danger {
  @apply bg-danger-light text-danger-dark border border-danger/20;
}
```

### D. Inputs

```css
.input {
  @apply bg-background border border-border rounded-xl px-4 py-2;
  @apply focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary;
  @apply placeholder:text-text-light text-text-main;
}
```

## 1.4 Layout & Navigation

### Sidebar (Structure)

```
┌─────────────────────────────┐
│  Studies PSP                │
│  Payment Operations         │
├─────────────────────────────┤
│  Vue d'ensemble            │
│  ├── Command Center         │
├─────────────────────────────┤
│  Providers                 │
│  ├── Provider Health       │
│  ├── Route Builder        │
│  ├── Provider Studio      │
├─────────────────────────────┤
│  Données                   │
│  ├── Transactions          │
│  ├── Analytics LMS         │
│  ├── Webhooks             │
├─────────────────────────────┤
│  Administration            │
│  ├── Journal d'Audit      │
│  ├── Notifications        │
└─────────────────────────────┘
```

### Header

- Titre de page à gauche
- Date du jour
- Boutons d'action (Refresh, Theme Toggle, Language, Notifications)

## 1.5 Patterns UI Observés

### Timeline (Page Transaction Détail)

Le dashboard utilise déjà un pattern **timeline** pour l'historique :

```jsx
// Structure observée dans transactions/[id]/page.tsx
<div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
  {attempts.map((attempt, i) => (
    <div className="relative flex items-start gap-6 group">
      {/* Cerclé avec icône */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 bg-white">
        <CheckCircle2 size={18} />
      </div>

      {/* Carte内容 */}
      <div className="flex-1 bg-background rounded-2xl p-4 border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold">Tentative #{i + 1}</p>
          <span className="text-[10px] text-text-light">14:32:15</span>
        </div>

        {/* Détails */}
        <DetailRow label="ID" value={attempt.transactionNumber} mono />
      </div>
    </div>
  ))}
</div>
```

### Detail Section Pattern

```jsx
<DetailSection title="Titre" icon={Icon}>
  {/* Contenu */}
</DetailSection>

// Rendu:
// ┌────────────────────────────┐
// │ [Icon] Titre               │
// ├────────────────────────────┤
// │ Contenu...                 │
// └────────────────────────────┘
```

---

# PARTIE 2: RECOMMANDATIONS UI/UX POUR LE NOUVEAU WORKFLOW

## 2.1 Nouveaux Statuts - Design Visuel

Je propose d'ajouter les nouveaux statuts au design system existant :

```css
/* === NOUVEAUX STATUTS === */

/* En attente validation admin */
.status-pending-validation {
  @apply bg-secondary-light text-secondary-dark border-secondary/20;
}

/* Validé - En attente création compte */
.status-validated {
  @apply bg-primary-light text-primary-dark border-primary/20;
}

/* Complété - Terminé */
.status-completed {
  @apply bg-success-light text-success-dark border-success/20;
}

/* Rejeté */
.status-rejected {
  @apply bg-danger-light text-danger-dark border-danger/20;
}

/* Expiré */
.status-expired {
  @apply bg-warning-light text-warning-dark border-warning/20;
}
```

## 2.2 Composants UI à Créer

### A. OrderStatusBadge

```tsx
function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<
    OrderStatus,
    { label: string; class: string; icon: LucideIcon }
  > = {
    pending: {
      label: "En attente",
      class: "bg-warning-light text-warning-dark border-warning/20",
      icon: Clock,
    },
    payment_confirmed: {
      label: "Paiement confirmé",
      class: "bg-secondary-light text-secondary-dark border-secondary/20",
      icon: CreditCard,
    },
    validated: {
      label: "Validé",
      class: "bg-primary-light text-primary-dark border-primary/20",
      icon: CheckCircle2,
    },
    completed: {
      label: "Terminé",
      class: "bg-success-light text-success-dark border-success/20",
      icon: BadgeCheck,
    },
    rejected: {
      label: "Rejeté",
      class: "bg-danger-light text-danger-dark border-danger/20",
      icon: XCircle,
    },
  };

  const { label, class: className, icon: Icon } = config[status];

  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5",
        className,
      )}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}
```

### B. PurchaseTypeBadge

```tsx
function PurchaseTypeBadge({ type }: { type: "self" | "gift" }) {
  if (type === "gift") {
    return (
      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
        <Gift size={10} />
        Cadeau
      </span>
    );
  }
  return null; // Ne pas afficher pour "self" (c'est le défaut)
}
```

### C. ActionButtons (Admin)

```tsx
function OrderActionButtons({
  order,
  onValidate,
  onReject,
  onComplete,
}: Props) {
  const status = order.status;

  return (
    <div className="flex items-center gap-2">
      {status === "payment_confirmed" && (
        <>
          <button
            onClick={onValidate}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            Valider & Envoyer Facture
          </button>
          <button
            onClick={onReject}
            className="btn-ghost text-danger flex items-center gap-2"
          >
            <XCircle size={16} />
            Rejeter
          </button>
        </>
      )}

      {status === "validated" && (
        <button
          onClick={onComplete}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={16} />
          Finaliser & Envoyer Accès
        </button>
      )}
    </div>
  );
}
```

## 2.3 Page Commandes - Structure Recommandée

En respectant le design existant, voici la structure recommandée pour la nouvelle page transactions :

```tsx
// ============================================================
// NOUVELLE PAGE: transactions/page.tsx (Version Améliorée)
// ============================================================

export default function OrdersPage() {
  const [filters, setFilters] = useState({
    status: "",
    purchaseType: "",
    formationId: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">
          Orders <span className="gradient-text">LMS</span>
        </h1>
        <p className="text-sm text-text-light mt-1">
          Gestion des inscriptions aux formations
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-background rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-text-light" />
          <input
            className="bg-transparent text-sm flex-1 outline-none"
            placeholder="Email, référence..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        {/* Status Filter */}
        <select className="input w-auto text-sm">
          <option value="">Tous les statuts</option>
          <option value="payment_confirmed">En attente validation</option>
          <option value="validated">Validés</option>
          <option value="completed">Terminés</option>
          <option value="rejected">Rejetés</option>
        </select>

        {/* Type Filter - NOUVEAU */}
        <select className="input w-auto text-sm">
          <option value="">Tous les types</option>
          <option value="self">Achat personnel</option>
          <option value="gift">Cadeau</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-background/50 border-b border-border">
            <tr>
              <th className="text-left px-6 py-4 text-xs font-bold text-text-light uppercase">
                Référence
              </th>
              <th className="text-left px-6 py-4 text-xs font-bold text-text-light uppercase">
                Client
              </th>
              <th className="text-left px-6 py-4 text-xs font-bold text-text-light uppercase">
                Formation
              </th>
              <th className="text-left px-6 py-4 text-xs font-bold text-text-light uppercase">
                Type
              </th>
              <th className="text-left px-6 py-4 text-xs font-bold text-text-light uppercase">
                Montant
              </th>
              <th className="text-left px-6 py-4 text-xs font-bold text-text-light uppercase">
                Statut
              </th>
              <th className="text-left px-6 py-4 text-xs font-bold text-text-light uppercase">
                Date
              </th>
              <th className="text-right px-6 py-4 text-xs font-bold text-text-light uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="hover:bg-background/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {order.reference}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {order.customerName}
                    </span>
                    <span className="text-xs text-text-light">
                      {order.customerEmail}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">{order.formationName}</td>
                <td className="px-6 py-4">
                  <PurchaseTypeBadge type={order.purchaseType} />
                </td>
                <td className="px-6 py-4 font-bold">
                  {formatXAF(order.amount)}
                </td>
                <td className="px-6 py-4">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-6 py-4 text-xs text-text-light">
                  {formatDate(order.createdAt)}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/transactions/${order.id}`}
                    className="btn-ghost text-xs"
                  >
                    Voir détails
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## 2.4 Page Détail Commande - Timeline Étendue

Pour la nouvelle page détail avec traçabilité complète :

```tsx
// ============================================================
// PAGE: transactions/[id]/page.tsx (Nouvelle Version)
// ============================================================

export default function OrderDetailPage() {
  const { order, auditLogs } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Commande {order.reference}
            <OrderStatusBadge status={order.status} />
          </h1>
          <p className="text-sm text-text-light">
            Créée le {formatDate(order.createdAt)}
          </p>
        </div>

        <OrderActionButtons
          order={order}
          onValidate={handleValidate}
          onReject={handleReject}
          onComplete={handleComplete}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* TIMELINE COMPLÈTE - NOUVELLE VERSION */}
          <DetailSection title="Historique & Traçabilité" icon={History}>
            <Timeline>
              {auditLogs.map((log) => (
                <TimelineItem
                  key={log.id}
                  timestamp={log.createdAt}
                  icon={getIconForAction(log.action)}
                  variant={getVariantForAction(log.action)}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-text-main">
                      {log.actionLabel}
                    </span>
                    <span className="text-xs text-text-light">
                      {log.actorType === "admin" && (
                        <span className="font-medium">
                          Par {log.actorEmail}
                        </span>
                      )}
                      {log.actorType === "system" && (
                        <span>Système automatique</span>
                      )}
                    </span>
                    {log.metadata?.emailSent && (
                      <span className="text-xs text-success mt-1">
                        ✉️ Email envoyé à {log.metadata.emailSent}
                      </span>
                    )}
                  </div>
                </TimelineItem>
              ))}
            </Timeline>
          </DetailSection>
        </div>

        <div className="space-y-6">
          {/* Informations Acheteur */}
          <DetailSection title="Acheteur" icon={User}>
            <DetailRow label="Nom" value={order.customerName} />
            <DetailRow label="Email" value={order.customerEmail} />
            <DetailRow label="Téléphone" value={order.customerPhone} />
          </DetailSection>

          {/* Informations Bénéficiaire - NOUVEAU */}
          {order.purchaseType === "gift" && (
            <DetailSection title="Bénéficiaire" icon={Gift}>
              <DetailRow
                label="Nom"
                value={
                  order.beneficiaryFirstName + " " + order.beneficiaryLastName
                }
              />
              <DetailRow label="Email" value={order.beneficiaryEmail} />
              <DetailRow
                label="Relation"
                value={order.beneficiaryRelationship}
              />
            </DetailSection>
          )}

          {/* Formation */}
          <DetailSection title="Formation" icon={GraduationCap}>
            <DetailRow label="Formation" value={order.formationName} />
            <DetailRow label="Prix" value={formatXAF(order.formationPrice)} />
          </DetailSection>

          {/* Credentials Envoyés - SI COMPLÉTÉ */}
          {order.status === "completed" && (
            <DetailSection title="Accès Campus" icon={Key}>
              <DetailRow label="Username" value={order.campusUsername} mono />
              <DetailRow label="Envoyé à" value={order.credentialsSentTo} />
              <DetailRow
                label="Le"
                value={formatDate(order.credentialsSentAt)}
              />
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

# PARTIE 3: SYSTÈME DE TRAÇABILITÉ COMPLÈTE

## 3.1 Modèle OrderAuditLog - Version Finale

```javascript
// Modèle de traçabilité ultra-complet
OrderAuditLog.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    // Commande
    orderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: "orders", key: "id" },
    },
    orderReference: {
      // Dénormalisé pour recherche rapide
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // Action
    action: {
      type: DataTypes.ENUM([
        // Phase paiement
        "ORDER_CREATED",
        "PAYMENT_INITIATED",
        "PAYMENT_RECEIVED",
        "PAYMENT_FAILED",
        "PAYMENT_CONFIRMED", // Admin a vu la commande

        // Phase validation
        "ORDER_VALIDATED", // Admin a validé
        "ORDER_REJECTED", // Admin a rejeté

        // Phase finalisation
        "ORDER_COMPLETED", // Admin a finalisé
        "CREDENTIALS_SENT", // Email credentials envoyé
        "FACTURE_SENT", // Email facture envoyé

        // Phase expiration
        "ORDER_EXPIRED",
        "ORDER_CANCELLED",
      ]),
      allowNull: false,
    },

    // Description humaine
    actionLabel: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Label affiché dans UI ex: "Paiement reçu"',
    },

    // Acteur (qui a fait l'action)
    actorType: {
      type: DataTypes.ENUM(["system", "admin", "webhook", "api"]),
      defaultValue: "system",
    },
    actorId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      comment: " admin si actorIDType=admin",
    },
    actorEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Email admin pour affichage",
    },
    actorName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Nom display de l'admin",
    },

    // Détails de l'action
    actionDetails: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Détails spécifiques à l'action",
    },

    // État avant / après (pour rollback)
    previousState: { type: DataTypes.JSON },
    newState: { type: DataTypes.JSON },

    // Connexion
    ipAddress: { type: DataTypes.STRING(45), allowNull: true },
    userAgent: { type: DataTypes.STRING(500), allowNull: true },

    // Résultats
    emailSentTo: { type: DataTypes.STRING(255), allowNull: true },
    emailSentAt: { type: DataTypes.DATE, allowNull: true },

    // Timestamp
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: "OrderAuditLog",
    tableName: "aggp_order_audit_logs",
    indexes: [
      { fields: ["orderId"] },
      { fields: ["orderReference"] },
      { fields: ["action"] },
      { fields: ["actorId"] },
      { fields: ["actorEmail"] },
      { fields: ["createdAt"] },
    ],
  },
);
```

## 3.2 Exemples de Logs

| Timestamp           | Action                   | Actor                           | Détails                                              |
| ------------------- | ------------------------ | ------------------------------- | ---------------------------------------------------- |
| 2026-02-25 14:30:00 | ORDER_CREATED            | system                          | Commande créée depuis API                            |
| 2026-02-25 14:32:15 | PAYMENT_RECEIVED         | webhook                         | Stripe webhook - paiement ok                         |
| 2026-02-25 14:32:16 | PAYMENT_CONFIRMED        | system                          | Status → payment_confirmed                           |
| 2026-02-25 14:32:17 | FACTURE_SENT             | system                          | Email envoyé à jean@email.com (note: pas de facture) |
| 2026-02-25 15:45:00 | PAYMENT_CONFIRMED_VIEWED | admin:admin@studieslearning.com | IP: 196.XXX.XXX.XXX                                  |
| 2026-02-25 16:20:00 | ORDER_VALIDATED          | admin:admin@studieslearning.com | IP: 196.XXX.XXX.XXX                                  |
| 2026-02-25 16:20:01 | FACTURE_SENT             | system                          | Email + Facture envoyé à jean@email.com              |
| 2026-02-25 16:45:00 | ORDER_COMPLETED          | admin:admin@studieslearning.com | IP: 196.XXX.XXX.XXX                                  |
| 2026-02-25 16:45:01 | CREDENTIALS_SENT         | system                          | Email envoyé à marie@email.com                       |

## 3.3 Service de Log - Implementation

```javascript
// services/order-audit.service.js

export class OrderAuditService {
  static async log(params) {
    const {
      orderId,
      orderReference,
      action,
      actionLabel,
      actorType = "system",
      actorId = null,
      actorEmail = null,
      actorName = null,
      actionDetails = {},
      previousState = null,
      newState = null,
      ipAddress = null,
      userAgent = null,
      emailSentTo = null,
    } = params;

    return await OrderAuditLog.create({
      orderId,
      orderReference,
      action,
      actionLabel,
      actorType,
      actorId,
      actorEmail,
      actorName,
      actionDetails,
      previousState,
      newState,
      ipAddress,
      userAgent,
      emailSentTo,
      emailSentAt: emailSentTo ? new Date() : null,
      createdAt: new Date(),
    });
  }

  // Helper pour audit admin
  static async logAdminAction(params) {
    return this.log({
      ...params,
      actorType: "admin",
    });
  }

  // Helper pour actions système
  static async logSystemAction(params) {
    return this.log({
      ...params,
      actorType: "system",
    });
  }
}
```

## 3.4 Utilisation dans les Contrôleurs

```javascript
// Exemple: Validation d'une commande

async function validateOrder(
  orderId,
  adminId,
  adminEmail,
  action,
  notes,
  ipAddress,
  userAgent,
) {
  const order = await Order.findById(orderId);

  const previousState = { status: order.status };

  if (action === "validate") {
    // 1. Update order
    await order.update({
      status: "validated",
      validatedAt: new Date(),
      validatedBy: adminId,
      adminNotes: notes,
    });

    // 2. Envoyer email + facture (automatique)
    await MailService.sendValidationEmail(order);

    // 3. Log audit
    await OrderAuditService.logAdminAction({
      orderId: order.id,
      orderReference: order.reference,
      action: "ORDER_VALIDATED",
      actionLabel: "Commande validée par l'admin",
      actorId: adminId,
      actorEmail: adminEmail,
      previousState,
      newState: { status: "validated", validatedAt: new Date() },
      ipAddress,
      userAgent,
      emailSentTo: order.customerEmail,
    });
  } else if (action === "reject") {
    // Logique rejet...
  }
}
```

---

# PARTIE 4: RÉSUMÉ DESIGN & TRAÇABILITÉ

## 4.1 Design Components à Créer

| Composant            | Fichier                                     | Description                       |
| -------------------- | ------------------------------------------- | --------------------------------- |
| `OrderStatusBadge`   | `components/badges/OrderStatusBadge.tsx`    | Badge statuts commandes           |
| `PurchaseTypeBadge`  | `components/badges/PurchaseTypeBadge.tsx`   | Badge "Cadeau"                    |
| `OrderActionButtons` | `components/actions/OrderActionButtons.tsx` | Boutons valider/rejeter/finaliser |
| `Timeline`           | `components/ui/Timeline.tsx`                | Timeline réutilisable             |
| `TimelineItem`       | `components/ui/TimelineItem.tsx`            | Item timeline                     |
| `DetailSection`      | `components/ui/DetailSection.tsx`           | **EXISTE** - utiliser             |
| `DetailRow`          | `components/ui/DetailRow.tsx`               | **EXISTE** - utiliser             |

## 4.2 Couleurs pour Nouveaux Statuts

Respecter la palette existante :

| Statut            | Couleur BG      | Couleur Text   | Border       |
| ----------------- | --------------- | -------------- | ------------ |
| payment_confirmed | secondary-light | secondary-dark | secondary/20 |
| validated         | primary-light   | primary-dark   | primary/20   |
| completed         | success-light   | success-dark   | success/20   |
| rejected          | danger-light    | danger-dark    | danger/20    |
| expired           | warning-light   | warning-dark   | warning/20   |

## 4.3 Points Clés UI/UX

1. **Timeline verticale** avec ligne connectrice (pattern existant)
2. **Icons Lucide** pour chaque type d'action
3. **Chips/badges** arrondis avec bordures
4. **Cards avec ombres** et hover effects
5. **Police Outfit** pour tout le texte
6. **Format XAF** pour les montants
7. **Dates en format français** (toLocaleString 'fr-FR')

---

_Analyse Design & UI/UX - 25 février 2026_  
_Par: Architecte Solution_
