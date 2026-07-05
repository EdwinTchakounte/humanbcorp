# Fix final — orphelin `humanbcorp-db-1` qui empêche de vider le volume

## Diagnostic
- Les 2 IP de `humanbcorp_db` sont **identiques** → plus de collision réseau (OK).
- Mais `down -v` affiche `Volume humanbcorp_pgdata Resource is still in use` :
  un **conteneur orphelin** `humanbcorp-db-1` (ancien service `db`) tient encore le
  volume `humanbcorp_pgdata`. Le nouveau `humanbcorp_db` a donc **remonté l'ancien
  volume** (avec l'ancien mot de passe) → `password authentication failed` persiste.

## Correctif — à lancer sur le serveur
```bash
cd /home/humanbcorp/humanbcorp

# 1. Tout arrêter, y compris l'orphelin
docker compose -f docker-compose.prod.yml down --remove-orphans
docker rm -f humanbcorp-db-1 2>/dev/null    # ceinture + bretelles

# 2. Vider POUR DE BON le volume Postgres (plus rien ne le tient)
docker volume rm humanbcorp_pgdata
docker volume ls | grep humanbcorp_pgdata   # doit être VIDE (rien affiché)

# 3. Redémarrer : Postgres réinitialise le volume avec le .env courant
docker compose -f docker-compose.prod.yml up -d
sleep 12
docker compose -f docker-compose.prod.yml ps
```

## Vérifier que l'auth passe enfin
```bash
docker compose -f docker-compose.prod.yml logs --tail=30 humanbcorp_web
```
Attendu : *Database is up* → *migrations … OK* → **Listening at 0.0.0.0:8000**.

Il ne doit **plus** y avoir de ligne `humanbcorp-db-1` dans `ps` — uniquement
`humanbcorp-humanbcorp_db-1` et `humanbcorp_web`.
