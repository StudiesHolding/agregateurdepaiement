# 📊 ANALYSE: Formulaire de Paiement + Achat Packages B2B

## Résumé

Le formulaire de paiement dans [`apps/formulaire-payement`](apps/formulaire-payement) gère déjà partiellement les packages B2B. Cette analyse documente ce qui fonctionne, les problèmes et ce qui doit être ajouté.

---

## 1. STRUCTURE ACTUELLE DU FORMULAIRE

### Fichiers Principaux

| Fichier                                                                 | Description                          |
| ----------------------------------------------------------------------- | ------------------------------------ |
| [`php/init-payment.php`](apps/formulaire-payement/php/init-payment.php) | Endpoint d'initialisation paiement   |
| [`php/getPackage.php`](apps/formulaire-payement/php/getPackage.php)     | Récupère les détails d'un package    |
| [`php/getFormation.php`](apps/formulaire-payement/php/getFormation.php) | Récupère les détails d'une formation |
| [`js/main.js`](apps/formulaire-payement/js/main.js)                     | Logique principale frontend          |
| [`index.html`](apps/formulaire-payement/index.html)                     | Page principale du formulaire        |

### URL Supportées

```
# Pour une formation:
?type=formation&id=123

# Pour un package:
?type=package&id=456
?is_package=true&id=456
```

---

## 2. CHAMPS B2B DÉJÀ SUPPORTÉS

### Backend (init-payment.php:133-149)

```php
// LMS & B2B (MANDATORY for Packages)
'lmsItemId' => $data['lmsItemId'] ?? null,
'lmsItemType' => $data['lmsItemType'] ?? 'course',  // ← "package" si package
'formationId' => $data['formationId'] ?? $data['lmsItemId'] ?? null,
'formationName' => $data['formationName'] ?? null,
'licence_count' => $data['licence_count'] ?? 1,

// Corporate data (B2B)
'company_name' => $data['company_name'] ?? null,
'company_industry' => $data['company_industry'] ?? null,
'company_admin_email' => $data['company_admin_email'] ?? null,
```

### Frontend (main.js:199-201, 532-553)

```javascript
// Vérifie si c'est un package
const isPackage =
  urlParams.get("is_package") === "true" || urlParams.get("package") === "true";
this.config.isPackage = isPackage;

// Affiche le champ nombre de licences
if (this.config.isPackage) {
  // Show licence count input
}

// Affiche la section Corporate
if (this.config.isPackage && this.elements.corporateSection) {
  // Show corporate form
}
```

---

## 3. PROBLÈMES IDENTIFIÉS

### 🔴 Problème 1: getPackage.php - Requête SQL Incomplète

**Fichier:** [`php/getPackage.php:10-14`](apps/formulaire-payement/php/getPackage.php:10)

```php
// PROBLÈME: Ne récupère que name et price
// Manque: description, max_licences, currency, image_url, etc.
$query = $pdo->query("
    SELECT DISTINCT p.name AS name,p.price AS price
    FROM course_packages p
    WHERE p.id=$id
");
```

**Conséquence:** Le frontend ne peut pas afficher toutes les infos du package.

**Solution:** Étendre la requête SQL pour inclure tous les champs nécessaires.

---

### 🔴 Problème 2: Incohérence Nom de Colonne

**Contexte:** Le model FormationPackage utilise le champs `name` mais j'ai modifié la database pour utiliser `title` dans une précédente itération.

**Vérifier:**

- [`apps/backend/models/formation-package.model.js`](apps/backend/models/formation-package.model.js) utilise `name`
- [`apps/formulaire-payement/php/getPackage.php`](apps/formulaire-payement/php/getPackage.php) utilise `name`

Si la database utilise `title`, il faut soit:

1. Modifier la requête SQL pour utiliser `title AS name`
2. Ou migrer la database

---

### 🟡 Problème 3: Section Corporate Non Complète

**Fichier:** [`js/main.js:554-571`](apps/formulaire-payement/js/main.js:554)

La section corporate pour les packages existe mais:

- Pas de validation des champs entreprise
- Pas de calcul dynamique du prix (nb licences × prix unitaire)
- Pas de sélection de devise par entreprise

---

### 🟡 Problème 4: Flow Aprè

Le workflow de provisioning B2B après paiement fonctionne:

```php
// WebhookProcessor -> payment_confirmed
// apps/backend/services/webhook-processor.service.js:180
await B2BProvisioningService.handleB2BOrder(order);
```

Mais le formulaire actuel n'a pas de:

- Page de confirmation spécifique B2B
- Lien vers le dashboard B2B après paiement
- Email d'activation avec invoice

---

## 4. CE QUI FONCTIONNE

### ✅ già Implementato

1. **Détection package via URL**
   - `?type=package&id=456`
   - `?is_package=true&id=456`

2. **Input nombre de licences**
   - [`js/formAction/currency.js:36-48`](apps/formulaire-payement/js/formAction/currency.js:36)
   - Affiché quand `type === "package"`

3. **Section Corporate**
   - [`js/main.js:554-571`](apps/formulaire-payement/js/main.js:554)
   - Champs: company_name, company_industry, company_admin_email

4. **Envoi des données B2B au backend**
   - [`php/init-payment.php:133-149`](apps/formulaire-payement/php/init-payment.php:133)
   - Envoie `lmsItemType: "package"`
   - Envoie `licence_count`

5. **Calcul du prix dynamique**
   - [`js/formAction/currency.js:25-26`](apps/formulaire-payement/js/formAction/currency.js:25)
   - `price * numLicence`

---

## 5. CE QUI MANQUE

### À Ajouter

| #   | Fonctionnalité                                       | Priorité | Fichier                                                                                |
| --- | ---------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| 1   | Étendre getPackage.php pour récupérer plus de champs | HIGH     | [`php/getPackage.php`](apps/formulaire-payement/php/getPackage.php)                    |
| 2   | Validation champs corporate                          | HIGH     | [`js/main.js`](apps/formulaire-payement/js/main.js)                                    |
| 3   | Page confirmation B2B avec login                     | MEDIUM   | [`index.html`](apps/formulaire-payement/index.html)                                    |
| 4   | Invoice jointe à l'email                             | MEDIUM   | [`b2b-provisioning.service.js`](apps/backend/services/b2b-provisioning.service.js:122) |

---

## 6. SUGGESTIONS D'AMÉLIORATION

### getPackage.php - Version Améliorée

```php
<?php
require __DIR__ ."/../../config.php";
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents('php://input'), true);
$id = (int)$data['data']['id'];

// Vérifie que l'ID est un entier pour éviter SQL injection
if (!$id) {
    echo json_encode(['error' => 'ID invalide']);
    exit;
}

$query = $pdo->prepare("
    SELECT
        p.id,
        p.name AS title,  -- ou p.title si la colonne s'appelle title
        p.description,
        p.price,
        p.currency,
        p.image_url,
        p.max_licenses,
        p.target_audience,
        p.status
    FROM course_packages p
    WHERE p.id = :id AND p.status = 'published'
");

$query->execute(['id' => $id]);
$formation = $query->fetch(PDO::FETCH_ASSOC);

if ($formation) {
    // Ajoute le type pour le frontend
    $formation['type'] = 'package';
    $formation['numLicence'] = $formation['max_licenses'];
}

echo json_encode($formation ?: ['error' => 'Package non trouvé']);
```

### FormManager.js - Validation Corporate

```javascript
// Ajouter validation des champs corporate
validateCorporate() {
    if (this.config.isPackage) {
        const companyName = document.querySelector('[name="company_name"]').value;
        const companyEmail = document.querySelector('[name="company_admin_email"]').value;
        const licenceCount = document.querySelector('[name="licence_count"]').value;

        if (!companyName || companyName.length < 2) {
            throw new Error('Nom de entreprise requis');
        }

        if (!companyEmail || !this.isValidEmail(companyEmail)) {
            throw new Error('Email entreprise requis');
        }

        if (!licenceCount || licenceCount < 1) {
            throw new Error('Au moins 1 licence requis');
        }

        if (licenceCount > this.config.maxLicences) {
            throw new Error(`Maximum ${this.config.maxLicences} licences`);
        }
    }
}
```

---

## 7. WORKFLOW COMPLET Package B2B

```
Formulaire Payment (?type=package&id=456)
        │
        ▼
User sélectionne nb licences
        │
        ▼
User remplit infos entreprise (corporate)
        │
        ▼
POST /php/init-payment.php
        │
        ▼
Backend: OrchestratorService.initializePayment({
  lmsItemType: "package",
  licence_count: 5,
  company_name: "Entreprise X",
})
        │
        ▼
Redirect vers Provider (Stripe/KKiaPay/CinetPay)
        │
        ▼
Webhook: payment_confirmed
        │
        ▼
B2BProvisioningService.handleB2BOrder()
        │
        ├── Company.findOrCreate()
        ├── CompanyAdmin.create(disabled)
        ├── CompanyPackage.create()
        └── Email: Activation + Invoice PDF
        │
        ▼
User reçoit email avec lien /auth/activate
```

---

## 8. FICHIERS À MODIFIER

| Fichier                                                                           | Action Required                           |
| --------------------------------------------------------------------------------- | ----------------------------------------- |
| [`php/getPackage.php`](apps/formulaire-payement/php/getPackage.php)               | Étendre la requête SQL                    |
| [`js/main.js`](apps/formulaire-payement/js/main.js)                               | Ajouter validation corporate              |
| [`js/formAction/currency.js`](apps/formulaire-payement/js/formAction/currency.js) | Vérifier le calcul de prix                |
| [`index.html`](apps/formulaire-payement/index.html)                               | Ajouter page confirmation B2B optionnelle |

---

_Document généré le 2026-04-01_
_Projet: Formulaire Paiement + Packages B2B_
