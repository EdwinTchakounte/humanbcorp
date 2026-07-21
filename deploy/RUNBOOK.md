# RUNBOOK — bascule monolithe → découplé (humanbcorp.com)

Objectif : **remplacer** l'ancien monolithe `humanbcorp_web` par le stack découplé
(**api + vitrine + dashboard + qcluster**) en **réutilisant** ce qui existe déjà :
la base (`humanbcorp_pgdata`), les uploads (`humanbcorp_media_volume`), le `.env`,
le nginx central `backend-nginx-1` et son certbot `backend-certbot-1`.

> ⚠️ **Aucun secret dans ce fichier.** Le `.env` reste **uniquement sur le serveur**.
> Toutes les commandes tournent **en root** sur le VPS (81.0.246.144).

Chemins confirmés (source : `ok_serveur/`) :
```bash
CONF=/home/deploy/afrikamode/backend/deploy/nginx/default.conf   # conf du nginx central (5 sites)
NGINX=backend-nginx-1
CERTBOT=backend-certbot-1
```

---

## 0. Pré-vol (rien ne change encore)

```bash
# Le stack actuel tourne bien sous le projet "humanbcorp" ? (nom => volumes réadoptés)
docker inspect humanbcorp_web --format \
  'projet={{index .Config.Labels "com.docker.compose.project"}} workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}'
# Volumes existants À CONSERVER (doivent exister) :
docker volume ls | grep -i humanbcorp     # attendu : humanbcorp_pgdata, humanbcorp_media_volume
# Certif déjà là pour l'apex ? (réutilisé tel quel)
docker exec $NGINX ls /etc/letsencrypt/live/ | grep humanbcorp
# DNS des 2 nouveaux sous-domaines (doit répondre 81.0.246.144) :
dig +short api.humanbcorp.com dashboard.humanbcorp.com
```
> Le `workdir` affiché = **DEPLOY_PATH**. On y dépose le nouveau `docker-compose.prod.yml`
> et on garde le `.env` déjà présent. Si le projet n'est PAS `humanbcorp`, déployer
> avec `-p humanbcorp` (sinon volumes vides = perte base + uploads).

---

## 1. SAUVEGARDE base + conf nginx (obligatoire avant de toucher au prod)

```bash
# Dump SQL de la base existante (via le conteneur DB actuel)
docker exec humanbcorp-humanbcorp_db-1 sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > ~/backup-humanbcorp-$(date +%F-%H%M).sql
ls -lh ~/backup-humanbcorp-*.sql       # vérifier taille > 0

# Backup de la conf nginx partagée (5 sites dedans !)
cp "$CONF" "$CONF.bak-$(date +%F-%H%M)"
```

---

## 2. Déposer le nouveau compose + images (CI a déjà build/push les 3 images)

Sur `main`, le workflow `deploy.yml` pousse sur GHCR :
`ghcr.io/edwintchakounte/humanbcorp/{backend,vitrine,dashboard}:latest`.

```bash
cd <DEPLOY_PATH>                        # le workdir affiché en §0
# Remplacer l'ancien compose par le découplé (garder le .env existant intact) :
#   -> copier docker-compose.prod.yml (racine du repo) ici.
echo "$GHCR_PAT" | docker login ghcr.io -u edwintchakounte --password-stdin   # si package privé
docker compose -p humanbcorp -f docker-compose.prod.yml pull
```

> Le `.env` déjà en place est réutilisé tel quel. **Ajouts requis** avant `up` :
> vérifier que `ALLOWED_HOSTS` contient `api.humanbcorp.com` **et** `localhost`
> (healthcheck), et que `CSRF_TRUSTED_ORIGINS` / CORS listent les 3 domaines
> `https://humanbcorp.com`, `https://dashboard.humanbcorp.com`. (Éditer le `.env`
> serveur, aucune valeur secrète à changer.)

---

## 3. Couper l'ancien, lancer le découplé (mêmes volumes)

```bash
docker stop humanbcorp_web                      # libère le nom / le réseau
docker compose -p humanbcorp -f docker-compose.prod.yml up -d
docker compose -p humanbcorp -f docker-compose.prod.yml ps
docker compose -p humanbcorp -f docker-compose.prod.yml logs -f humanbcorp_api
```
L'entrypoint de `humanbcorp_api` applique les **migrations** sur la base EXISTANTE
(d'où le dump en §1), lance collectstatic (WhiteNoise) puis gunicorn.

Vérif interne (avant même nginx) :
```bash
docker exec $NGINX sh -c 'wget -qO- --timeout=4 http://humanbcorp_api:8000/api/v1/health/; echo'
docker exec $NGINX sh -c 'wget -qO- --timeout=4 http://humanbcorp_vitrine:3000/  >/dev/null && echo VITRINE_OK'
docker exec $NGINX sh -c 'wget -qO- --timeout=4 http://humanbcorp_dashboard:3000/ >/dev/null && echo DASH_OK'
```

---

## 4. Nginx central — blocs :80 + certificats des 2 nouveaux sous-domaines

### 4a. Remplacer l'ancien bloc humanbcorp par les nouveaux vhosts
Dans `$CONF`, **supprimer les 2 `server {}` humanbcorp existants** (ceux qui pointent
vers `humanbcorp_web:8000`) puis coller le contenu de **`deploy/nginx/humanbcorp.conf`**.
Pour un premier passage sûr, ne coller D'ABORD que les **3 blocs `:80`** (ACME + redirect).

```bash
docker exec $NGINX nginx -t && docker exec $NGINX nginx -s reload
# échec => cp "$CONF.bak-..." "$CONF" et recommencer
```

### 4b. Émettre les certificats api. et dashboard. (l'apex réutilise l'ancien)
```bash
docker exec $CERTBOT certbot certonly --webroot -w /var/www/certbot -d api.humanbcorp.com
docker exec $CERTBOT certbot certonly --webroot -w /var/www/certbot -d dashboard.humanbcorp.com
docker exec $NGINX ls /etc/letsencrypt/live/     # doit lister api. + dashboard. + humanbcorp.com
```

---

## 5. Activer le HTTPS (blocs :443)

Coller les **3 blocs `:443`** de `deploy/nginx/humanbcorp.conf` dans `$CONF`, puis :
```bash
docker exec $NGINX nginx -t && docker exec $NGINX nginx -s reload
```

Vérif extérieure :
```bash
curl -I https://humanbcorp.com/                     # vitrine  -> 200
curl -s https://api.humanbcorp.com/api/v1/health/   # API      -> {"status":"ok"} (ou 200)
curl -I https://dashboard.humanbcorp.com/           # dashboard-> 200/302
```

---

## 6. (Si les images/CV ne s'affichent pas) — monter le volume média dans le nginx central

Le bloc `location /media/` de `api.humanbcorp.com` lit `/app/mediafiles-humanbcorp/`.
Il faut monter le volume dans **le compose du nginx central** (projet `backend`,
`/home/deploy/afrikamode/backend/docker-compose.prod.yml`, service `nginx`) :
```yaml
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
curl -I https://api.humanbcorp.com/media/<un_fichier_connu>     # -> 200
```

---

## 7. Rollback (si la bascule échoue)

```bash
cp "$CONF.bak-..." "$CONF" && docker exec $NGINX nginx -s reload   # restaure les vhosts
docker compose -p humanbcorp -f docker-compose.prod.yml down       # coupe le découplé
docker start humanbcorp_web                                        # relance l'ancien monolithe
# base corrompue ? restaurer le dump :
#   cat ~/backup-humanbcorp-<...>.sql | docker exec -i humanbcorp-humanbcorp_db-1 \
#     sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

---

## Récap — ce qu'on réutilise vs ce qui change

| Élément | Ancien | Nouveau |
|---|---|---|
| Base PostgreSQL | `humanbcorp_pgdata` | **identique** (dump avant migrations) |
| Uploads | `humanbcorp_media_volume` | **identique** (remonté) |
| `.env` | présent sur serveur | **réutilisé** (+ ALLOWED_HOSTS/CSRF pour sous-domaines) |
| Réseau proxy | `backend_default` | **identique** |
| nginx central + certbot | `backend-nginx-1` / `backend-certbot-1` | **identiques** |
| Cert `humanbcorp.com`+www | émis | **réutilisé** |
| Certs `api.` / `dashboard.` | — | **à émettre** (§4b) |
| Conteneur web | `humanbcorp_web` (monolithe) | `humanbcorp_api` + `_vitrine` + `_dashboard` + `_qcluster` |
| Routage | 1 site → `:8000` | 3 vhosts (apex→vitrine, api→Django, dashboard→dashboard) |
