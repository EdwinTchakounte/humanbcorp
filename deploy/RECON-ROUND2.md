# Reconnaissance serveur — Round 2 (ciblé)

> À lancer **en root sur le VPS**. Commandes en **lecture seule** (rien n'est
> modifié). Copie/colle chaque bloc, puis renvoie-moi les sorties.
> ⚠️ Ne colle **aucun mot de passe / contenu de `.env`**. Les commandes sont
> écrites pour ne pas les révéler (elles listent des bases/certs, pas des secrets).

Faits déjà établis (round 1) : proxy = `backend-nginx-1` (réseau `backend_default`,
tient 80/443) · patron déjà déployé = `gathe-finance-prod` · HumanB actuel =
`humanbcorp_web` + base `humanbcorp-humanbcorp_db-1`.

---

## a) nginx central — montages + déclaration des sites
```bash
NGINX=backend-nginx-1
docker inspect "$NGINX" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}){{"\n"}}{{end}}'
docker exec "$NGINX" sh -c 'ls -l /etc/nginx/conf.d/ 2>/dev/null'
docker exec "$NGINX" sh -c 'nginx -T 2>/dev/null | grep -E "server_name|proxy_pass|listen .*ssl|ssl_certificate " | sort -u'
```

## b) TLS — certbot présent (même arrêté) ? certs déjà émis ?
```bash
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -iE 'certbot|acme|traefik' || echo "aucun certbot/traefik conteneur"
sudo ls -1 /etc/letsencrypt/live/ 2>/dev/null || echo "pas de /etc/letsencrypt sur l'hote"
```

## c) Le patron à copier — compose de gathe-finance
```bash
docker inspect gathe-finance-prod-backend-1 --format 'workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}'
# puis, en remplaçant <workdir> par le chemin affiché ci-dessus :
# cat <workdir>/docker-compose*.yml
```

## d) Base HumanB + réseaux de l'app actuelle
```bash
docker inspect humanbcorp_web --format 'nets={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker exec humanbcorp-humanbcorp_db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\l"'
```

## e) DNS du sous-domaine dashboard
```bash
dig +short dashboard.humanbcorp.com
```
