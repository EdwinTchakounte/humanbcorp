# Appliquer le fix `db -> humanbcorp_db` sur le serveur

Objectif : remplacer `docker-compose.prod.yml` du serveur par la version corrigée,
puis recréer les conteneurs **sans** perdre la base.

Choisir **UNE** des deux méthodes (A ou B).

---

## Méthode A — Réécrire sur le serveur (root, aucun scp)
La plus simple si tu es déjà connecté au VPS en root.
```bash
cd /home/humanbcorp/humanbcorp
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
```

## Méthode B — scp depuis le PC
`scp` **écrase** le fichier existant par défaut.
```bash
cd ~/Desktop/HumanB/ok_serveur
scp -i /chemin/vers/humanbcorp_ci docker-compose.prod.yml \
    humanbcorp@81.0.246.144:/home/humanbcorp/humanbcorp/
```

### Si scp refuse (« Permission denied » — ancien fichier appartenant à root)
Supprimer l'ancien puis re-scp. **Sur le serveur (root) :**
```bash
rm -f /home/humanbcorp/humanbcorp/docker-compose.prod.yml
# (optionnel) rendre le dossier bien à humanbcorp pour éviter le souci à l'avenir :
chown -R humanbcorp:humanbcorp /home/humanbcorp/humanbcorp
```
Puis relancer le `scp` de la méthode B.

---

## Vérifier que le bon fichier est en place
```bash
grep -n "humanbcorp_db" /home/humanbcorp/humanbcorp/docker-compose.prod.yml
```
→ 3 occurrences attendues : le service, `POSTGRES_HOST`, `depends_on`.

## Recréer les conteneurs (SANS -v : on garde la base)
```bash
cd /home/humanbcorp/humanbcorp
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
sleep 10
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=25 humanbcorp_web
```

Logs attendus : *Database is up* → *Applying database migrations … OK* → **Listening at 0.0.0.0:8000**.
