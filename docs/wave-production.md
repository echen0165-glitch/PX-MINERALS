# Activation Wave Business

L’endpoint à enregistrer auprès de Wave est `https://VOTRE-DOMAINE/webhooks/wave`. Il exige une signature `Wave-Signature` HMAC-SHA256 calculée sur le timestamp concaténé au corps brut, rejette les événements de plus de cinq minutes et enregistre chaque `wave_event_id` une seule fois.

## À fournir avant activation

1. Compte Wave Business et accès Checkout + Payout.
2. `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` et l’identifiant Business, ajoutés uniquement au gestionnaire de secrets de l’hébergeur.
3. Domaine HTTPS public et certificat TLS valide.
4. Webhook enregistré dans le portail Wave avec la stratégie Signing Secret.
5. Configuration de Checkout API : le lien statique actuel ne transporte pas de référence PX MINERALS, donc les webhooks sont journalisés mais ne créditent pas automatiquement un dépôt.
6. Accès de recette / processus de test fourni par Wave.

Wave demande un endpoint HTTPS, une réponse rapide et une gestion idempotente des doublons. La signature doit être contrôlée sur le corps brut de la requête. [Documentation officielle Wave](https://docs.wave.com/webhook)
