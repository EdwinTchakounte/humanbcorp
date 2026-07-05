# Phase 5 — Démarrer le stack sur le VPS

À exécuter **sur le serveur, connecté en `humanbcorp`** :
```bash
ssh -i /chemin/vers/humanbcorp_ci humanbcorp@81.0.246.144
```

Les fichiers `docker-compose.prod.yml` et `.env` sont déjà dans `/home/humanbcorp/humanbcorp/`.

```bash
cd /home/humanbcorp/humanbcorp

# 1) mettre un VRAI mot de passe Postgres (remplacer CHANGE_ME_STRONG_PASSWORD)
nano .env

# 2) démarrer le stack
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 3) vérifier
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 humanbcorp_web

# 4) (optionnel) créer un compte admin Django
docker compose -f docker-compose.prod.yml exec humanbcorp_web python manage.py createsuperuser
```

## Logs attendus (dans l'ordre)
```
Waiting for PostgreSQL at db:5432... Database is up.
Applying database migrations...
Collecting static files...
[gunicorn] Listening at: http://0.0.0.0:8000
```

## Important
- ⚠️ Éditer `POSTGRES_PASSWORD` **avant** le premier `up -d` (il initialise la base).
- 📌 À ce stade l'app tourne mais **n'est pas encore accessible depuis Internet** :
  le routage passe par le nginx central (**phases 6-7**), qu'on fait ensuite.
- En cas de souci : `docker compose -f docker-compose.prod.yml logs humanbcorp_web`
  et `docker compose -f docker-compose.prod.yml logs db`.
