# Tout-en-un — remettre le bon compose + mot de passe + démarrage

⚠️ Ce qui a foiré la dernière fois :
- le compose du serveur était **l'ancien** (service `db`, pas `humanbcorp_db`) → collision ;
- `NEWPASS=...` collé sur la même ligne que `down -v` → mot de passe **vide**.

Ci-dessous : **UN SEUL bloc**. Sélectionne-le en entier et colle-le d'un coup
dans `/home/humanbcorp/humanbcorp/`. Chaque commande est sur sa propre ligne.

```bash
cd /home/humanbcorp/humanbcorp

# 1) Réécrire le compose avec le service humanbcorp_db (fin de la collision)
cat > docker-compose.prod.yml <<'EOF'
services:
  humanbcorp_db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  humanbcorp_web:
    image: ${WEB_IMAGE}
    container_name: humanbcorp_web
    restart: unless-stopped
    env_file:
      - .env
    environment:
      POSTGRES_HOST: humanbcorp_db
      POSTGRES_PORT: 5432
    volumes:
      - media_volume:/app/mediafiles
    networks:
      - internal
      - proxy
    depends_on:
      humanbcorp_db:
        condition: service_healthy
    expose:
      - "8000"

networks:
  internal:
  proxy:
    external: true
    name: backend_default

volumes:
  pgdata:
  media_volume:
EOF

# 2) Vérifier : doit afficher 3 lignes
grep -n humanbcorp_db docker-compose.prod.yml

# 3) Tout arrêter + supprimer les volumes (base vierge, aucune donnée de prod)
docker compose -f docker-compose.prod.yml down -v

# 4) Nouveau mot de passe alphanumérique (ligne dédiée !)
NEWPASS=$(openssl rand -hex 24)
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEWPASS|" .env
grep '^POSTGRES_PASSWORD=' .env

# 5) Démarrer
docker compose -f docker-compose.prod.yml up -d
sleep 12
docker compose -f docker-compose.prod.yml ps
```

## Ensuite — test définitif (les 2 IP doivent être IDENTIQUES)
```bash
docker exec humanbcorp_web python -c "import socket; print(socket.gethostbyname('humanbcorp_db'))"
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' \
  $(docker compose -f docker-compose.prod.yml ps -q humanbcorp_db)
```

## Logs
```bash
docker compose -f docker-compose.prod.yml logs --tail=30 humanbcorp_web
```
Attendu : *Database is up* → *migrations … OK* → **Listening at 0.0.0.0:8000**.

---

### Points de contrôle
- `grep` (étape 2) → **3 lignes**. Si 0, le heredoc a échoué, recommencer.
- `POSTGRES_PASSWORD=` (étape 4) → **suivi de 48 caractères** (0-9a-f), jamais vide.
- `ps` → le service doit s'appeler **`humanbcorp_db`** (plus `db`).
- Les 2 IP du test → identiques, et **pas** en `172.18.x` (ça, c'est backend_default).
