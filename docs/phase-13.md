# Phase 13 — Sécurité renforcée

Le bonus de bienvenue de 1 500 FCFA est crédité dès l’inscription, dans un portefeuille créé immédiatement. Un compte non vérifié reste inactif et ne peut pas utiliser le bonus.

L’administration exige désormais une seconde vérification TOTP après la connexion. Le premier administrateur ne peut être créé que par la commande serveur `npm run admin:bootstrap`, avec les variables `BOOTSTRAP_ADMIN_*`; cette commande refuse de s’exécuter si un administrateur existe déjà et affiche une URI à ajouter dans une application d’authentification.
