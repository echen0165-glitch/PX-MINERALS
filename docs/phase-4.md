# Phase 4 — Portefeuille et transactions

Le portefeuille est opérationnel comme couche de données : quatre soldes isolés, registre immuable, écritures atomiques et verrouillage de ligne PostgreSQL. Les règles de dépôt, retrait, investissement, gains, bonus et commissions seront les seuls composants autorisés à appeler le service de mutation.

Les boutons Dépôt et Retrait sont visuels uniquement jusqu’aux phases dédiées : ils ne créditent ni ne débitent aucun solde.
