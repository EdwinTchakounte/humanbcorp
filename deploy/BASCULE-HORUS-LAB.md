---
noteId: "bascule-horus-lab"
tags: [deploiement, horus-lab]
---

# 🌐 Déploiement sur **horus-lab.com** — médias + webhook Tara

Adaptation de la bascule découplée au domaine **horus-lab.com** (au lieu de `humanbcorp.com`).
Le code est **agnostique du domaine** : tout passe par l'`.env` backend, les **variables CI**
(URLs figées au build des fronts Next) et la conf **nginx** du reverse-proxy central.

## 🎯 Cible domaines

| Brique | Hôte | Conteneur |
|---|---|---|
| Vitrine (public) | `humanbcorp.horus-lab.com` | `humanbcorp_vitrine:3000` |
| API (Django) | `api.humanbcorp.horus-lab.com` | `humanbcorp_api:8000` |
| Dashboard | `dashboard.humanbcorp.horus-lab.com` | `humanbcorp_dashboard:3000` |

**Webhook Tara** → `https://api.humanbcorp.horus-lab.com/api/v1/payments/webhook/tara/`

---

## 0. Prérequis domaine (à vérifier — sinon médias & webhook ne marcheront pas)

Ces éléments conditionnent le reste. Ils se font sur le serveur / DNS / Let's Encrypt :

1. **DNS** — 3 enregistrements A vers le VPS `81.0.246.144` :
   `humanbcorp.horus-lab.com`, `api.humanbcorp.horus-lab.com`, `dashboard.humanbcorp.horus-lab.com`.
2. **Certificats TLS** (certbot one-shot webroot, même méthode que l'existant) :
   ```bash
   for d in humanbcorp.horus-lab.com api.humanbcorp.horus-lab.com dashboard.humanbcorp.horus-lab.com; do
     docker run --rm -v backend_certbot_certs:/etc/letsencrypt -v backend_certbot_www:/var/www/certbot \
       certbot/certbot:latest certonly --webroot -w /var/www/certbot -d "$d" \
       --non-interactive --agree-tos -m contact@humanbcorp.com
   done
   ```
3. **Vhosts nginx** — dans `/home/deploy/afrikamode/backend/deploy/nginx/default.conf`, dupliquer les
   3 blocs `:443` existants en remplaçant `server_name` (et `ssl_certificate*`) par les hôtes
   `*.humanbcorp.horus-lab.com`. Le bloc **API** doit inclure la `location /media/` (cf. §3).

---

## 1. Fronts Next — variables CI + rebuild (URLs figées au build)

Les images vitrine/dashboard **embarquent** `NEXT_PUBLIC_*` au build (cf. `web/Dockerfile`,
`dashboard/Dockerfile`, `.github/workflows/deploy.yml`). Une image buildée pour `humanbcorp.com`
appellera la **mauvaise API** sur horus-lab.com. Il faut donc redéfinir les **variables du repo**
puis relancer le build/déploiement :

```bash
# via gh (ou Settings → Secrets and variables → Actions → Variables)
gh variable set NEXT_PUBLIC_SITE_URL       -b "https://humanbcorp.horus-lab.com"
gh variable set NEXT_PUBLIC_API_URL        -b "https://api.humanbcorp.horus-lab.com"
gh variable set NEXT_PUBLIC_DASHBOARD_URL  -b "https://dashboard.humanbcorp.horus-lab.com"
```
Puis relancer le workflow **deploy** (rebuild des 3 images + push GHCR + `up -d`).

---

## 2. Backend `.env` (sur le serveur, `/home/humanbcorp/humanbcorp/.env`)

Adapter les URLs publiques au nouveau domaine (le reste — `POSTGRES_*`, `SECRET_KEY`, `TARA_*`,
OAuth — inchangé) :

```env
DEBUG=False
ALLOWED_HOSTS=api.humanbcorp.horus-lab.com,localhost
CSRF_TRUSTED_ORIGINS=https://humanbcorp.horus-lab.com,https://dashboard.humanbcorp.horus-lab.com,https://api.humanbcorp.horus-lab.com
CORS_ALLOWED_ORIGINS=https://humanbcorp.horus-lab.com,https://dashboard.humanbcorp.horus-lab.com

# Webhook + returnUrl Tara / liens espace apprenant
PUBLIC_BASE_URL=https://api.humanbcorp.horus-lab.com
SITE_PUBLIC_URL=https://humanbcorp.horus-lab.com

# Paiement réel (pas d'auto-validation)
PAYMENTS_TEST_AUTO_VALIDATE=False
PAYMENTS_TEST_ALLOW_ANY_AMOUNT=False
```
Appliquer : `docker compose -p humanbcorp -f docker-compose.prod.yml up -d humanbcorp_api`.

> `PUBLIC_BASE_URL` sert à construire l'URL webhook envoyée à Tara ; `SITE_PUBLIC_URL` sert au
> `returnUrl` (retour navigateur sur la **vitrine** après paiement — corrigé côté code, cf. §4).

---

## 3. Médias — monter le volume dans le nginx central

Symptôme visé : `https://api.humanbcorp.horus-lab.com/media/...` en 404 → images absentes.

### Diagnostic
```bash
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml config | grep -n 'mediafiles-humanbcorp'
docker inspect backend-nginx-1 --format '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' | grep -i humanbcorp
```

### Correctif (service `nginx` du compose central)
Dans le service **`nginx:`**, ajouter à sa liste `volumes:` :
```yaml
      - humanbcorp_media:/app/mediafiles-humanbcorp:ro
```
Et, dans le bloc racine `volumes:` (UN SEUL) en bas du fichier :
```yaml
  humanbcorp_media:
    external: true
    name: humanbcorp_media_volume
```
Le vhost **API** (`api.humanbcorp.horus-lab.com`) doit servir `/media/` depuis ce montage :
```nginx
    location /media/ {
        alias /app/mediafiles-humanbcorp/;
        expires 7d;
        access_log off;
    }
```
Puis :
```bash
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml config >/dev/null && echo "YAML OK"
docker compose -f /home/deploy/afrikamode/backend/docker-compose.prod.yml up -d --force-recreate nginx   # viser "Recreated"
```

### Test
```bash
curl -I "https://api.humanbcorp.horus-lab.com/media/sitecms/media/ev07-wide.jpg"    # -> 200 attendu
# si 404 interne, vérifier la présence du fichier dans le volume :
docker exec backend-nginx-1 ls -l /app/mediafiles-humanbcorp/sitecms/media/ | head
```

---

## 4. Webhook Tara

1. **Code** (déjà corrigé) : `returnUrl` pointe désormais sur `SITE_PUBLIC_URL` (vitrine) et non
   plus sur le host API. Voir `backend/apps_coop/payments/providers/tara.py` `_return_url()`.
2. **Env** : `PUBLIC_BASE_URL=https://api.humanbcorp.horus-lab.com` (cf. §2) → l'appli enverra
   automatiquement `webHookUrl = https://api.humanbcorp.horus-lab.com/api/v1/payments/webhook/tara/`.
3. **Côté Tara (tableau de bord provider)** : **re-déclarer** l'URL de webhook sur
   `https://api.humanbcorp.horus-lab.com/api/v1/payments/webhook/tara/`
   (sinon les confirmations de paiement ne reviennent pas). Action manuelle chez Tara.

### Vérif webhook (après ouverture)
```bash
# le webhook arrive-t-il ? (logs gunicorn de l'API)
docker compose -p humanbcorp -f docker-compose.prod.yml logs -f humanbcorp_api | grep -i 'payments/webhook'
```

---

## 5. Check-list finale
- [ ] DNS + certs des 3 hôtes horus-lab.com OK
- [ ] Variables CI redéfinies + images rebuildées (fronts pointent la bonne API)
- [ ] `.env` backend adapté + `humanbcorp_api` relancé
- [ ] `curl -I https://api.humanbcorp.horus-lab.com/media/...jpg` → 200
- [ ] Webhook Tara re-déclaré sur l'URL horus-lab.com
- [ ] (plus tard) Brevo activé pour les mails de confirmation
