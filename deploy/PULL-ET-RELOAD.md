---
noteId: "pull-et-reload"
tags: [deploiement, ops, horus-lab]
---

# 🔄 Pull des images + relance de la pile + reload nginx

Procédure serveur (VPS `81.0.246.144`) pour récupérer une nouvelle version et la mettre en ligne.
Projet Docker **`humanbcorp`** dans `/home/humanbcorp/humanbcorp/` ; reverse-proxy central
**`backend-nginx-1`** (projet `backend`, conf `/home/deploy/afrikamode/backend/`).

Hôtes (horus-lab.com) : vitrine `humanbcorp.horus-lab.com` · API `api.humanbcorp.horus-lab.com`
· dashboard `dashboard.humanbcorp.horus-lab.com`.

---

## ⚠️ Prérequis — d'où viennent les nouvelles images

Le CI (`.github/workflows/deploy.yml`) ne construit/pousse les images `latest` sur GHCR que sur
**push/merge de `main`** (ou tag `v*`, ou `workflow_dispatch`). Les commits actuels sont sur
`refonte/parcours-publics` : **merger la PR #1 dans `main`** avant, sinon `pull` ne ramène rien.

Images : `ghcr.io/edwintchakounte/humanbcorp/{backend,vitrine,dashboard}`.

> Si `DEPLOY_ENABLED=true` (variable de dépôt), le CI se connecte en SSH et fait **déjà** le
> `pull` + `up -d` automatiquement au merge sur `main`. Les étapes ci-dessous sont alors un
> **filet manuel** / pour un redéploiement à la demande.

---

## 1. Pull + relance de la pile HumanB

```bash
cd /home/humanbcorp/humanbcorp

# (si le login GHCR a expiré)
echo "$GHCR_TOKEN" | docker login ghcr.io -u edwintchakounte --password-stdin

# récupérer les nouvelles images + recréer les conteneurs concernés
docker compose -p humanbcorp -f docker-compose.prod.yml pull
docker compose -p humanbcorp -f docker-compose.prod.yml up -d

# état + logs API (attendu : migrations → collectstatic → gunicorn, sans crash)
docker compose -p humanbcorp -f docker-compose.prod.yml ps
docker compose -p humanbcorp -f docker-compose.prod.yml logs -f humanbcorp_api    # Ctrl-C pour quitter (ne coupe pas le conteneur)
```

> Le `.env` (`/home/humanbcorp/humanbcorp/.env`) porte les **clés** (`SECRET_KEY`, `TARA_*`,
> `POSTGRES_*`, `PUBLIC_BASE_URL`, `SITE_PUBLIC_URL`…). `pull`/`up -d` ne le touchent pas ;
> si tu changes le `.env`, refais `up -d humanbcorp_api` pour qu'il soit relu.

---

## 2. Recharger nginx (après édition de la conf : vhosts / `location /media/`)

Conf centrale : `/home/deploy/afrikamode/backend/deploy/nginx/default.conf`.

```bash
docker exec backend-nginx-1 nginx -t          # valider la syntaxe AVANT
docker exec backend-nginx-1 nginx -s reload    # recharge à chaud, sans coupure
```

### 2bis. Cas particulier — changement de MONTAGE de volume (média)
Un `reload` ne suffit **pas** pour un nouveau volume : il faut **recréer** le conteneur nginx.
```bash
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml config >/dev/null && echo "YAML OK"
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml up -d --force-recreate nginx   # viser "Recreated"
```

---

## 3. Vérifications post-déploiement

```bash
curl -I https://api.humanbcorp.horus-lab.com/api/v1/health/                      # 200 {"status":"ok"...}
curl -I https://humanbcorp.horus-lab.com/                                        # 200 (vitrine)
curl -I https://dashboard.humanbcorp.horus-lab.com/                              # 200/307 (login)
curl -I https://api.humanbcorp.horus-lab.com/media/sitecms/media/ev07-wide.jpg   # 200 (média monté)
```

---

## 4. Rollback rapide (si la nouvelle version casse)

```bash
# revenir à une image précise (tag sha court affiché par le build CI) au lieu de latest
docker compose -p humanbcorp -f docker-compose.prod.yml pull        # re-tire les tags courants
# ou éditer temporairement l'image d'un service vers ghcr.io/.../<composant>@sha256:<...> puis :
docker compose -p humanbcorp -f docker-compose.prod.yml up -d <service>
```
