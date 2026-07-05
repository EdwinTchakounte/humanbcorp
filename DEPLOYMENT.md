# Déploiement — ALGOMAAT

Chaîne : **GitHub Actions build l'image Docker → push sur GHCR → le serveur pull l'image** via `docker-compose.yml`.

```
 git push main ──► GitHub Actions ──► ghcr.io/fokamfekam/algomaat:latest
                                              │
                                     (serveur) docker compose pull && up -d
                                              │
                              ┌───────────────┼───────────────┐
                            nginx            web (gunicorn)    db (postgres)
```

---

## 1. CI — build & push (automatique)

Le workflow `.github/workflows/deploy.yml` se déclenche à chaque push sur `main` (ou tag `v*`) :
il construit l'image et la pousse sur **GHCR** avec les tags `latest` et `sha-<court>`.

Aucun secret à créer pour cette partie : `GITHUB_TOKEN` (fourni automatiquement) suffit,
le workflow a la permission `packages: write`.

Après le premier push, rendre le package lisible pour le pull serveur :
- soit garder le package **privé** et utiliser un token pour se logger sur le serveur (voir §2) ;
- soit le passer **public** : GitHub → repo → *Packages* → `algomaat` → *Package settings* → *Change visibility*.

---

## 2. Préparation du serveur (une seule fois)

Prérequis : Docker + plugin Compose (`docker compose version`).

```bash
mkdir -p ~/algomaat/nginx && cd ~/algomaat
```

Copier sur le serveur uniquement ces 3 fichiers depuis le repo :
`docker-compose.yml`, `nginx/default.conf`, `.env.example`.

```bash
cp .env.example .env
nano .env          # remplir SECRET_KEY, ALLOWED_HOSTS, POSTGRES_*, etc.
```

Générer un `SECRET_KEY` :
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Se connecter à GHCR (si le package est privé) — utiliser un
[Personal Access Token](https://github.com/settings/tokens) avec le scope `read:packages` :
```bash
echo "<PAT>" | docker login ghcr.io -u <votre-user-github> --password-stdin
```

---

## 3. Lancer / mettre à jour

```bash
cd ~/algomaat
docker compose pull        # récupère la dernière image depuis GHCR
docker compose up -d       # démarre db + web + nginx
docker compose logs -f web # suivre migrate/collectstatic/gunicorn
```

Au démarrage, le conteneur `web` attend Postgres, applique les **migrations**,
lance **collectstatic**, puis Gunicorn. L'app est servie par Nginx sur le **port 80**.

### Créer un superutilisateur
```bash
docker compose exec web python manage.py createsuperuser
```

### Mettre à jour vers une nouvelle version
```bash
docker compose pull && docker compose up -d
```

---

## 4. Déploiement continu automatique (optionnel)

Le job `deploy` du workflow peut faire le `pull && up -d` sur le serveur par SSH.
Pour l'activer :

1. Repo → *Settings* → *Secrets and variables* → *Actions*
   - **Variable** `DEPLOY_ENABLED` = `true` (et éventuellement `DEPLOY_PATH` = `~/algomaat`)
   - **Secrets** : `SSH_HOST`, `SSH_USER`, `SSH_KEY` (clé privée), `SSH_PORT` (optionnel)
2. Le serveur doit déjà avoir le dossier `~/algomaat` configuré (§2).

---

## 5. HTTPS (recommandé)

Placer un reverse-proxy TLS devant Nginx (Caddy, Traefik, ou Certbot sur l'hôte),
puis dans `.env` : `SECURE_SSL_REDIRECT=True` et `SECURE_HSTS_SECONDS=31536000`.

---

## 6. Sauvegardes base de données

```bash
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F).sql
```

---

## ⚠️ Sécurité — à faire absolument

Les secrets suivants ont été **commités en clair** dans l'historique git (`.env`) et
doivent être **révoqués/régénérés** :
- `SECRET_KEY` Django (déjà régénéré via `.env` — l'ancien ne doit plus servir)
- **Google OAuth** `GOOGLE_CLIENT_SECRET` → régénérer dans Google Cloud Console
- **Mot de passe applicatif Gmail** `EMAIL_HOST_PASSWORD` → révoquer et recréer

Le fichier `.env` est désormais retiré du suivi git et ignoré (`.gitignore`).
