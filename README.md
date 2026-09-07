# PX MINERALS

Fondations de la plateforme PX MINERALS : API Node.js/Express, PostgreSQL et migrations versionnées.

## Démarrage local

1. Copiez `.env.example` vers `.env` et remplacez les secrets.
2. Démarrez PostgreSQL avec `docker compose up -d`.
3. Installez les dépendances avec `npm install`.
4. Appliquez le schéma avec `npm run db:migrate`.
5. Lancez l’API avec `npm run dev`.

L’état de santé est disponible sur `GET /health`. Aucune route financière n’est exposée durant cette phase.

## Wave

`WAVE_DEPOSIT_URL` est un lien de paiement communiqué par le propriétaire. Il ne déclenche aucun crédit de portefeuille. Les dépôts ne pourront être validés automatiquement qu’après configuration des identifiants Wave Business, du webhook HTTPS et de la vérification de signature.

## Avant production

Consultez [`docs/production-checklist.md`](docs/production-checklist.md). Avec le lien Wave Business seul, utilisez le processus de validation manuelle depuis l’administration ; aucune validation automatique n’est activée.
