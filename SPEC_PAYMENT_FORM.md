# Specification - Formulaire de Paiement Professionnel

## 1. Contexte

Le formulaire de paiement doit etre:

- Parfaitement integre avec le backend existant
- Cohérent avec le design du dashboard (Tailwind CSS, Outfit font)
- Completement responsive
- Intelligent (gere toutes les reponses du backend)

## 2. Design System (copie du Dashboard)

### Couleurs

```css
--color-primary: #e63946 (rouge) --color-secondary: #1d3557 (bleu sombre)
  --color-success: #22c55e --color-warning: #f59e0b --color-danger: #ef4444
  --color-background: #f8fafc --color-surface: #ffffff --color-border: #e2e8f0
  --color-text-main: #1e293b --color-text-light: #64748b;
```

### Typographie

- Font: Outfit (comme le dashboard)
- Tailwind CSS

### Composants

- Cards avec bordures arrondies (rounded-2xl)
- Badges avec couleurs contextuelles
- Ombres subtiles
- Animations smooth

## 3. Flux Utilisateur

### Scenarios a gerer

| Scenario          | Reponse Backend                                         | Action Formulaire                     |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| Paiement reussi   | `{status: "success", data: {payment_url}}`              | Rediriger vers payment_url            |
| Email non verifie | `{status: "fail", code: "email_verification_required"}` | Afficher formulaire code verification |
| Erreur validation | `{status: "fail", message: "..."}`                      | Afficher erreur                       |
| Paiement refuse   | `{status: "fail", data: {error}}`                       | Afficher message specifique provider  |

### Verification Email

1. User soumet formulaire
2. Si email non verifie -> Backend retourne code
3. Afficher input pour code
4. Soumettre code -> POST /verify-email
5. Si OK -> Re-essayer paiement

## 4. Champs Requis (Backend)

```javascript
{
    // Obligatoires
    customerEmail: "email@exemple.com",
    amount: 1000,
    currency: "XAF",  // XAF, EUR, USD
    paymentMethod: "card" | "mobile_money",
    countryCode: "CM",  // ISO 2
    successUrl: "https://...",
    cancelUrl: "https://...",

    // Optionnels mais recommandes
    customerFirstname: "Jean",
    customerLastname: "Dupont",
    customerPhone: "+237612345678",
    customerCity: "Douala",
    customerPhoneNumber: "+237612345678",  // Alias
}
```

## 5. Reponses Backend a Gerer

### Success

```json
{
  "status": "success",
  "data": {
    "paymentUrl": "https://checkout.stripe.com/...",
    "orderReference": "ORD-XXX",
    "paymentIntentId": 123,
    "status": "pending"
  }
}
```

### Email Verification Required

```json
{
  "status": "fail",
  "message": "Email verification required.",
  "code": "email_verification_required",
  "data": {
    "email": "user@example.com",
    "expiresAt": "2026-02-27T12:00:00Z"
  }
}
```

### Paiement Fail

```json
{
  "status": "fail",
  "message": "Fonds insuffisants",
  "data": {
    "provider": "stripe",
    "error": "insufficient_funds"
  }
}
```

## 6. Structure Fichiers

```
apps/formulaire-payement/
├── onthesite.html          # Formulaire moderne
├── css/
│   └── payment-form.css    # Styles Tailwind-like
├── js/
│   ├── loadAll.js         # Entry point
│   ├── api/
│   │   ├── allUrl.js      # URLs config
│   │   └── sender.js      # API client avec gestion erreurs
│   └── formAction/
│       └── formManager.js # Logique principale
└── php/
    ├── config.php         # Configuration
    ├── api-client.php    # Client HTTP
    ├── init-payment.php # Endpoint init
    └── check-status.php  # Endpoint status
```

## 7. Fonctionnalites Requises

### UI/UX

- [ ] Responsive (mobile/tablet/desktop)
- [ ] Loading states
- [ ] Error handling visuel
- [ ] Validation temps reel
- [ ] Animations smooth

### Intelligence

- [ ] Detection type erreur
- [ ] Redirection automatique
- [ ] Verification email integrée
- [ ] Retry sur echec
- [ ] Stockage payment ID pour suivi

### Integration

- [ ] Mapping correct champs
- [ ] Gestion tous statuts backend
- [ ] Idempotence (cle unique)
- [ ] Logs pour debug

## 8. Methodes Payment

| Method       | Provider | Description                 |
| ------------ | -------- | --------------------------- |
| card         | Stripe   | Carte bancaire              |
| mobile_money | CinetPay | Mobile Money (CM, SN, etc.) |

## 9. Test Scenarios

1. Paiement carte direct
2. Paiement mobile money
3. Email non verifie -> verification -> paiement
4. Erreur fondos insuffisants
5. Paiement annule
6. Timeout reseau
