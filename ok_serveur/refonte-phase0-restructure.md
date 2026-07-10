# Phase 0 — Restructuration du dépôt (backend/ + web/ + dashboard/)

## Ce qui change dans le dépôt
Le projet Django a été déplacé de la racine vers **`backend/`**. Ajout à venir de
`web/` (vitrine Next.js) et `dashboard/` (CMS Next.js).

- `backend/` : tout le code Django (Algomaat/, apps, manage.py, Dockerfile, entrypoint.sh, requirements.txt).
- Racine : `docker-compose.prod.yml`, `docker-compose.yml`, `deploy/`, `nginx/`, `ok_serveur/`, `doc/`, images sources.
- CI `.github/workflows/deploy.yml` : le build pointe désormais sur `context: ./backend`.

## Impact serveur : AUCUN dans l'immédiat
Le `docker-compose.prod.yml` tire l'image GHCR `${WEB_IMAGE}` (il ne **build** pas).
L'image produite par la CI a le **même contenu** qu'avant (mêmes fichiers Django), donc
le comportement runtime est identique. Les images sources (`images_t1/`, `images_t2/`,
`logos/`, `ressources/`) ne sont plus embarquées dans l'image → image plus légère.

**=> Rien à faire côté serveur pour la Phase 0.** Le prochain déploiement automatique
(push sur `main`) reconstruira l'image depuis `./backend` et la publiera comme d'habitude.

## Vérification (déjà faite en local)
- `docker build ./backend` : image construite OK.
- `cd backend && python manage.py check` : OK (warnings préexistants seulement).

## À venir (prochaines phases, impact serveur réel)
- Phase 4 : 3 images GHCR (backend, web, dashboard), nouveaux services dans
  `docker-compose.prod.yml`, 3 blocs nginx (`api.` / racine / `dashboard.`) + certbot.
  Une fiche `ok_serveur/refonte-phase4-*.md` détaillera les commandes exactes.
