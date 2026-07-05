# Côté nginx central — les points à mettre à jour (récap)

Tout se joue sur le nginx mutualisé `backend-nginx-1`. Chemins confirmés sur ce
serveur :

| Élément | Chemin / valeur |
|--------|-----------------|
| Fichier de conf (unique, bind-monté) | `/home/deploy/afrikamode/backend/deploy/nginx/default.conf` |
| Webroot ACME | `/var/www/certbot` |
| Certificats Let's Encrypt | `/etc/letsencrypt` |
| Conteneur nginx | `backend-nginx-1` |
| Conteneur certbot | `backend-certbot-1` |
| Compose du stack backend | `/home/deploy/afrikamode/backend/docker-compose.prod.yml` |
| Cible du proxy | `http://humanbcorp_web:8000` (réseau `backend_default`) |

> ⚠️ `default.conf` contient déjà **4 sites en prod**. Toujours **sauvegarder**
> (`cp "$CONF" "$CONF.bak"`) et **`nginx -t` avant `reload`**.

---

## Les 4 points à update

### Point 1 — Bloc HTTP `:80` (ACME + redirection HTTPS)
**Où :** ajouter en fin de `default.conf`.
**Quoi :** `server { listen 80; server_name humanbcorp.com www.humanbcorp.com; ... }`
avec `location /.well-known/acme-challenge/ { root /var/www/certbot; }` et
`location / { return 301 https://$host$request_uri; }`.
**But :** permettre le challenge certbot + forcer HTTPS.
→ `nginx -t` puis `nginx -s reload`.

### Point 2 — Émission du certificat TLS
**Où :** conteneur `backend-certbot-1`.
**Quoi :**
```
docker exec backend-certbot-1 certbot certonly --webroot -w /var/www/certbot \
  -d humanbcorp.com -d www.humanbcorp.com
```
**But :** créer `/etc/letsencrypt/live/humanbcorp.com/{fullchain,privkey}.pem`.
**Pré-requis :** `dig +short humanbcorp.com` = `81.0.246.144` (OK) + point 1 rechargé.

### Point 3 — Bloc HTTPS `:443` (le routage réel)
**Où :** ajouter en fin de `default.conf`.
**Quoi :** `server { listen 443 ssl; server_name humanbcorp.com www.humanbcorp.com;`
- `ssl_certificate` / `ssl_certificate_key` → `/etc/letsencrypt/live/humanbcorp.com/…`
- `client_max_body_size 25M;`
- `location /media/ { alias /app/mediafiles-humanbcorp/; }` (dépend du point 4)
- `location / { proxy_pass http://humanbcorp_web:8000; ` + headers
  `Host / X-Real-IP / X-Forwarded-For / X-Forwarded-Proto`.
**But :** servir le site en HTTPS. `/static/` est géré par WhiteNoise (rien à monter).
→ `nginx -t` puis `nginx -s reload`.

### Point 4 — Monter le volume média dans le nginx central *(optionnel, pour `/media/`)*
**Où :** service `nginx` de `/home/deploy/afrikamode/backend/docker-compose.prod.yml`.
**Quoi :**
```yaml
services:
  nginx:
    volumes:
      # ... montages existants ...
      - humanbcorp_media:/app/mediafiles-humanbcorp:ro
volumes:
  humanbcorp_media:
    external: true
    name: humanbcorp_media_volume
```
puis `docker compose -f .../docker-compose.prod.yml up -d nginx`.
**But :** que `location /media/` serve les fichiers uploadés. Tant que non fait,
`/media/…` renvoie 404 mais le reste du site marche.

---

## Ce qu'il ne faut PAS toucher
- Les 4 `server {}` existants (afrikamode, api-assistant-ia, edlearning, gathe-finance).
- Les ports 80/443 (déjà détenus par `backend-nginx-1`).
- Le renouvellement TLS : géré automatiquement par le certbot mutualisé une fois le
  certificat émis (point 2) — rien à ajouter.

## Ordre d'exécution
Point 1 → Point 2 → Point 3 → (Point 4 si besoin de `/media/`) → `curl -I https://humanbcorp.com/`.

Détails commande par commande : voir `ok_serveur/nginx-central.md`.
