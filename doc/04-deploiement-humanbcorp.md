# 04 — Déploiement sur humanbcorp.com (CI/CD + proxy mutualisé)

> **Runbook de référence.** Décrit exactement ce qu'on va exécuter pour mettre
> `humanbcorp.com` en production sur le VPS, branché sur le **reverse-proxy nginx
> mutualisé existant** (`backend-nginx-1`), avec **déploiement continu** déclenché
> par `git push main`.

## Suivi d'avancement

On avance phase par phase ; cocher au fur et à mesure (`[x]`).

| État | Phase | Acteur | Détail |
|:---:|-------|--------|--------|
| [x] | 0 — DNS | toi | ✅ propagé sur résolveurs publics (8.8.8.8 / 1.1.1.1 → 81.0.246.144) |
| [x] | 1 — Utilisateur `humanbcorp` | admin | ✅ créé, groupe docker OK (`docker ps` fonctionne) |
| [x] | 2 — Clé SSH CI | admin | ✅ paire dédiée, test `ssh humanbcorp@81.0.246.144` OK |
| [ ] | 3 — Config GitHub | toi | secrets SSH_* + variables DEPLOY_* |
| [x] | 4 — Dépôt stack + `.env` | humanbcorp | ✅ bundle `ok_serveur/` en place, `.env` renseigné |
| [x] | 5 — Premier `up -d` | humanbcorp | ✅ app démarrée, auth Postgres OK (voir `ok_serveur/correction-totale-bd.md`) |
| [ ] | 6 — Certificat TLS | admin | certbot mutualisé — voir `ok_serveur/nginx-central.md` |
| [ ] | 7 — HTTPS actif | admin | bloc :443 dans nginx central — voir `ok_serveur/nginx-central.md` |
| [ ] | 8 — Volume média | admin | montage dans nginx central |
| [ ] | 9 — Vérifications | — | `curl -I` + superuser |
| [ ] | ✔ CI/CD actif | — | `push main` = déploiement auto |

> Pré-requis transverse : le **commit des fichiers de déploiement** sur `main`
> (déclenche le premier build de l'image sur GHCR, indispensable à la phase 5).

## Architecture cible

Le VPS héberge déjà un **nginx central** qui détient les ports 80/443, termine le
TLS (Let's Encrypt mutualisé) et route chaque domaine vers le bon conteneur via le
réseau Docker partagé **`backend_default`** (afrikamode, edlearning, gathe-finance…).
On s'y branche **au lieu** d'embarquer notre propre nginx.

```
 git push main ─► GitHub Actions ─► build ─► ghcr.io/<owner>/<repo>:latest
                                                  │
                       (job deploy, SSH user "humanbcorp")
                       docker compose -f docker-compose.prod.yml pull && up -d
                                                  │
   Internet ─► nginx CENTRAL (:80/:443, TLS) ──[backend_default]──► humanbcorp_web:8000
      humanbcorp.com          │                                         │  (gunicorn + WhiteNoise)
                              └── /media/ ◄── volume humanbcorp_media_volume
                                                                        │
                                                              db (postgres:16, réseau privé)
```

- **Pas de nginx** dans notre stack, **aucun port** publié sur l'hôte.
- **Statiques** servis par **WhiteNoise** (dans gunicorn) — rien à monter dans le nginx central.
- **Médias** servis par le nginx central depuis le volume `humanbcorp_media_volume`.
- Service web nommé **`humanbcorp_web`** (unicité d'alias sur `backend_default` ; `web` est déjà pris par afrikamode).

## Fichiers du repo utilisés

| Fichier | Rôle |
|---------|------|
| `docker-compose.prod.yml` | Stack de prod (web + db), sans nginx, branché sur `backend_default`. |
| `deploy/nginx/humanbcorp.conf` | Bloc `server {}` à coller dans la config du nginx central. |
| `.env.example` | Modèle des variables de prod (durcissement HTTPS activé). |
| `.github/workflows/deploy.yml` | CI : build+push GHCR, puis job deploy SSH (si `DEPLOY_ENABLED=true`). |
| `ok_serveur/` | **Bundle prêt à copier sur le VPS** : `docker-compose.prod.yml`, `.env` (généré, non versionné), `humanbcorp-nginx.conf`, `README.md`. |

## Qui fait quoi

| Acteur | Périmètre |
|--------|-----------|
| **Admin (root/`deploy`)** | Créer l'utilisateur `humanbcorp`, éditer le nginx central, émettre le certificat, monter le volume média. |
| **Utilisateur `humanbcorp`** | Détenir le stack (`~/humanbcorp/`), le `.env`, recevoir les déploiements CI/CD. |
| **GitHub** | Secrets + variables Actions (accès SSH). |

---

## Étape 0 — DNS (préalable)
DNS géré chez **LWS** (`ns2x.lwsdns.com`). Au départ, `humanbcorp.com` pointait vers
`91.216.107.201` (parking LWS) au lieu du VPS. **Correction (voie A) :** dans l'espace
client LWS → Zone DNS de `humanbcorp.com` :
- **A** `humanbcorp.com` → **`81.0.246.144`** (IP du VPS)
- **A** `www` → `81.0.246.144` (ou **CNAME** `www` → `humanbcorp.com`)

Vérifier après propagation (TTL ~2 h) : `dig +short humanbcorp.com` doit renvoyer `81.0.246.144`.
Les phases 1→5 peuvent avancer **en parallèle** de la propagation ; les phases 6→7 (TLS)
attendent que le DNS résolve vers le VPS.

## Étape 1 — Créer l'utilisateur de déploiement `humanbcorp` *(admin, root)*
```bash
adduser --disabled-password --gecos "" humanbcorp
usermod -aG docker humanbcorp                 # droit de lancer docker sans sudo (requis par la CI)
mkdir -p /home/humanbcorp/humanbcorp          # dossier du stack (= DEPLOY_PATH)
chown -R humanbcorp:humanbcorp /home/humanbcorp
```

## Étape 2 — Clé SSH dédiée à la CI *(admin)*
Générer une paire **dédiée au déploiement** (ne pas réutiliser une clé perso) :
```bash
ssh-keygen -t ed25519 -C "ci-humanbcorp" -f /tmp/humanbcorp_ci -N ""
# clé publique -> autorisée pour l'utilisateur humanbcorp
mkdir -p /home/humanbcorp/.ssh && chmod 700 /home/humanbcorp/.ssh
cat /tmp/humanbcorp_ci.pub >> /home/humanbcorp/.ssh/authorized_keys
chmod 600 /home/humanbcorp/.ssh/authorized_keys
chown -R humanbcorp:humanbcorp /home/humanbcorp/.ssh
cat /tmp/humanbcorp_ci        # <-- contenu à copier dans le secret GitHub SSH_KEY
rm /tmp/humanbcorp_ci /tmp/humanbcorp_ci.pub
```

## Étape 3 — Config GitHub *(Settings → Secrets and variables → Actions)*
**Secrets :**
| Nom | Valeur |
|-----|--------|
| `SSH_HOST` | IP / domaine du VPS |
| `SSH_USER` | `humanbcorp` |
| `SSH_KEY` | contenu de la **clé privée** générée à l'étape 2 |
| `SSH_PORT` | *(optionnel, si ≠ 22)* |

**Variables :**
| Nom | Valeur |
|-----|--------|
| `DEPLOY_ENABLED` | `true` |
| `DEPLOY_PATH` | `/home/humanbcorp/humanbcorp` |

> `GITHUB_TOKEN` est automatique. **Choix retenu : package GHCR public** → aucun
> `docker login` requis (ni serveur, ni CI). Le rendre public : GitHub → Packages →
> `humanbcorp` → *Package settings* → *Change visibility* → *Public*.

## Étape 4 — Déposer le stack + `.env` *(utilisateur `humanbcorp`)*
```bash
cd /home/humanbcorp/humanbcorp
# y copier depuis le repo : docker-compose.prod.yml
cp .env.example .env    # (ou créer .env à partir du modèle)
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # générer SECRET_KEY
nano .env               # renseigner SECRET_KEY, POSTGRES_PASSWORD, WEB_IMAGE, EMAIL_*, GOOGLE_* si besoin
```
`.env` de prod — valeurs clés :
- `SECRET_KEY` = valeur aléatoire générée · `DEBUG=False`
- `ALLOWED_HOSTS=humanbcorp.com,www.humanbcorp.com`
- `CSRF_TRUSTED_ORIGINS=https://humanbcorp.com,https://www.humanbcorp.com`
- `POSTGRES_DB/USER/PASSWORD` (mot de passe fort)
- `WEB_IMAGE=ghcr.io/edwintchakounte/humanbcorp:latest` (dépôt `EdwinTchakounte/humanbcorp`)
- `SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS=31536000`

## Étape 5 — Premier démarrage du stack *(utilisateur `humanbcorp`)*
> L'image doit déjà exister sur GHCR → faire un `push` sur `main` au moins une fois.
```bash
cd /home/humanbcorp/humanbcorp
# package GHCR public -> aucun docker login nécessaire
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d       # crée humanbcorp_media_volume, démarre web+db
docker compose -f docker-compose.prod.yml logs -f humanbcorp_web   # migrate + collectstatic + gunicorn
```
À ce stade l'app tourne sur `backend_default` mais n'est pas encore routée (étapes 6-7).

## Étape 6 — Certificat TLS *(admin)*
Ajouter **d'abord uniquement le bloc port 80** de `deploy/nginx/humanbcorp.conf` dans
`/home/deploy/afrikamode/backend/deploy/nginx/default.conf`, puis :
```bash
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
# émettre le cert via le certbot mutualisé (conteneur backend-certbot-1, déjà en service) :
docker exec backend-certbot-1 certbot certonly --webroot -w /var/www/certbot \
  -d humanbcorp.com -d www.humanbcorp.com
```

## Étape 7 — Activer le HTTPS *(admin)*
Ajouter le **bloc 443** de `humanbcorp.conf`, puis :
```bash
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
```

## Étape 8 — Servir les médias *(admin)*
Dans `/home/deploy/afrikamode/backend/docker-compose.prod.yml`, service `nginx` :
```yaml
    volumes:
      # ... montages existants ...
      - humanbcorp_media:/app/mediafiles-humanbcorp:ro
# et en bas du fichier :
volumes:
  humanbcorp_media:
    external: true
    name: humanbcorp_media_volume
```
```bash
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml up -d nginx
```

## Étape 9 — Vérifications
```bash
curl -I https://humanbcorp.com/                # 200
# superutilisateur Django :
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml exec humanbcorp_web python manage.py createsuperuser
```

---

## CI/CD en régime établi
Après les étapes ci-dessus, **chaque `push` sur `main`** :
1. build l'image et la pousse sur GHCR ;
2. SSH sur le VPS (user `humanbcorp`) et exécute
   `docker compose -f docker-compose.prod.yml pull && up -d` → migrations +
   collectstatic + redémarrage gunicorn automatiques (via `entrypoint.sh`).

## Exploitation
```bash
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml logs -f humanbcorp_web   # logs
docker compose -f docker-compose.prod.yml restart humanbcorp_web   # redémarrer
docker compose -f docker-compose.prod.yml pull && \
  docker compose -f docker-compose.prod.yml up -d                  # MAJ manuelle
```
**Rollback** : `WEB_IMAGE=ghcr.io/<owner>/<repo>:sha-XXXXXXX` (tag court par commit) dans `.env`, puis `up -d`.

## ⚠️ Sécurité — secrets historiques à révoquer
Les secrets « Algomaat » committés autrefois dans `.env` (SECRET_KEY, Google OAuth,
mot de passe d'application Gmail) doivent être **révoqués et régénérés**. Le `.env` de
production ne doit jamais être committé (couvert par `.gitignore`).

## Renouvellement TLS
Le certbot mutualisé du stack `backend` gère le renouvellement pour tous les domaines,
`humanbcorp.com` inclus une fois le certificat émis (étape 6).
```
