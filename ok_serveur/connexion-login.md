# Connexion / login qui échoue — diagnostic et correctifs

À lancer dans `/home/humanbcorp/humanbcorp/`.

---

## 0. Déployer d'abord le nouveau logo/charte (après build CI)
Le rebranding (logo HBC, couleurs) est dans une nouvelle image. La récupérer :
```bash
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d          # collectstatic relancé au démarrage
```
> Attendre ~2-3 min après le push que la CI ait fini de publier l'image sur GHCR.
> Vérifier le tag récupéré : `docker compose -f docker-compose.prod.yml images`.

---

## 1. LE test qui tranche : regarder les logs PENDANT une tentative
Dans un terminal, laisser tourner :
```bash
docker compose -f docker-compose.prod.yml logs -f humanbcorp_web
```
Puis, dans le navigateur : `https://humanbcorp.com/registration/login/`, tenter de se
connecter. Observer la ligne qui apparaît :

| Ce que montrent les logs | Cause | Correctif |
|--------------------------|-------|-----------|
| `Forbidden (CSRF ... )` / `CSRF verification failed` | `.env` sans `CSRF_TRUSTED_ORIGINS` | → §2 |
| `Bad Request (400)` / `Invalid HTTP_HOST` | `ALLOWED_HOSTS` incomplet | → §2 |
| Page se recharge, « identifiants invalides » | pas de compte / mauvais mot de passe | → §3 |
| `500` + traceback | erreur applicative | copier le traceback |

---

## 2. Vérifier / corriger le `.env` (hôtes + CSRF)
```bash
grep -E '^(ALLOWED_HOSTS|CSRF_TRUSTED_ORIGINS|DEBUG|SECURE_SSL_REDIRECT)=' .env
```
Doit contenir **exactement** :
```
ALLOWED_HOSTS=humanbcorp.com,www.humanbcorp.com
CSRF_TRUSTED_ORIGINS=https://humanbcorp.com,https://www.humanbcorp.com
```
Si absent/incomplet, corriger puis recharger :
```bash
sed -i 's|^ALLOWED_HOSTS=.*|ALLOWED_HOSTS=humanbcorp.com,www.humanbcorp.com|' .env
sed -i 's|^CSRF_TRUSTED_ORIGINS=.*|CSRF_TRUSTED_ORIGINS=https://humanbcorp.com,https://www.humanbcorp.com|' .env
grep -E '^(ALLOWED_HOSTS|CSRF_TRUSTED_ORIGINS)=' .env
docker compose -f docker-compose.prod.yml up -d        # recharge le .env
```

---

## 3. Créer un compte administrateur (si aucun n'existe)
Sans compte, impossible de se connecter — c'est souvent ça juste après un déploiement.
```bash
docker exec -it humanbcorp_web python manage.py createsuperuser
```
Renseigner nom d'utilisateur + mot de passe, puis se connecter via
`https://humanbcorp.com/registration/login/`.

Vérifier qu'il existe déjà des comptes :
```bash
docker exec humanbcorp_web python manage.py shell -c \
  "from django.contrib.auth import get_user_model; U=get_user_model(); print('utilisateurs:', U.objects.count())"
```
`utilisateurs: 0` → il faut créer le superuser ci-dessus.

---

## 4. Vérifs complémentaires
```bash
# Statiques (login.css, logo) bien collectés et servis par WhiteNoise ?
docker exec humanbcorp_web python manage.py collectstatic --noinput | tail -3
curl -I https://humanbcorp.com/static/img/logo-hbc.png     # -> 200

# L'app répond en HTTPS ?
curl -I https://humanbcorp.com/registration/login/          # -> 200
```

---

## À me renvoyer
La ligne de log de l'étape 1 pendant la tentative + le `count` d'utilisateurs
(étape 3). Ça identifie la cause exacte en une fois.
