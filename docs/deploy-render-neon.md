# Mise en ligne gratuite de démonstration

> Le projet est aussi préparé pour Netlify avec `netlify.toml`. Pour Netlify, utilisez Supabase comme base et définissez les variables d’environnement dans l’interface Netlify avec les portées **Builds** et **Functions**. La tâche des gains y est exécutée automatiquement toutes les heures à :15 UTC.

Cette procédure publie PX MINERALS avec Render (site) et Neon (PostgreSQL). Elle convient aux essais et aux démonstrations, pas à une plateforme financière en production.

## 1. Publier le code sur GitHub

Créez un dépôt GitHub privé nommé `px-minerals`, puis envoyez le dossier du projet dans ce dépôt. Ne publiez jamais le fichier `.env`.

## 2. Créer la base Neon

1. Créez un projet PostgreSQL sur Neon.
2. Copiez la chaîne de connexion PostgreSQL fournie par Neon.
3. Conservez-la secrète : elle sera ajoutée uniquement dans Render à l’étape suivante.

## 3. Créer le service Render

1. Dans Render, choisissez **New → Blueprint** et sélectionnez le dépôt GitHub.
2. Render détecte le fichier `render.yaml`.
3. Créez le service `px-minerals` au plan gratuit.
4. Dans **Environment**, complétez les variables marquées comme secrètes :
   - `DATABASE_URL` : chaîne de connexion Neon
   - `APP_ORIGIN` : URL Render finale, par exemple `https://px-minerals.onrender.com`
   - `WAVE_DEPOSIT_URL` : lien Wave Business fourni par le propriétaire
   - `EMAIL_API_KEY` : clé Brevo
   - `EMAIL_FROM` : expéditeur Brevo vérifié
   - `ADMIN_2FA_SECRET` : secret TOTP de l’administrateur
5. Lancez le déploiement.

Les migrations sont appliquées automatiquement au démarrage. Vérifiez ensuite l’URL `/health` : elle doit afficher `status: ok` et `database: connected`.

## Important

- Les services Render gratuits se mettent en veille après une période d’inactivité ; le premier chargement peut être lent.
- La formule gratuite ne remplace pas les sauvegardes, la surveillance et l’hébergement professionnel nécessaires à une activité financière réelle.
- Les dépôts Wave restent contrôlés manuellement dans l’administration.
