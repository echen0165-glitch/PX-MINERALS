# Phase 12 — Administration privée

L’administration est servie séparément de l’espace client et toutes ses routes exigent une session dont le rôle serveur est `admin`. Il n’existe aucune inscription, promotion publique ni lien depuis l’espace client.

Les validations de dépôts sont atomiques : un dépôt ne peut être validé qu’une seule fois ; il est crédité dans le portefeuille, génère les commissions de parrainage du premier dépôt et produit une notification et une trace d’action admin dans la même transaction PostgreSQL.

## Précondition à fournir

Le premier compte admin doit être provisionné de manière contrôlée, hors interface publique, avec e-mail, mot de passe robuste et 2FA TOTP. Il reste à implémenter pendant la phase sécurité renforcée.
