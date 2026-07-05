# Reconnaissance par le nginx central (routage + HTTPS de humanbcorp.com)

Le nginx mutualisé (`backend-nginx-1`) détient les ports 80/443 et route chaque
domaine vers le bon conteneur via `backend_default`. On va : (0) découvrir sa
config réelle, (1) vérifier qu'il joint déjà `humanbcorp_web`, (2) ajouter le bloc
HTTP + émettre le certificat, (3) activer le HTTPS.

Toutes ces commandes se lancent **en root** (l'admin du nginx central).

---

## 0. Découvrir la config réelle du nginx central *(ne rien supposer)*
```bash
# Où sont montés : le dossier de conf, le webroot certbot, letsencrypt ?
docker inspect backend-nginx-1 \
  --format '{{range .Mounts}}{{.Source}}  ->  {{.Destination}}{{"\n"}}{{end}}'
```
Repérer dans la sortie :
- le montage vers **`/etc/nginx/conf.d`** (ou `/etc/nginx`) → c'est **là** qu'on ajoute notre bloc, côté hôte ;
- le montage vers **`/var/www/certbot`** → webroot du challenge ACME ;
- le montage vers **`/etc/letsencrypt`** → où atterriront les certificats.

```bash
# Voir comment les autres sites sont déclarés (conf.d séparés ? un seul default.conf ?)
docker exec backend-nginx-1 sh -c 'ls -l /etc/nginx/conf.d/ 2>/dev/null; echo ---; nginx -T 2>/dev/null | grep -E "server_name|root /var/www" | head'
```
➡️ Adapter les chemins ci-dessous à CE que montre cette sortie. Le runbook suppose
`/home/deploy/afrikamode/backend/deploy/nginx/` et un webroot `/var/www/certbot` :
confirmer avant d'écrire.

---

## 1. Vérifier que le nginx central joint déjà l'app
```bash
# Même réseau ? humanbcorp_web doit apparaître
docker network inspect backend_default \
  --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}' | grep -E 'humanbcorp|nginx'

# Requête HTTP interne nginx central -> app (200/302 attendu)
docker exec backend-nginx-1 sh -c 'wget -qO- --timeout=4 http://humanbcorp_web:8000/ 2>&1 | head -c 200; echo'
```
➡️ Si l'app répond ici, le routage est possible. Sinon, vérifier que `humanbcorp_web`
est bien sur `backend_default` (`networks: proxy` dans le compose).

---

## 2. Bloc HTTP (:80) + émission du certificat

### 2a. Ajouter UNIQUEMENT le server{} port 80
Créer un fichier de site dédié (adapter le dossier trouvé en étape 0) :
```bash
CONF_DIR=/home/deploy/afrikamode/backend/deploy/nginx     # <-- ADAPTER si l'étape 0 diffère
cat > "$CONF_DIR/humanbcorp.conf" <<'EOF'
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
EOF
```
> Si les sites sont dans un **seul** `default.conf` (pas de `conf.d/`), coller ce
> bloc à l'intérieur, à côté des autres `server {}`.

### 2b. Tester et recharger
```bash
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
```

### 2c. Émettre le certificat via le certbot mutualisé
```bash
docker exec backend-certbot-1 certbot certonly --webroot -w /var/www/certbot \
  -d humanbcorp.com -d www.humanbcorp.com
```
➡️ Doit finir par `Successfully received certificate` et écrire dans
`/etc/letsencrypt/live/humanbcorp.com/`. Prérequis : `dig +short humanbcorp.com`
= `81.0.246.144` (déjà OK).

---

## 3. Activer le HTTPS (:443)

### 3a. Ajouter le server{} port 443 dans le même fichier
```bash
cat >> "$CONF_DIR/humanbcorp.conf" <<'EOF'

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name humanbcorp.com www.humanbcorp.com;

    ssl_certificate     /etc/letsencrypt/live/humanbcorp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/humanbcorp.com/privkey.pem;

    client_max_body_size 25M;

    location /media/ {
        alias /app/mediafiles-humanbcorp/;   # servi via le volume monté (phase média)
        access_log off;
        expires 30d;
    }

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

### 3b. Tester et recharger
```bash
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
```

---

## 4. Vérifier depuis l'extérieur
```bash
curl -I  http://humanbcorp.com/     # -> 301 vers https
curl -I https://humanbcorp.com/     # -> 200 (ou 302 login), certificat valide
```

> ⚠️ Le `location /media/` renvoie 404 tant que le volume `humanbcorp_media_volume`
> n'est pas monté dans le nginx central (étape « volume média » du runbook). Le
> reste du site (dont `/static/` servi par WhiteNoise) fonctionne sans ce montage.
> Si tu ne veux pas de `/media/` tout de suite, tu peux commenter ce `location`.
