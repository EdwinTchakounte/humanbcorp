# État complet du serveur — cartographie de déploiement

> Instantané documentaire au **2026-07-07**. Vue d'ensemble du VPS, du reverse-proxy
> mutualisé, des réseaux/volumes Docker, des conteneurs, des certificats et de la
> CI/CD — pour piloter le déploiement de `humanbcorp.com` (et la future bascule 3 sous-domaines).
> Sources : `ok_serveur/*.md`, `doc/04-deploiement-humanbcorp.md`, `docker-compose.prod.yml`, `deploy/nginx/`.

---

## 1. Le VPS

| Élément | Valeur |
|---|---|
| **IP publique** | `81.0.246.144` |
| **DNS `humanbcorp.com` / `www`** | → `81.0.246.144` (géré chez **LWS**, `ns2x.lwsdns.com`) ✅ propagé |
| **Ports publics** | `80` + `443` détenus par le **nginx central** (aucun autre port exposé) |
| **Multi-tenant** | héberge plusieurs apps : afrikamode, edlearning, gathe-finance… **+ humanbcorp** |

### Utilisateurs
| User | Rôle |
|---|---|
| **root / `deploy`** | admin du nginx central, certbot, création users, montages volumes |
| **`humanbcorp`** | propriétaire du stack applicatif — SSH **par clé uniquement** (pas de mot de passe) |

---

## 2. Où est nginx (le point central)

**Il n'y a PAS de nginx dans notre stack.** Le VPS possède **un reverse-proxy nginx mutualisé**
partagé par tous les sites : c'est **lui** qui termine le TLS et route chaque domaine.

| Quoi | Où |
|---|---|
| **Conteneur** | `backend-nginx-1` (détient `:80` et `:443`) |
| **Fichier de conf (UNIQUE, bind-monté)** | `/home/deploy/afrikamode/backend/deploy/nginx/default.conf` |
| **⚠️ Règle d'or** | on **édite CE fichier** (append d'un `server{}`) — créer un fichier à côté ne sert à rien, seul `default.conf` est monté |
| **Compose du proxy** | `/home/deploy/afrikamode/backend/docker-compose.prod.yml` |
| **Webroot ACME** | `/var/www/certbot` |
| **Certificats** | `/etc/letsencrypt/live/<domaine>/` |
| **Conteneur certbot** | `backend-certbot-1` (renouvellement auto, tous domaines) |

> Sauvegarder **toujours** avant d'éditer : `cp "$CONF" "$CONF.bak"` (4 sites vivent dans ce fichier).
> Recharger : `docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload`.

---

## 3. Réseaux Docker

| Réseau | Type | Rôle |
|---|---|---|
| **`backend_default`** | externe, partagé | Le nginx central y route vers chaque app. Notre `humanbcorp_web` **doit** y être (alias `proxy` dans le compose). |
| **`internal`** | privé (par stack) | Django ⇄ PostgreSQL. **Jamais exposé** au proxy. |

> Contrainte d'alias : le service web s'appelle **`humanbcorp_web`** (et non `web`, déjà pris par afrikamode)
> pour éviter toute collision sur `backend_default`.

---

## 4. Volumes Docker

| Volume | Monté dans | Contenu |
|---|---|---|
| **`humanbcorp_pgdata`** (`pgdata`) | `humanbcorp_db:/var/lib/postgresql/data` | Base PostgreSQL |
| **`humanbcorp_media_volume`** (`media_volume`) | `humanbcorp_web:/app/mediafiles` **et** (à monter) nginx central en `:ro` | Médias uploadés |

> Les **statiques** ne sont **pas** un volume : servis par **WhiteNoise** dans gunicorn.
> Les **médias** sont servis par le nginx central via un montage `humanbcorp_media_volume:/app/mediafiles-humanbcorp:ro`.

---

## 5. Le stack applicatif (chez l'user `humanbcorp`)

Emplacement : **`/home/humanbcorp/humanbcorp/`** — contient `docker-compose.prod.yml` + `.env` (non versionné).

```
Internet ─► nginx CENTRAL (:80/:443, TLS)
                 │  [réseau backend_default]
                 ├─ humanbcorp.com ──────────► humanbcorp_web:8000   (gunicorn + WhiteNoise)
                 │                                   │  [réseau internal]
                 │                                   └─► humanbcorp_db (postgres:16-alpine)
                 └─ /media/ ◄── volume humanbcorp_media_volume
```

| Service | Image | Réseaux | Exposé |
|---|---|---|---|
| `humanbcorp_web` | `ghcr.io/edwintchakounte/humanbcorp:latest` | internal + proxy | `expose 8000` (pas de port hôte) |
| `humanbcorp_db` | `postgres:16-alpine` | internal | aucun (isolé) |

**Exploitation** (depuis `/home/humanbcorp/humanbcorp/`) :
```bash
docker compose -f docker-compose.prod.yml logs -f humanbcorp_web   # logs
docker compose -f docker-compose.prod.yml pull && up -d            # MAJ manuelle
docker compose -f docker-compose.prod.yml restart humanbcorp_web   # redémarrer
```

---

## 6. CI/CD (GitHub Actions)

`git push main` → build image → push GHCR → SSH sur le VPS (user `humanbcorp`) → `pull && up -d`
(migrations + collectstatic + gunicorn via `entrypoint.sh`).

| GitHub secret | Valeur |
|---|---|
| `SSH_HOST` | `81.0.246.144` · `SSH_USER` = `humanbcorp` · `SSH_KEY` = clé privée CI dédiée |
| **Variables** | `DEPLOY_ENABLED=true` · `DEPLOY_PATH=/home/humanbcorp/humanbcorp` |

- Package GHCR **public** → aucun `docker login` requis (ni serveur, ni CI).
- **Rollback** : `WEB_IMAGE=ghcr.io/edwintchakounte/humanbcorp:sha-XXXXXXX` dans `.env`, puis `up -d`.
- ⚠️ Le contexte de build CI pointe désormais sur **`./backend`** (après restructuration monorepo).

---

## 7. Certificats TLS

- Émis pour **`humanbcorp.com` + `www.humanbcorp.com`**, expire **2026-10-03**, renouvellement auto par `backend-certbot-1`.
- Restent à émettre pour la cible 3 sous-domaines : **`api.`** et **`dashboard.`**.

---

## 8. État d'avancement du déploiement (mono-domaine actuel)

| État | Phase | Détail |
|:---:|---|---|
| ✅ | 0 — DNS | propagé → `81.0.246.144` |
| ✅ | 1 — User `humanbcorp` | créé, groupe docker OK |
| ✅ | 2 — Clé SSH CI | paire dédiée, SSH OK |
| ⬜ | 3 — Secrets GitHub | `SSH_*` + `DEPLOY_*` à saisir |
| ✅ | 4 — Stack + `.env` | en place, `.env` renseigné |
| ✅ | 5 — Premier `up -d` | app démarrée, auth Postgres OK |
| ✅ | 6 — Certificat TLS | émis (root+www) |
| ⬜ | 7 — HTTPS actif | bloc `:443` à ajouter dans `default.conf` → voir `ok_serveur/nginx-central.md` |
| ⬜ | 8 — Volume média | montage `humanbcorp_media_volume` dans le nginx central |
| ⬜ | 9 — Vérifs | `curl -I https://humanbcorp.com/` + superuser |

> Reste, côté mono-domaine : **activer le :443** (7), **monter les médias** (8), **vérifier** (9).

---

## 9. Cible à venir — décentralisation 3 sous-domaines (Phase 4 du plan)

Le code est passé en **stack découplée** (`backend/` + `web/` + `dashboard/`) mais le serveur
tourne encore en **mono-conteneur Django**. Pour la cible :

| Sous-domaine | Conteneur cible | Image à builder |
|---|---|---|
| `api.humanbcorp.com` | `humanbcorp_web:8000` (Django DRF) | déjà là (contexte `./backend`) |
| `humanbcorp.com` | `humanbcorp_site:3000` (Next vitrine) | **à créer** |
| `dashboard.humanbcorp.com` | `humanbcorp_dashboard:3000` (Next CMS) | **à créer** |

Restera à : builder **3 images** GHCR (matrix CI), ajouter **3 services** au `docker-compose.prod.yml`,
ajouter **3 blocs `server{}`** dans `default.conf`, émettre les **certs `api.` + `dashboard.`**.

---

## 10. Aide-mémoire des fiches `ok_serveur/`

| Fiche | Sujet |
|---|---|
| `nginx-central.md` | découvrir la conf réelle du proxy + ajouter blocs 80/443 + émettre cert |
| `nginx-edition-default-conf.md` | édition sûre du `default.conf` partagé |
| `base-dediee.md` | base Postgres dédiée/vierge + test d'auth définitif |
| `correction-totale-bd.md` / `appliquer-fix-db.md` / `reset-db.md` | résolution des soucis d'auth Postgres |
| `fix-orphelin-volume.md` | volumes orphelins |
| `connexion-login.md` | diagnostic login (CSRF, `.env`, superuser) |
| `a-lancer-serveur.md` / `tout-en-un.md` / `commandes.md` | séquences de démarrage |
| `refonte-phase0-restructure.md` | restructuration monorepo |
```
