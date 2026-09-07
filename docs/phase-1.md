# Phase 1 — Fondations

Livré : monorepo initial, API Express sécurisée, configuration par environnement, connexion PostgreSQL, exécuteur de migrations, schéma relationnel initial, 24 offres verrouillées et test structurel du registre financier.

Non activé : inscriptions, authentification, interfaces, paiements, e-mails, tâches de gains, administration et intégration Wave. Aucun paiement ni crédit de portefeuille ne peut être exécuté dans cet état.

## Prérequis local restant

Installer Docker Desktop, ou renseigner une instance PostgreSQL accessible dans `DATABASE_URL`, puis lancer `npm run db:migrate`.
