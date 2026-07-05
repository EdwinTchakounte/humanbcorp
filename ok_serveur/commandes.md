# Commandes — déploiement humanbcorp.com

Fiche opérationnelle. Chaque bloc indique **où** l'exécuter.
Runbook détaillé : [`../doc/04-deploiement-humanbcorp.md`](../doc/04-deploiement-humanbcorp.md).

Repères :
- VPS : `81.0.246.144` · user applicatif : `humanbcorp` · stack : `/home/humanbcorp/humanbcorp`
- Proxy central : conteneur `backend-nginx-1` · certbot : `backend-certbot-1`
- Config nginx central : `/home/deploy/afrikamode/backend/deploy/nginx/default.conf`
- Image : `ghcr.io/edwintchakounte/humanbcorp:latest` (package **public**)

---

## Phase 3 — Secrets & variables GitHub  *(local, dans le dépôt, `gh` authentifié)*
```bash
gh secret   set SSH_HOST -b "81.0.246.144"
gh secret   set SSH_USER -b "humanbcorp"
gh secret   set SSH_KEY  < /chemin/vers/humanbcorp_ci     # clé PRIVÉE depuis un fichier (jamais en clair)
# gh secret set SSH_PORT -b "22"                           # seulement si port SSH != 22
gh variable set DEPLOY_ENABLED -b "true"
gh variable set DEPLOY_PATH    -b "/home/humanbcorp/humanbcorp"

gh secret list && gh variable list                         # vérifier
```

## Copier le bundle sur le serveur  *(local)*
```bash
scp ok_serveur/docker-compose.prod.yml ok_serveur/.env \
    humanbcorp@81.0.246.144:/home/humanbcorp/humanbcorp/
scp ok_serveur/humanbcorp-nginx.conf humanbcorp@81.0.246.144:/tmp/
```

## Phases 4-5 — Démarrer le stack  *(VPS, user `humanbcorp`)*
```bash
cd /home/humanbcorp/humanbcorp
nano .env                                              # mettre un vrai POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=40 humanbcorp_web
# créer un admin Django :
docker compose -f docker-compose.prod.yml exec humanbcorp_web python manage.py createsuperuser
```

## Phase 6 — Certificat TLS  *(VPS, admin/root)*
```bash
# 1) coller UNIQUEMENT le server{} :80 de /tmp/humanbcorp-nginx.conf dans :
#    /home/deploy/afrikamode/backend/deploy/nginx/default.conf
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
# 2) émettre le certificat
docker exec backend-certbot-1 certbot certonly --webroot -w /var/www/certbot \
  -d humanbcorp.com -d www.humanbcorp.com
```

## Phase 7 — Activer le HTTPS  *(VPS, admin/root)*
```bash
# ajouter le server{} :443 de humanbcorp-nginx.conf, puis :
docker exec backend-nginx-1 nginx -t && docker exec backend-nginx-1 nginx -s reload
```

## Phase 8 — Servir les médias  *(VPS, admin/root)*
Dans `/home/deploy/afrikamode/backend/docker-compose.prod.yml`, service `nginx` :
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
```

## Phase 9 — Vérifications  *(local ou VPS)*
```bash
curl -I https://humanbcorp.com/            # attendu : 200 (ou 301 -> 200)
dig +short humanbcorp.com @8.8.8.8         # 81.0.246.144
```

---

## Exploitation courante  *(VPS, user `humanbcorp`)*
```bash
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml logs -f humanbcorp_web     # logs live
docker compose -f docker-compose.prod.yml restart humanbcorp_web     # redémarrer l'app
docker compose -f docker-compose.prod.yml pull && \
  docker compose -f docker-compose.prod.yml up -d                    # MAJ manuelle
```
**Rollback** : dans `.env`, `WEB_IMAGE=ghcr.io/edwintchakounte/humanbcorp:sha-XXXXXXX`, puis `up -d`.

## CI/CD (automatique après phase 3)
`git push origin main` → build image + push GHCR + `docker compose pull && up -d` sur le VPS.
```bash
gh run list --limit 3          # suivre les runs
gh run watch <run-id>          # suivre en direct
```
