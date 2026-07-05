# Édition du `default.conf` du nginx central — commandes exactes

Toutes les modifs se font dans **un seul fichier** bind-monté :
```bash
CONF=/home/deploy/afrikamode/backend/deploy/nginx/default.conf
```
- `nginx` n'existe PAS sur l'hôte → toujours `docker exec backend-nginx-1 nginx …`
- `default.conf` contient déjà 4 sites en prod → **backup + `nginx -t` avant reload**.

---

## 0. Sauvegarde (obligatoire avant toute édition)
```bash
cp "$CONF" "$CONF.bak"
# restauration si besoin :  cp "$CONF.bak" "$CONF" && docker exec backend-nginx-1 nginx -s reload
```

---

## 1. Bloc HTTP `:80` (ACME + redirection)  — ✅ déjà fait
Ajouté en fin de fichier (a permis l'émission du certificat) :
```nginx
# ===================== humanbcorp.com =====================
server {
    listen 80;
    listen [::]:80;
    server_name humanbcorp.com www.humanbcorp.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}
```

---

## 2. Bloc HTTPS `:443` (le routage réel)  — à faire
```bash
cat >> "$CONF" <<'EOF'

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name humanbcorp.com www.humanbcorp.com;

    ssl_certificate     /etc/letsencrypt/live/humanbcorp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/humanbcorp.com/privkey.pem;

    client_max_body_size 25M;

    # Médias uploadés : nécessite le montage du volume (point 4). 404 sinon.
    location /media/ {
        alias /app/mediafiles-humanbcorp/;
        access_log off;
        expires 30d;
    }

    # Tout le reste vers l'app (/static/ est servi par WhiteNoise dans gunicorn)
    location / {
        proxy_pass http://humanbcorp_web:8000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}
EOF
```

---

## 3. Tester puis recharger (dans le conteneur)
```bash
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
```
Si `nginx -t` échoue → **ne pas recharger** : `cp "$CONF.bak" "$CONF"` puis corriger.

---

## 4. Vérifier depuis l'extérieur
```bash
curl -I  http://humanbcorp.com/     # -> 301 vers https
curl -I https://humanbcorp.com/     # -> 200 ou 302, certificat valide
```

---

## 5. (Optionnel) Servir `/media/` — monter le volume
À faire seulement si l'app affiche des fichiers uploadés. Dans
`/home/deploy/afrikamode/backend/docker-compose.prod.yml`, service `nginx` :
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
```bash
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml up -d nginx
```

---

## Résumé des points à éditer
| # | Fichier | Action | État |
|---|---------|--------|------|
| 1 | `default.conf` | ajouter `server{}` :80 (ACME + redirect) | ✅ fait |
| 2 | `default.conf` | ajouter `server{}` :443 (ssl + proxy_pass) | ⏳ à faire |
| 3 | conteneur nginx | `nginx -t` + `nginx -s reload` | ⏳ après édition |
| 4 | `backend/docker-compose.prod.yml` | monter `humanbcorp_media_volume` | ⏸ optionnel |
