# Base dédiée + réinitialisation propre (fin du `password authentication failed`)

Objectif : repartir sur une base Postgres **dédiée, isolée et vierge**, initialisée
avec le **bon** mot de passe, et le **prouver** avec un test définitif — pour ne
plus jamais tourner en rond sur l'auth.

> Pré-requis : le compose du serveur contient bien `humanbcorp_db` (fix appliqué).
> Vérifier : `grep -n humanbcorp_db docker-compose.prod.yml` → **3 lignes**.
> Sinon, appliquer d'abord `appliquer-fix-db.md`.

À exécuter dans `/home/humanbcorp/humanbcorp/`.

---

## 1. État des lieux (avant de toucher à quoi que ce soit)
```bash
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml ps
grep -n humanbcorp_db docker-compose.prod.yml      # attendu : 3 lignes
grep '^POSTGRES_' .env                             # DB / USER / PASSWORD / HOST / PORT
```

---

## 2. Repartir sur une base VIERGE (aucune donnée de prod encore)
`down -v` supprime les volumes `humanbcorp_pgdata` (+ médias, vides) → Postgres
se réinitialisera avec le mot de passe **courant** du `.env`.
```bash
docker compose -f docker-compose.prod.yml down -v
```

## 3. Mot de passe 100 % alphanumérique (rien à échapper)
```bash
NEWPASS=$(openssl rand -hex 24)
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEWPASS|" .env
grep '^POSTGRES_PASSWORD=' .env                    # que des 0-9a-f
```

## 4. Démarrage — Postgres grave CE mot de passe dans le volume neuf
```bash
docker compose -f docker-compose.prod.yml up -d
sleep 12
docker compose -f docker-compose.prod.yml ps
```

---

## 5. TEST DÉFINITIF (on prouve que l'app parle à SA base)

### 5a. Résolution DNS : `humanbcorp_db` pointe-t-il sur le BON conteneur ?
```bash
# IP que l'app résout pour "humanbcorp_db"
docker exec humanbcorp_web python -c "import socket; print(socket.gethostbyname('humanbcorp_db'))"

# IP réelle du conteneur humanbcorp_db (réseau interne)
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' \
  $(docker compose -f docker-compose.prod.yml ps -q humanbcorp_db)
```
➡️ **Les deux IP doivent être identiques.** Si oui → aucune collision, l'app vise
la bonne base. Si non → le compose n'a pas été rechargé (refaire `down` puis `up`).

### 5b. L'auth passe-t-elle vraiment ? (depuis le conteneur base)
```bash
docker exec humanbcorp_db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\du"'
```
➡️ Doit lister le rôle `humanbcorp` sans erreur.

### 5c. Logs applicatifs
```bash
docker compose -f docker-compose.prod.yml logs --tail=30 humanbcorp_web
```
Attendu : *Database is up* → *Applying database migrations … OK* →
**Listening at 0.0.0.0:8000**.

---

## 6. Créer le superuser (une fois l'app OK)
```bash
docker exec -it humanbcorp_web python manage.py createsuperuser
```

---

## Variante : base Postgres VRAIMENT externe (hors Docker)

Utile seulement si tu veux découpler la BD du cycle de vie des conteneurs
(sauvegardes, montée de version indépendante). Sinon la base dockerisée ci-dessus
est déjà « dédiée » et suffit.

1. Postgres installé sur l'hôte (ou managé). Créer base + rôle :
   ```sql
   CREATE ROLE humanbcorp LOGIN PASSWORD '...';
   CREATE DATABASE humanbcorp OWNER humanbcorp;
   ```
2. Retirer le service `humanbcorp_db` du compose (et le `depends_on`).
3. Dans `.env`, pointer l'hôte réel :
   ```
   POSTGRES_HOST=172.17.0.1        # gateway docker0 pour joindre l'hôte
   POSTGRES_PORT=5432
   ```
   et autoriser la connexion dans `pg_hba.conf` + `listen_addresses` de l'hôte.
4. `docker compose -f docker-compose.prod.yml up -d`.

> ⚠️ Plus de surface à sécuriser (pare-feu, `pg_hba.conf`). À ne faire que si le
> besoin est réel. Dans 95 % des cas, la base dockerisée dédiée (étapes 1–6)
> règle le problème d'auth et suffit largement.
