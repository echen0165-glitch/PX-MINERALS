# Phase 2 — Authentification

## Livré

- inscription avec validation serveur des champs, pseudo unique et mot de passe robuste ;
- code de vérification e-mail à usage unique, expirant après 15 minutes et limité à cinq essais ;
- activation atomique du compte, portefeuille et code de parrainage créés à la vérification ;
- connexion, sessions persistantes dans PostgreSQL et cookie `HttpOnly` ;
- déconnexion et invalidation de session ;
- récupération de mot de passe par code e-mail, avec invalidation des autres sessions.

## E-mail avant production

Brevo est pris en charge lorsque `EMAIL_PROVIDER=brevo`, `EMAIL_FROM` et `EMAIL_API_KEY` sont renseignés. En développement sans ces variables, le code est écrit dans le journal de l’API uniquement. En production, l’API bloque l’envoi si la configuration manque.
