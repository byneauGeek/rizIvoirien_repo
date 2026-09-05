# Déploiement — RizIvoirien

## Base de données : passage SQLite (dev) → PostgreSQL (prod)

Le développement local utilise SQLite (`backend/prisma/dev.db`) pour sa simplicité.
La production doit utiliser PostgreSQL. Une migration PostgreSQL initiale a déjà
été générée hors-ligne (sans connexion à une base réelle) via :

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

et se trouve dans `backend/prisma/migrations-postgresql/<timestamp>_init/migration.sql`
(33 tables — reflète fidèlement le schema.prisma actuel, module B2B inclus).
**Ne réutilisez jamais les migrations SQLite existantes (`backend/prisma/migrations/`)
sur PostgreSQL** — leur SQL n'est pas compatible. Si le schema.prisma évolue encore
avant le premier déploiement prod, régénérez ce fichier avec la même commande
plutôt que de l'éditer à la main.

### Procédure de bascule (à faire une seule fois, avant le premier déploiement prod)

1. Provisionner une base PostgreSQL (Railway, Render, Supabase, RDS...) et récupérer
   son `DATABASE_URL` (format `postgresql://user:password@host:5432/dbname`).
2. Dans `backend/prisma/schema.prisma`, changer :
   ```prisma
   datasource db {
     provider = "postgresql"   // au lieu de "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. Archiver les migrations SQLite et activer les migrations PostgreSQL :
   ```bash
   cd backend/prisma
   mv migrations migrations-sqlite-archive
   mv migrations-postgresql migrations
   ```
4. Définir `DATABASE_URL` (PostgreSQL) dans l'environnement de production, puis :
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
5. Ne PAS lancer `npm run seed` sur la base de production sans le vouloir
   explicitement — le script refuse désormais de tourner si `NODE_ENV=production`
   sauf avec `SEED_ALLOW_PRODUCTION=true` (il efface tout et recrée des comptes
   de démo à mot de passe faible, y compris un ADMIN).
6. Vérifier `GET /api/health` → `{ "ok": true, "db": "ok" }`.

Pour le développement local, rien ne change : `schema.prisma` reste sur `sqlite`
et `backend/prisma/migrations/` tant que l'étape 2 ci-dessus n'a pas été faite
sur cette copie du code (typiquement : une branche/config dédiée au déploiement,
ou simplement au moment du premier déploiement prod si le repo passe à 100%
PostgreSQL y compris en dev).

## Variables d'environnement — Backend

Voir `backend/.env.example`. Récapitulatif de ce qui est **obligatoire en
production** :

| Variable | Rôle | Note |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL | voir ci-dessus |
| `JWT_SECRET` | Signature des tokens | générer avec `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` — jamais la valeur d'exemple |
| `ALLOWED_ORIGINS` | Whitelist CORS | domaine(s) frontend exact(s), jamais `*` |
| `FRONTEND_URL` | Liens dans les emails | `https://app.rizivoirien.ci` |
| `BASE_URL` | Base des URLs de fichiers uploadés en stockage disque | **obligatoire si `CLOUDINARY_CLOUD_NAME` n'est pas défini** — sans lui, `upload.js` échoue maintenant explicitement au lieu de renvoyer une URL `localhost` cassée |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Emails transactionnels | sans `SMTP_HOST`, les emails sont juste loggés (mode dev) |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Stockage image en prod | recommandé plutôt que le disque local |
| `SENTRY_DSN` | Suivi d'erreurs | optionnel |
| `ANTHROPIC_API_KEY` | Génération assistée de fiches produit | optionnel |
| `NODE_ENV=production` | Active les garde-fous prod (seed bloqué, BASE_URL obligatoire) | |

## Variables d'environnement — Frontend

`VITE_API_URL` doit pointer vers l'API en production (`https://api.rizivoirien.ci/api`).
Si elle est absente au moment du build (`npm run build`), l'app retombe sur
`localhost:3001` et log une erreur explicite en console — vérifiez toujours les
logs de build CI pour ce message avant de publier.

## Logistique (LOT 1-18) — points spécifiques

- **Géocodage (Nominatim)** : utilisé pour l'estimation de frais de livraison
  et le suivi client (ETA, LOT8). API publique gratuite, sans clé, mais avec
  une politique d'usage stricte (max 1 req/s) — throttlée en interne
  (`deliveryService.js`, LOT18) pour ne jamais risquer un blocage de l'IP du
  serveur, qui casserait le géocodage pour toute l'application. Rien à
  configurer, mais à savoir si le volume de commandes grossit beaucoup : la
  file d'attente est en mémoire de process, donc pas partagée entre plusieurs
  instances backend (passage à une instance unique tant que le volume reste
  modeste, ou prévoir une file partagée — Redis — sinon).
- **PlatformSettings logistique** : `deliveryAvgSpeedKmh` (20 km/h par
  défaut, LOT8), `gpsHistoryRetentionDays` (30 jours, LOT9),
  `deliveryMaxPrice`/catégories de véhicule (LOT4/6) sont des valeurs de
  démarrage raisonnables, pas des choix métier validés pour la Côte
  d'Ivoire réelle — à revoir avec l'équipe produit après le premier
  déploiement, via l'admin (Paramètres de la plateforme / Logistique).
- **Catalogue VehicleType** : s'auto-amorce avec 5 catégories par défaut
  (Vélo/Moto/Tricycle/Voiture/Camionnette) à la première consultation admin
  ou livreur — aucune action requise, mais à vérifier/ajuster une fois en
  production (`/admin` → Logistique → Véhicules).
- **Rétention GPS** : DriverLocationHistory est purgée automatiquement selon
  `gpsHistoryRetentionDays` — vérifier que cette durée est conforme à la
  politique de confidentialité affichée aux livreurs avant le lancement.
- **Tests E2E (LOT17)** : `cd e2e && npm test` lance le cycle de livraison
  complet dans un vrai navigateur (Playwright), contre une base SQLite
  dédiée (`backend/prisma/e2e.db`, jamais dev.db). À exécuter avant tout
  déploiement touchant au parcours livraison — c'est le seul test de ce
  projet qui fait réellement passer par le frontend, pas seulement par
  l'API.

## Checklist avant mise en production

- [ ] `DATABASE_URL` pointe vers PostgreSQL (pas SQLite)
- [ ] Migrations PostgreSQL appliquées (`prisma migrate deploy`), **pas** de seed lancé par erreur
- [ ] `JWT_SECRET` généré aléatoirement, différent de la valeur d'exemple
- [ ] `ALLOWED_ORIGINS` = domaine(s) frontend réel(s) uniquement
- [ ] `BASE_URL` défini si stockage disque local, ou Cloudinary configuré
- [ ] `NODE_ENV=production` défini côté backend
- [ ] `VITE_API_URL` défini au moment du build frontend (vérifier les logs CI)
- [ ] Panneau "comptes démo" absent du build frontend (automatique via `import.meta.env.DEV`, à vérifier visuellement une fois déployé)
- [ ] `GET /api/health` répond `{ ok: true, db: 'ok' }`
- [ ] Sauvegardes automatiques de la base PostgreSQL configurées côté hébergeur
- [ ] Valeurs de PlatformSettings logistique (vitesse moyenne ETA, rétention
      GPS, plafonds de frais par véhicule) revues avec l'équipe produit —
      les défauts sont des points de départ, pas des choix validés
- [ ] `cd e2e && npm test` passe contre le build à déployer
