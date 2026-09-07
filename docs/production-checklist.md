# Préparation production — PX MINERALS

## À finaliser avant ouverture au public

- [ ] Hébergement Node.js et PostgreSQL managés dans une région appropriée.
- [ ] Domaine HTTPS, certificat TLS, sauvegardes PostgreSQL et procédure de restauration testée.
- [ ] Secrets placés dans un gestionnaire de secrets, jamais dans Git ni dans le navigateur.
- [ ] Fournisseur e-mail configuré : expéditeur, SPF, DKIM, DMARC et modèles transactionnels.
- [ ] Premier administrateur provisionné avec `npm run admin:bootstrap` et TOTP configuré.
- [ ] Stockage privé des documents et reçus configuré.
- [ ] Ordonnanceur exécutant `npm run jobs:settle-gains` régulièrement.
- [ ] Logs centralisés, surveillance des erreurs et alertes de disponibilité.
- [ ] Wave Business : configuration manuelle documentée ou API/webhook officiellement activés et testés.
- [ ] Obligations juridiques, fiscales, réglementaires et contractuelles validées pour les juridictions ciblées.
- [ ] Conditions générales, politique de confidentialité et documents d’investissement réels publiés.

## Déploiement

1. Renseigner les variables d’environnement dans l’hébergeur.
2. Exécuter `npm ci` et `npm run db:migrate`.
3. Lancer `npm test` et `npm run check`.
4. Démarrer l’API, puis vérifier `GET /health`.
5. Tester une inscription, une vérification e-mail, un dépôt manuel et le journal d’administration sur un environnement de recette.

Ne pas ouvrir les dépôts et retraits réels sans les validations de conformité nécessaires.
