# Phase 5 — Investissements et gains

Les 24 offres fixes sont consultables dans l’espace client. L’achat est validé côté serveur avec une clé d’idempotence, un verrou de portefeuille et une écriture financière atomique.

Le premier gain est programmé exactement 24 heures après l’achat, puis quotidiennement. Chaque échéance est unique ; le job `npm run jobs:settle-gains` peut être lancé régulièrement par l’ordonnanceur de production et ne crédite jamais deux fois la même échéance.
