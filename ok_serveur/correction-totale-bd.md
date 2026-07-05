# Correction TOTALE et définitive du `connection failed` Postgres

Procédure vérifiée, idempotente : on rase tout résidu **avec preuve à chaque
étape**, puis on prouve que l'auth passe. À lancer sur le serveur dans
`/home/humanbcorp/humanbcorp/`. Copier/coller bloc par bloc.

---

## Étape 1 — Arrêt total (stack + orphelins)
```bash
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml down --remove-orphans
```

## Étape 2 — Tuer TOUT conteneur résiduel du projet
```bash
# Voir ce qui reste (db, humanbcorp_db, web...)
docker ps -a --filter "name=humanbcorp" --format '{{.Names}}\t{{.Status}}'

# Les supprimer de force (aucune donnée utile dedans)
docker rm -f $(docker ps -a --filter "name=humanbcorp" -q) 2>/dev/null || true

# Vérifier : plus AUCUN conteneur humanbcorp
docker ps -a --filter "name=humanbcorp" --format '{{.Names}}'
```
➡️ La dernière commande ne doit **rien** afficher.

## Étape 3 — Supprimer le volume Postgres et PROUVER qu'il est parti
```bash
# Qui tient encore le volume ? (doit être vide maintenant)
docker ps -a --filter volume=humanbcorp_pgdata --format '{{.Names}}'

docker volume rm humanbcorp_pgdata 2>/dev/null || true

# PREUVE : le volume ne doit plus exister
if docker volume ls -q | grep -qx humanbcorp_pgdata; then
  echo ">>> ECHEC : le volume existe ENCORE. Un conteneur le tient :"
  docker ps -a --filter volume=humanbcorp_pgdata
  echo ">>> Ne pas continuer avant de l'avoir supprimé."
else
  echo ">>> OK : volume humanbcorp_pgdata supprime. On peut continuer."
fi
```
➡️ Ne PAS passer à l'étape 4 tant que tu ne vois pas `>>> OK`.

## Étape 4 — Mot de passe propre (alphanumérique pur, rien à échapper)
```bash
NEWPASS=$(openssl rand -hex 24)
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEWPASS|" .env
grep '^POSTGRES_' .env      # DB / USER / PASSWORD / HOST=humanbcorp_db / PORT=5432
```

## Étape 5 — Démarrage : Postgres grave CE mot de passe dans un volume NEUF
```bash
docker compose -f docker-compose.prod.yml up -d
sleep 12
docker compose -f docker-compose.prod.yml ps
```

---

## Étape 6 — PREUVE que l'auth passe (3 tests)

### 6a. Un seul conteneur base, sain, bon nom
```bash
docker compose -f docker-compose.prod.yml ps
```
Attendu : **uniquement** `humanbcorp-humanbcorp_db-1` (healthy) + `humanbcorp_web` (Up).
Aucune ligne `humanbcorp-db-1`.

### 6b. Le rôle existe et l'auth interne fonctionne
```bash
docker exec $(docker compose -f docker-compose.prod.yml ps -q humanbcorp_db) \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\du"'
```
Attendu : la table des rôles listant `humanbcorp`, sans erreur.

### 6c. L'app se connecte et migre
```bash
docker compose -f docker-compose.prod.yml logs --tail=40 humanbcorp_web
```
Attendu : *Database is up* → *Applying database migrations … OK* →
**Listening at 0.0.0.0:8000**. Plus aucune ligne `password authentication failed`.

---

## Étape 7 — Superuser (une fois l'app OK)
```bash
docker exec -it humanbcorp_web python manage.py createsuperuser
```

---

## Règles pour que ça ne revienne JAMAIS
1. **Nom de service unique** : garder `humanbcorp_db` (jamais `db`) — évite toute
   collision sur le réseau mutualisé `backend_default`.
2. **Toujours `--remove-orphans`** dans les `down` — pas de conteneur fantôme qui
   retient le volume.
3. **Ne jamais changer `POSTGRES_PASSWORD` après la mise en service** sans faire un
   `ALTER USER humanbcorp WITH PASSWORD '...';` côté Postgres. Le volume ne relit
   pas le `.env` : changer le mot de passe seul dans `.env` casse l'auth.
4. **Mot de passe via `openssl rand -hex`** — que du `0-9a-f`, aucun caractère à
   échapper qui divergerait entre compose et env_file.
