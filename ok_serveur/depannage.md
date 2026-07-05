# Dépannage — déploiement humanbcorp

Problèmes rencontrés et leur correctif. À exécuter sur le VPS, dans
`/home/humanbcorp/humanbcorp/`, en `humanbcorp` (ou root).

---

## 1. `password authentication failed for user "humanbcorp"`

**Symptôme** (logs `humanbcorp_web`) :
```
django.db.utils.OperationalError: connection failed: ... FATAL:
password authentication failed for user "humanbcorp"
```

**Cause.** La base a été initialisée avec un mot de passe ≠ de celui envoyé par
l'app. Piège classique Docker Compose : un `POSTGRES_PASSWORD` contenant un
**caractère spécial** (`$`, `#`, guillemets, espace…) est lu différemment par :
- le service `db` → via interpolation compose `${POSTGRES_PASSWORD}` (le `$` est interprété),
- le service web → via `env_file` (valeur brute).

Les deux divergent, et comme Postgres s'initialise au **premier** `up`, le volume
`humanbcorp_pgdata` garde le mauvais mot de passe.

**Correctif** (aucune donnée à ce stade → on réinitialise le volume) :
```bash
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml down -v          # supprime pgdata + media (vides)
NEWPASS=$(openssl rand -hex 24)                            # mot de passe alphanumérique pur
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEWPASS|" .env
grep '^POSTGRES_PASSWORD=' .env                            # vérifier : que des 0-9a-f
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs --tail=30 humanbcorp_web
```

**Règle** : dans un `.env` lu par Compose, utiliser `openssl rand -hex N` pour tout
mot de passe → pas de caractère à échapper.

> ⚠️ `down -v` supprime les volumes (base + médias). À n'utiliser que tant qu'il
> n'y a **pas encore de données de prod**. Après la mise en service, changer un mot
> de passe Postgres se fait avec `ALTER USER`, pas en recréant le volume.

---

## 2. `scp` / `ssh` : `Permission denied (password)`

L'utilisateur `humanbcorp` est **sans mot de passe** (`--disabled-password`) :
l'accès se fait uniquement par clé.
```bash
scp -i /chemin/vers/humanbcorp_ci <fichiers> humanbcorp@81.0.246.144:/home/humanbcorp/humanbcorp/
ssh -i /chemin/vers/humanbcorp_ci humanbcorp@81.0.246.144
```

---

## 3. `Bad Request (400)` / `DisallowedHost`

L'app répond mais rejette l'hôte. Vérifier dans `.env` :
- `ALLOWED_HOSTS=humanbcorp.com,www.humanbcorp.com`
- `CSRF_TRUSTED_ORIGINS=https://humanbcorp.com,https://www.humanbcorp.com`

Puis `docker compose -f docker-compose.prod.yml up -d` (recharge le `.env`).

---

## 4. Boucle de redirection HTTPS (301 en boucle)

`SECURE_SSL_REDIRECT=True` exige que le proxy transmette `X-Forwarded-Proto https`.
Le bloc `humanbcorp-nginx.conf` le fait déjà (`proxy_set_header X-Forwarded-Proto $scheme;`).
Vérifier que le trafic passe bien par le **nginx central** (pas en direct sur `:8000`).

---

## Commandes de diagnostic utiles
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 humanbcorp_web
docker compose -f docker-compose.prod.yml logs --tail=50 db
docker exec humanbcorp_web env | grep -E 'POSTGRES|ALLOWED|WEB_IMAGE'   # ce que voit l'app
docker network inspect backend_default | grep -A3 humanbcorp_web        # branché au proxy ?
```
