# Reset propre de la base (auth Postgres qui échoue)

Pour l'erreur `password authentication failed for user "humanbcorp"` persistante.
À exécuter sur le VPS, dans `/home/humanbcorp/humanbcorp/`.

> ⚠️ Le `down -v` DOIT s'exécuter **avant** le nouvel `up` : sinon l'ancien volume
> `humanbcorp_pgdata` (initialisé avec le mauvais mot de passe) persiste et l'auth
> échouera quoi qu'il arrive. `down -v` supprime aussi le volume médias (vide à ce stade).

## 1) Reset vérifié
```bash
cd /home/humanbcorp/humanbcorp
echo "--- mot de passe AVANT ---"; grep '^POSTGRES_PASSWORD=' .env

docker compose -f docker-compose.prod.yml down -v          # purge conteneurs + volumes

NEWPASS=$(openssl rand -hex 24)                            # mot de passe alphanumérique pur
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${NEWPASS}|" .env
echo "--- mot de passe APRÈS (48 hex, pas CHANGE_ME) ---"; grep '^POSTGRES_PASSWORD=' .env

echo "--- volumes restants ? ---"; docker volume ls | grep humanbcorp || echo "aucun (bien)"

docker compose -f docker-compose.prod.yml up -d
sleep 10
docker compose -f docker-compose.prod.yml logs --tail=25 humanbcorp_web
```

Logs attendus : *Database is up* → *Applying database migrations … OK* → gunicorn
**Listening at 0.0.0.0:8000**.

## 2) Diagnostic si ça échoue ENCORE
Montre ce que voit réellement le conteneur web (contourne l'entrypoint pour éviter le crash) :
```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh humanbcorp_web -c \
  'echo "PASS vu par web : $POSTGRES_PASSWORD"; echo "USER : $POSTGRES_USER"; ls -la /app/.env 2>/dev/null && echo "!! un .env est embarque dans limage" || echo "ok: pas de .env dans limage"'
```
- Si `PASS vu par web` ≠ la valeur du `.env` → divergence de parsing.
- Si un `/app/.env` est embarqué dans l'image → il peut masquer les variables.

## 3) Autres vérifs utiles
```bash
docker compose -f docker-compose.prod.yml ps -a                 # états des conteneurs
docker compose -f docker-compose.prod.yml logs --tail=40 db     # init de la base
cat -A .env | grep POSTGRES                                     # révèle espaces/CR cachés ($ = fin de ligne)
```
`cat -A` : si tu vois `^M` ou des espaces avant `$` en fin de ligne, le `.env` a des
caractères parasites → recréer la ligne proprement avec le `sed` du §1.
