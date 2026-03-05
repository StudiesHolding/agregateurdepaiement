# Analyse Technique: URLs Absolues pour Déploiement

## 1. Structure des URLs Actuelles vs Requises

### Fichier: index.html

#### Actuel (chemin relatif - NE FONCTIONNE PAS sur WordPress)
```html
<!-- CSS -->
<link rel="stylesheet" href="./css/payment-form.css">

<!-- JS -->
<script type="module" src="./js/main.js"></script>
```

#### Requis (URL absolue)
```html
<!-- CSS -->
<link rel="stylesheet" href="https://new.studieslearning.com/Studies-learning/plugin/formulaire-payement/css/payment-form.css">

<!-- JS -->
<script type="module" src="https://new.studieslearning.com/Studies-learning/plugin/formulaire-payement/js/main.js"></script>
```

---

## 2. Fichiers à Mettre à Jour

### 2.1 CSS (1 fichier principal)
| Actuel | À remplacer par |
|--------|------------------|
| `./css/payment-form.css` | `https://new.studieslearning.com/.../css/payment-form.css` |

### 2.2 JavaScript (plusieurs fichiers)

#### Dans index.html - Chargement principal
```html
<!-- Kee p externe - ne change pas -->
<script src="https://cdn.kkiapay.me/k.js"></script>

<!-- JS principal -->
<script type="module" src="https://new.studieslearning.com/.../js/main.js"></script>
```

#### Dans main.js - Importations internes

Le fichier `main.js` utilise des imports ES6:
```javascript
import { ApiClient } from './api/client.js';
import { CountrySelector } from './ui/country-selector.js';
import { Toast } from './ui/toast.js';
// ... autres imports
```

**Problème**: Ces imports relatifs ne fonctionneront pas car:
1. Le fichier est chargé via une URL absolue
2. Les imports relatifs chercheront `./api/client.js` qui n'existe pas à cette URL

**Solution**: Il faut que ton VPS serve les fichiers avec la bonne structure de dossiers.

---

## 3. Structure de Fichiers sur le VPS

### Structure actuelle (locale)
```
apps/formulaire-payement/
├── index.html
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
│   ├── ui/
│   │   ├── country-selector.js
│   │   └── toast.js
│   └── ...
└── php/
    ├── init-payment.php
    └── ...
```

### Structure requise sur VPS
```
/var/www/html/.../formulaire-payement/
├── index.html          # Copie modifiée avec URLs absolues
├── css/
│   └── payment-form.css
├── js/
│   ├── main.js         # NE PAS MODIFIER - les imports fonctionnent
│   ├── loadAll.js
│   ├── api/
│   │   ├── client.js
│   │   ├── config.js
│   │   └── sender.js
│   ├── config/
│   │   └── country-config.js
│   ├── ui/
│   │   ├── country-selector.js
│   │   └── toast.js
│   └── ...
└── php/
    ├── init-payment.php
    ├── verify-email.php
    ├── config.php
    └── ...
```

---

## 4. Pourquoi les Imports JS Fonctionnent

### Dans main.js
```javascript
import { ApiClient } from './api/client.js';
```

Cette ligne fonctionne si:
- `main.js` est served from `https://.../js/`
- `client.js` est à `https://.../js/api/client.js`

**Car**: Les URLs relatives dans les modules JS sont résolues par rapport au fichier qui les importe, pas par rapport au document HTML.

---

## 5. Ce QUI Change Entre Ancien et Nouveau

### Ancien Snippet WordPress
```html
<link href="...importation.css">
<script src="...loadAll.js"></script>
```

### Nouveau (à créer)
```html
<!-- Fonts (externes) -->
<link href="https://fonts.googleapis.com/css2?family=Outfit...">

<!-- CSS principal -->
<link href="https://new.studieslearning.com/Studies-learning/plugin/formulaire-payement/css/payment-form.css">

<!-- Corps du formulaire -->
<div id="app">...</div>

<!-- Kkiapay SDK -->
<script src="https://cdn.kkiapay.me/k.js"></script>

<!-- JS principal (ES Module) -->
<script type="module" src="https://new.studieslearning.com/Studies-learning/plugin/formulaire-payement/js/main.js"></script>
```

---

## 6. Points Importants

### ✅ Ce qui fonctionne
- Les imports ES6 dans `main.js` fonctionnent si la structure de dossiers est préservée
- Le CSS est chargé via une URL absolue
- Les fonts Google sont externes

### ⚠️ Ce qui pose problème
- **Tu DOIS héberger tous les fichiers JS/CSS sur ton VPS**
- **Tu DOIS garder la même structure de dossiers**
- **index.html doit pointer vers les bons URLs absolus**

### 📋 Checklist Déploiement

1. [ ] Upload tous les fichiers (css, js, php) sur VPS
2. [ ] Vérifier que la structure de dossiers est identique
3. [ ] Créer une copie de index.html avec URLs absolues
4. [ ] Tester que le formulaire charge correctement
5. [ ] Vérifier que les appels API fonctionnent

---

## 7. Questions?

Si quelque chose n'est pas clair, dis-moi exactement:
- Quelle est l'URL exacte où tu hébergeras les fichiers?
- As-tu accès au VPS pour uploader les fichiers?
