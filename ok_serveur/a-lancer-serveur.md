# À lancer sur le serveur — réinit base + test d'auth

Copier/coller bloc par bloc dans `/home/humanbcorp/humanbcorp/`.

---

## 1. Vérifier que le fix est en place
```bash
cd /home/humanbcorp/humanbcorp
grep -n humanbcorp_db docker-compose.prod.yml
```
➡️ Doit renvoyer **3 lignes**. Si 0 → appliquer d'abord `appliquer-fix-db.md`.

## 2. Base vierge + nouveau mot de passe alphanumérique
```bash
docker compose -f docker-compose.prod.yml down -v
NEWPASS=$(openssl rand -hex 24)
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEWPASS|" .env
grep '^POSTGRES_PASSWORD=' .env
```

## 3. Démarrer
```bash
docker compose -f docker-compose.prod.yml up -d
sleep 12
docker compose -f docker-compose.prod.yml ps
```

## 4. Test définitif — les 2 IP doivent être IDENTIQUES
```bash
docker exec humanbcorp_web python -c "import socket; print(socket.gethostbyname('humanbcorp_db'))"
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' \
  $(docker compose -f docker-compose.prod.yml ps -q humanbcorp_db)
```

## 5. Logs
```bash
docker compose -f docker-compose.prod.yml logs --tail=30 humanbcorp_web
```
Attendu : *Database is up* → *migrations … OK* → **Listening at 0.0.0.0:8000**.

---

À me renvoyer : le résultat du **grep** (étape 1), les **2 IP** (étape 4) et les **logs** (étape 5).
