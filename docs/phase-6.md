# Phase 6 — Dépôts Wave

Un client peut choisir uniquement un montant prédéfini. L’API crée un dépôt `pending`, une référence client et une trace Wave, puis présente le lien de paiement fourni par le propriétaire.

Le lien Wave statique ne contient pas de preuve vérifiable ni de référence de commande PX MINERALS. Il ne peut donc jamais déclencher de crédit automatique. La validation manuelle par administration sera développée avec l’espace admin. La validation automatique ne sera activée qu’après fourniture des accès Wave Business, du secret de signature et d’un webhook HTTPS configuré.
