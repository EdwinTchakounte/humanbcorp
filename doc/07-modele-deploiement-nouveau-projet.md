# Modèle de déploiement — nouveau projet sur le VPS mutualisé

> **But : gagner du temps.** Ce document décrit l'**infrastructure partagée déjà en place**
> sur le serveur, puis donne une **checklist + des blocs prêts à copier** pour brancher
> un nouveau site en quelques minutes. Générique : remplace les variables `<...>`.
>
> Convention retenue : **1 stack Docker par projet**, **aucun nginx** dans le stack,
> on se branche sur le **reverse-proxy nginx central** partagé par tous les sites.

---

## 0. Variables du projet (à définir une fois)

```bash
PROJET=<mon-projet>                    # ex: monsite         (slug court, alias Docker)
DOMAINE=<mondomaine.com>               # ex: mondomaine.com
IMAGE=ghcr.io/<owner>/<repo>:latest    # image applicative sur GHCR
DEPLOY_USER=<mon-projet>               # user Linux propriétaire du stack
DEPLOY_PATH=/home/$DEPLOY_USER/$PROJET # dossier du stack sur le VPS
```

> Règle d'alias : le service web doit avoir un **nom unique** sur le réseau partagé
> (ex. `${PROJET}_web`) — ne jamais réutiliser `web` (déjà pris).

---

## 1. Infrastructure PARTAGÉE déjà en place (ne rien recréer)

C'est le socle commun à tous les sites du VPS. **On s'y branche, on ne le duplique pas.**

| Élément | Valeur sur ce serveur |
|---|---|
| **IP du VPS** | `81.0.246.144` |
| **Reverse-proxy** | conteneur **`backend-nginx-1`** (détient `:80` et `:443`, termine le TLS) |
| **Fichier de conf UNIQUE (bind-monté)** | `/home/deploy/afrikamode/backend/deploy/nginx/default.conf` |
| **⚠️ Règle d'or** | tous les sites vivent dans CE fichier → on **append** un `server{}`, on ne crée pas de fichier à côté |
| **Compose du proxy** | `/home/deploy/afrikamode/backend/docker-compose.prod.yml` |
| **Réseau Docker partagé** | **`backend_default`** (externe) — le proxy y route vers chaque app |
| **Webroot ACME (certbot)** | `/var/www/certbot` |
| **Certificats** | `/etc/letsencrypt/live/<domaine>/` |
| **Conteneur certbot** | **`backend-certbot-1`** (émission + renouvellement auto, tous domaines) |
| **Admin de ce socle** | user **root / `deploy`** |

### Reconnaissance rapide (à lancer avant de commencer, en root — ne rien supposer)
```bash
# Montages réels du nginx central (confirme conf.d / webroot / letsencrypt)
docker inspect backend-nginx-1 --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'

# Comment les sites existants sont déclarés
docker exec backend-nginx-1 sh -c 'nginx -T 2>/dev/null | grep server_name'

# Nom exact du certbot
docker ps --filter name=certbot --format '{{.Names}}'
```

---

## 2. DNS (préalable, chez le registrar)

- **A** `<DOMAINE>` → `81.0.246.144`
- **A** `www` → `81.0.246.144` (ou **CNAME** `www` → `<DOMAINE>`)
- Vérifier après propagation : `dig +short <DOMAINE>` = `81.0.246.144`

> Les étapes 3→5 avancent en parallèle de la propagation ; le TLS (étape 7) attend le DNS.

---

## 3. Créer l'utilisateur de déploiement *(admin, root)*

```bash
adduser --disabled-password --gecos "" $DEPLOY_USER
usermod -aG docker $DEPLOY_USER               # lancer docker sans sudo (requis par la CI)
mkdir -p $DEPLOY_PATH
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER
```

### Clé SSH dédiée à la CI (ne jamais réutiliser une clé perso)
```bash
ssh-keygen -t ed25519 -C "ci-$PROJET" -f /tmp/${PROJET}_ci -N ""
mkdir -p /home/$DEPLOY_USER/.ssh && chmod 700 /home/$DEPLOY_USER/.ssh
cat /tmp/${PROJET}_ci.pub >> /home/$DEPLOY_USER/.ssh/authorized_keys
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
cat /tmp/${PROJET}_ci            # <-- clé PRIVÉE à coller dans le secret GitHub SSH_KEY
rm /tmp/${PROJET}_ci /tmp/${PROJET}_ci.pub
```

---

## 4. `docker-compose.prod.yml` du projet *(template)*

Déposer dans `$DEPLOY_PATH`. **Pas de nginx, aucun port publié.**

```yaml
services:
  ${PROJET}_db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  ${PROJET}_web:
    image: ${WEB_IMAGE}
    container_name: ${PROJET}_web
    restart: unless-stopped
    env_file: [.env]
    environment:
      POSTGRES_HOST: ${PROJET}_db
      POSTGRES_PORT: 5432
    volumes:
      - media_volume:/app/mediafiles        # médias, servis par le nginx central
    networks: [internal, proxy]
    depends_on:
      ${PROJET}_db:
        condition: service_healthy
    expose: ["8000"]

networks:
  internal:
  proxy:
    external: true
    name: backend_default                   # réseau partagé du nginx central

volumes:
  pgdata:
  media_volume:
```

> Statiques → **WhiteNoise** (dans gunicorn), rien à monter. Médias → volume ci-dessus.

### `.env` de prod (non versionné, jamais committé)
```bash
cd $DEPLOY_PATH
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # -> SECRET_KEY
cat > .env <<EOF
SECRET_KEY=<valeur générée>
DEBUG=False
ALLOWED_HOSTS=$DOMAINE,www.$DOMAINE
CSRF_TRUSTED_ORIGINS=https://$DOMAINE,https://www.$DOMAINE
POSTGRES_DB=$PROJET
POSTGRES_USER=$PROJET
POSTGRES_PASSWORD=$(openssl rand -hex 24)     # 100% alphanumérique = rien à échapper
WEB_IMAGE=$IMAGE
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
EOF
```

---

## 5. Premier démarrage *(user $DEPLOY_USER)*

> L'image doit déjà exister sur GHCR (au moins un `push main`). Package **public** → pas de `docker login`.
```bash
cd $DEPLOY_PATH
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f ${PROJET}_web   # migrate + collectstatic + gunicorn
```
Attendu : *Database is up* → *Applying migrations… OK* → **Listening at 0.0.0.0:8000**.

### Vérifier que le proxy joint bien l'app
```bash
docker network inspect backend_default --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' | grep $PROJET
docker exec backend-nginx-1 sh -c "wget -qO- --timeout=4 http://${PROJET}_web:8000/ 2>&1 | head -c 120; echo"
```

---

## 6. Bloc nginx — routage + HTTPS *(admin, root)*

```bash
CONF=/home/deploy/afrikamode/backend/deploy/nginx/default.conf
cp "$CONF" "$CONF.bak"           # TOUJOURS sauvegarder (plusieurs sites dedans !)
```

### 6a. Bloc port 80 (pour le challenge ACME + redirection HTTPS)
```bash
cat >> "$CONF" <<EOF

# ===================== $DOMAINE =====================
server {
    listen 80; listen [::]:80;
    server_name $DOMAINE www.$DOMAINE;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
# si nginx -t échoue :  cp "$CONF.bak" "$CONF"  puis recharger
```

### 6b. Émettre le certificat
```bash
docker exec backend-certbot-1 certbot certonly --webroot -w /var/www/certbot \
  -d $DOMAINE -d www.$DOMAINE
# -> "Successfully received certificate" dans /etc/letsencrypt/live/$DOMAINE/
```

### 6c. Bloc port 443 (proxy vers l'app)
```bash
cat >> "$CONF" <<EOF

server {
    listen 443 ssl; listen [::]:443 ssl;
    server_name $DOMAINE www.$DOMAINE;

    ssl_certificate     /etc/letsencrypt/live/$DOMAINE/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAINE/privkey.pem;
    client_max_body_size 25M;

    location /media/ {
        alias /app/mediafiles-$PROJET/;      # nécessite le montage du volume média (étape 7)
        access_log off; expires 30d;
    }
    location / {
        proxy_pass http://${PROJET}_web:8000;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }
}
EOF
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
```

---

## 7. Servir les médias *(admin — optionnel, si uploads)*

Monter le volume média du projet **en lecture seule** dans le nginx central.
Éditer le compose du proxy (`/home/deploy/afrikamode/backend/docker-compose.prod.yml`), service `nginx` :
```yaml
    volumes:
      # ... montages existants ...
      - ${PROJET}_media:/app/mediafiles-${PROJET}:ro
volumes:
  ${PROJET}_media:
    external: true
    name: ${PROJET}_media_volume      # nom réel du volume créé par le stack au 1er up
```
```bash
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml up -d nginx
```
> Sans ce montage, `/media/` renvoie 404 mais le reste du site (dont `/static/` WhiteNoise) marche.

---

## 8. CI/CD GitHub Actions *(dépôt du projet)*

**Secrets** : `SSH_HOST=81.0.246.144` · `SSH_USER=$DEPLOY_USER` · `SSH_KEY=<clé privée CI>` · `SSH_PORT` (si ≠22)
**Variables** : `DEPLOY_ENABLED=true` · `DEPLOY_PATH=/home/$DEPLOY_USER/$PROJET`

Rendre le package GHCR **public** (GitHub → Packages → *Package settings* → *Change visibility* → Public)
→ aucun `docker login` ni côté serveur, ni côté CI.

En régime établi, chaque `push main` : build → push GHCR → SSH → `pull && up -d`
(migrations + collectstatic + gunicorn via `entrypoint.sh`).

---

## 9. Vérifications finales
```bash
curl -I  http://$DOMAINE/     # 301 -> https
curl -I https://$DOMAINE/     # 200 (certificat valide)
cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml exec ${PROJET}_web python manage.py createsuperuser
```

---

## 10. Exploitation & rollback (mémo)
```bash
cd $DEPLOY_PATH
docker compose -f docker-compose.prod.yml logs -f ${PROJET}_web   # logs
docker compose -f docker-compose.prod.yml restart ${PROJET}_web   # redémarrer
docker compose -f docker-compose.prod.yml pull && up -d           # MAJ manuelle
# Rollback : WEB_IMAGE=ghcr.io/<owner>/<repo>:sha-XXXXXXX dans .env, puis up -d
```

---

## Checklist express

- [ ] DNS `<DOMAINE>` + `www` → `81.0.246.144`
- [ ] User `$DEPLOY_USER` (+ groupe docker) + clé SSH CI
- [ ] `$DEPLOY_PATH` : `docker-compose.prod.yml` + `.env` (jamais committé)
- [ ] Image poussée sur GHCR (public) + secrets/variables GitHub
- [ ] `up -d` → app sur `backend_default`, joignable par le proxy
- [ ] Bloc :80 + cert certbot + bloc :443 dans `default.conf` (après `cp .bak`)
- [ ] (option) volume média monté dans le nginx central
- [ ] `curl -I https://<DOMAINE>` = 200 + superuser créé

## Pièges à éviter
1. **Nom de service unique** (`${PROJET}_web`, jamais `web`) sur `backend_default`.
2. **Toujours `cp "$CONF" "$CONF.bak"`** avant d'éditer le `default.conf` partagé (plusieurs prods dedans).
3. **`nginx -t` avant chaque `reload`** ; en cas d'échec, restaurer le `.bak`.
4. **Mot de passe Postgres alphanumérique** (`openssl rand -hex 24`) → rien à échapper dans l'URL.
5. **`.env` jamais committé** ; révoquer tout secret déjà exposé.
6. **Aucun port publié** par le stack : tout passe par le proxy via `backend_default`.
```
