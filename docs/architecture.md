# Architecture initiale

## Limites de confiance

Le navigateur ne contacte que l’API HTTPS. L’API est l’unique composant autorisé à accéder à PostgreSQL, aux fournisseurs e-mail, au stockage privé et à Wave Business.

## Finances

Le portefeuille est représenté par quatre compartiments séparés : disponible, en attente, bonus et commissions. Toute mutation doit verrouiller le portefeuille concerné, écrire une transaction de registre et utiliser une clé d’idempotence unique dans la même transaction PostgreSQL.

## Wave

Le lien de paiement configuré n’est jamais une preuve de règlement. Un dépôt n’est crédité qu’après vérification serveur d’un événement Wave authentifié et non déjà traité, puis validation administrative selon la règle métier.

## Déploiement

Les secrets restent dans l’environnement de l’hébergeur. PostgreSQL doit être sauvegardé, chiffré en transit, et les migrations sont exécutées avant le déploiement de l’API.
