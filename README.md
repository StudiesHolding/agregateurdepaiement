# Agrégateur de paiement Studies Holding (PSP)

Moteur de routage des paiements de l'écosystème Studies Learning : agrégateurs mobile money africains et Stripe
pour les cartes, orchestration des commandes (saga « payé »), crédit des commissions et inscriptions via l'API
interne du backend Studies Learning.

## Applications

| Dossier | Rôle | Stack |
|---|---|---|
| `apps/backend` | API de paiement, webhooks signés, saga, stratégies d'achat du purchase-engine. Port local 3000. | Node 22, Express, Sequelize, Jest |
| `apps/dashboard` | Tableau de bord PSP (routage, priorités, transactions). | Next.js |
| `apps/b2b-dashboard` | Espace entreprise (licences, packages). | Next.js |
| `apps/dashboard` → « Guide » | Guide de l’espace finance (utilisation et intégration), réservé à l’équipe connectée. | — |

`docs/` : analyses et audits historiques (`docs/analyses/`), gabarits d'e-mails.

## Qualité

```bash
npm ci --prefix apps/backend
npm test --prefix apps/backend -- --testPathIgnorePatterns '/tests/integration/' 'e2e'
```

La CI GitHub (`.github/workflows/ci.yml`) rejoue les tests du backend et le lint des tableaux de bord sur chaque PR.

## Règles

- Le prix n'est jamais lu du navigateur : il vient du backend métier (contexte d'achat signé).
- Webhooks : signature vérifiée par prestataire ; clés d'idempotence sur chaque étape de la saga.
- Aucun secret versionné : `.env.example` décrit les variables.
