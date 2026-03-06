# Plan de Déploiement: Formulaire de Paiement sur WordPress + VPS

## 1. Analyse des Fichiers

### Structure Actuelle du Formulaire

```
apps/formulaire-payement/
├── index.html          # Page principale du formulaire
├── onthesite.html     # Version intégrée
├── css/
│   └── payment-form.css    # 26,729 bytes
├── js/
│   ├── main.js             # 38,110 bytes - Application principale
│   ├── loadAll.js          # Chargement des modules
│   ├── api/
│   │   ├── client.js       # Client API
│   │   ├── config.js       # Configuration
│   │   └── sender.js       # Envoi de requêtes
│   ├── config/
│   │   └── country-config.js  # Config pays/devise
│   └── ...
└── php/                    # Scripts serveur (DOIVENT rester sur VPS)
    ├── init-payment.php
    ├── verify-email.php
    └── ...
```

### Dépendances Externes

| Ressource | URL | Type |
|-----------|-----|------|
| Kkiapay SDK | `https://cdn.kkiapay.me/k.js` | Externe |
| Google Fonts | `https://fonts.googleapis.com/...` | Externe |
| Images Logo | `https://new.studieslearning.com/...` | Externe |

---

## 2. Problèmes à Résoudre

### Problème 1: Chemins Relatifs

Les fichiers actuels utilisent des chemins relatifs:
```html
<link rel="stylesheet" href="./css/payment-form.css">
<script type="module" src="./js/main.js"></script>
```

Ces chemins **ne fonctionneront pas** sur WordPress car le HTML sera dans un chemin différent des fichiers CSS/JS.

### Probl Scripts PHP

Leème 2: formulaire utilise des fichiers PHP qui font office de proxy vers le backend:
- `init-payment.php` → Appelle le backend Node.js
- `verify-email.php` → Vérification email
- Ces fichiers DOIVENT être hébergés sur le VPS

### Problème 3: Configuration des URLs

Le fichier `js/api/allUrl.js` contient les URLs du backend qui devront être mises à jour.

---

## 3. Plan de Déploiement

### Étape 1: Préparer les Fichiers sur le VPS

```
/var/www/html/payment-form/
├── css/
│   └── payment-form.css
├── js/
│   ├── main.js
│   ├── loadAll.js
│   ├── api/
│   │   ├── client.js
│   │   ├── config.js
│   │   └── sender.js
│   ├── config/
│   │   └── country-config.js
│   └── ...
└── php/                    # Scripts proxy
    ├── init-payment.php
    ├── verify-email.php
    ├── request-code.php
    └── config.php
```

### Étape 2: Modifier les Chemins dans index.html

Créer une **nouvelle version** du fichier HTML avec:

```html
<!-- Modifier les chemins relatifs en absolus -->
<link rel="stylesheet" href="https://tonsite.com/payment-form/css/payment-form.css">

<!-- Garder le module JS -->
<script type="module" src="https://tonsite.com/payment-form/js/main.js"></script>
```

### Étape 3: Mettre à jour les URLs du Backend

Dans `js/api/allUrl.js`, mettre à jour:

```javascript
// AVANT (local)
const API_BASE_URL = 'http://localhost:3000';

// APRÈS (production)
const API_BASE_URL = 'https://api.tondomaine.com';
```

### Étape 4: Configuration PHP

Dans `php/config.php`, mettre à jour:

```php
// URLs de l'API backend
define('BACKEND_URL', 'https://api.tondomaine.com');
```

### Étape 5: Créer le Snippet WordPress

```html
<!-- WordPress Snippet -->
<div id="studies-payment-form">
  <!-- Contenu du formulaire -->
</div>

<!-- Charger le CSS -->
<link rel="stylesheet" href="https://tonsite.com/payment-form/css/payment-form.css">

<!-- Charger le JS (ES Module) -->
<script type="module" src="https://tonsite.com/payment-form/js/main.js"></script>
```

---

## 4. Fichiers à Modifier

| Fichier | Action | Raison |
|---------|--------|--------|
| `js/api/allUrl.js` | Modifier API_BASE_URL | Pointer vers le backend |
| `php/config.php` | Modifier BACKEND_URL | Pointer vers le backend |
| `index.html` | Créer copie modifiée | Chemins absolus |

---

## 5. Ce QUI NE FONCTIONNERA PAS

⚠️ **Attention**: Le formulaire actuel utilise des **chemins relatifs** et des **modules ES6**. Cela pose problème sur WordPress car:

1. **C modulesORS**: Les ES6 (`type="module"`) doivent être servis avec CORS depuis le même domaine
2. **Chemin relatif**: `./js/main.js` ne fonctionnera pas dans un snippet WordPress

**Solution**: Utiliser un plugin WordPress qui permet d'injecter du HTML brut, ou créer un fichier HTML complet avec des chemins absolus.

---

## 6. Alternative Recommandée

Au lieu d'un snippet, je recommande:

### Option A: Page WordPress Complète
1. Créer une page WordPress avec un **template personnalisé**
2. Héberger tous les fichiers sur le VPS
3. La page charge les fichiers locaux

### Option B: Iframe
1. Héberger le formulaire complet sur le VPS
2. Intégrer via iframe dans WordPress:
```html
<iframe src="https://tonsite.com/payment-form/" width="100%" height="600"></iframe>
```

### Option C: Plugin WordPress Simple
1. Créer un plugin WordPress minimal
2. Le plugin charge le HTML/CSS/JS directement

---

## 7. Résumé des Étapes

1. **VPS**: Upload tous les fichiers (CSS, JS, PHP) dans `/var/www/html/payment-form/`
2. **Backend**: Déployer le backend Node.js sur le VPS (ou utiliser un service comme Render)
3. **URLs**: Mettre à jour les URLs dans les fichiers de configuration
4. **WordPress**: Créer le snippet avec les chemins absolus

---
