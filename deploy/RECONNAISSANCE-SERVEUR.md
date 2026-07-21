# Reconnaissance du serveur — avant déploiement de la refonte découplée

> **But** : découvrir *précisément* l'existant (le reverse-proxy nginx qui vit
> dans le réseau d'un autre projet Docker + le PostgreSQL déjà présent) pour
> écrire un `docker-compose.prod` et des vhosts qui s'y **branchent sans rien
> casser**. Toutes les commandes ci-dessous sont en **lecture seule** — elles
> n'écrivent rien.
>
> **Comment procéder** : lance chaque bloc, copie la sortie, colle-la moi.
> ⚠️ **Ne colle JAMAIS** un mot de passe, une clé, ou le contenu d'un `.env` /
> d'une variable `POSTGRES_PASSWORD`, `SECRET_KEY`, etc. Si une sortie en
> contient, masque-la (`***`). Les commandes ci-dessous sont écrites pour ne
> pas révéler de secret, mais reste vigilant sur les `docker inspect` d'env.

---

## Rappel de la cible (ce qu'on veut brancher)

La refonte est **3 briques** à router sur **3 sous-domaines** (noms à confirmer) :

| Brique | Dossier | Techno | Sous-domaine pressenti | Conteneur |
|---|---|---|---|---|
| API + back-office | `backend/` | Django/gunicorn `:8000` | `api.humanbcorp.com` | `humanbcorp_api` |
| Vitrine publique | `web/` | Next.js `:3000` | `humanbcorp.com` / `www` | `humanbcorp_vitrine` |
| Dashboard | `dashboard/` | Next.js `:3000` | `app.humanbcorp.com` | `humanbcorp_dashboard` |
| Ordonnanceur | `backend/` | django-q2 | — (interne) | `humanbcorp_qcluster` |

Le reverse-proxy nginx **existant** (dans le réseau d'un autre projet) garde les
ports 80/443 et le TLS ; nos conteneurs n'exposent **aucun port hôte**, ils sont
joints par le proxy via le réseau partagé. Le PostgreSQL **existant** est réutilisé
(nouvelle base + nouveau rôle dédiés), OU on garde un Postgres conteneurisé — la
recon tranchera.

---

## 0. One-shot (optionnel) — tout dumper d'un coup

Si tu veux aller vite, lance ce bloc et colle-moi tout le fichier généré
(`/tmp/recon-hbc.txt`). Sinon, fais les sections 1→8 une par une.

```bash
exec > >(tee /tmp/recon-hbc.txt) 2>&1
echo "############ 1. HOST & DOCKER ############"
uname -a; echo; docker version --format 'client {{.Client.Version}} / server {{.Server.Version}}'; docker compose version
echo; echo "############ 2. CONTENEURS ############"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
echo; echo "############ 3. RESEAUX ############"
docker network ls
echo; echo "############ 4. QUI TIENT 80/443 ############"
ss -ltnp 2>/dev/null | grep -E ':80|:443' || sudo ss -ltnp | grep -E ':80|:443'
echo; echo "############ 5. POSTGRES HOTE ? ############"
ss -ltnp 2>/dev/null | grep ':5432' || echo "pas de 5432 sur l'hote"
systemctl is-active postgresql 2>/dev/null || echo "pas de service postgresql hote"
echo; echo "############ 6. DNS ############"
for d in humanbcorp.com www.humanbcorp.com api.humanbcorp.com app.humanbcorp.com; do printf '%-28s %s\n' "$d" "$(dig +short "$d" | tr '\n' ' ')"; done
echo "############ FIN ############"
exec &>/dev/tty
echo ">> Sortie complète dans /tmp/recon-hbc.txt"
```

---

## 1. Identité du serveur & Docker

```bash
uname -a
cat /etc/os-release | grep -E '^(NAME|VERSION)='
docker version --format 'client {{.Client.Version}} / server {{.Server.Version}}'
docker compose version          # v2 (plugin) attendu ; sinon `docker-compose version`
df -h /                          # place disque restante (images + volumes + pgdata)
free -h                         # RAM dispo (Next build peut être gourmand)
nproc                            # cœurs CPU
```

**Ce que j'en tire** : version de compose (syntaxe), marge disque/RAM pour builder
les 2 images Next sur place (ou s'il faut plutôt builder en CI/GHCR).

---

## 2. Les conteneurs qui tournent (repérer le proxy & le projet)

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
# Vue "projet compose" (label com.docker.compose.project) pour chaque conteneur :
docker ps --format '{{.Names}}' | while read c; do
  p=$(docker inspect "$c" --format '{{index .Config.Labels "com.docker.compose.project"}}')
  printf '%-30s projet=%s\n' "$c" "${p:-<hors-compose>}"
done
```

**Ce que je cherche** : le nom exact du conteneur nginx, le **nom du projet
Docker** auquel il appartient (c'est lui qui nomme le réseau `<projet>_default`),
et les autres apps déjà hébergées (pour ne pas collisionner un nom de service/DB).

---

## 3. Le reverse-proxy nginx — sa vraie config *(ne rien supposer)*

Remplace `NGINX` par le nom réel vu en §2 (ex. `backend-nginx-1`).

```bash
NGINX=backend-nginx-1     # <-- adapte

# a) Réseaux du proxy (on devra rejoindre le MÊME) + image
docker inspect "$NGINX" --format 'image={{.Config.Image}}'
docker inspect "$NGINX" --format 'réseaux={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'

# b) Montages : où sont la conf, le webroot ACME, letsencrypt (côté HOTE -> conteneur)
docker inspect "$NGINX" --format '{{range .Mounts}}{{.Source}}  ->  {{.Destination}} ({{.Mode}}){{"\n"}}{{end}}'

# c) Comment les sites sont déclarés : un seul default.conf, ou un fichier par site ?
docker exec "$NGINX" sh -c 'ls -l /etc/nginx/conf.d/ 2>/dev/null; echo "--- sites-enabled ---"; ls -l /etc/nginx/sites-enabled/ 2>/dev/null'

# d) Les server_name déjà servis (pour voir la convention + ne pas écraser)
docker exec "$NGINX" sh -c 'nginx -T 2>/dev/null | grep -E "server_name|proxy_pass|listen .*ssl" | sort -u'
```

**Ce que j'en tire, décisif** :
- **le réseau partagé** à mettre en `external` dans notre compose ;
- **le fichier de conf** exact où ajouter nos 3 `server {}` (chemin HÔTE, car
  seul ce qui est bind-monté est vu par le conteneur — créer un fichier à côté ne
  suffit pas s'il n'est pas monté) ;
- **le webroot ACME** (`/var/www/certbot` ?) et **`/etc/letsencrypt`** pour les certs ;
- la **convention** des autres sites (proxy_pass par nom de conteneur, ports, TLS).

---

## 4. Le réseau partagé — qui est dessus

Remplace `RESEAU` par le réseau trouvé en §3a (ex. `backend_default`).

```bash
RESEAU=backend_default    # <-- adapte
docker network inspect "$RESEAU" --format 'driver={{.Driver}} subnet={{range .IPAM.Config}}{{.Subnet}}{{end}}'
docker network inspect "$RESEAU" --format '{{range .Containers}}{{.Name}}  {{.IPv4Address}}{{"\n"}}{{end}}'
```

**Ce que je vérifie** : que ce réseau est bien attachable, et quels alias/services
existent déjà dessus (un `web`, un `db`… → nos noms devront être uniques :
`humanbcorp_api`, `humanbcorp_db`, etc.).

---

## 5. TLS / certbot

```bash
# Le conteneur certbot du même projet (le cas échéant)
docker ps -a --format '{{.Names}}\t{{.Image}}' | grep -iE 'certbot|acme|traefik'
# Certificats déjà émis (noms de domaines) — SANS afficher de clé
sudo ls -1 /etc/letsencrypt/live/ 2>/dev/null || docker run --rm -v /etc/letsencrypt:/le:ro alpine ls -1 /le/live 2>/dev/null
```

**Ce que j'en tire** : émettre les certs via certbot mutualisé (webroot) **ou**
si c'est du **Traefik** (labels), la stratégie change totalement (labels au lieu
de vhosts) — d'où le `grep traefik`.

---

## 6. Le PostgreSQL existant

Deux cas possibles — la recon distingue.

### 6a. Postgres **conteneurisé**
```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i postgres
PG=<nom_du_conteneur_pg>          # <-- adapte d'après la ligne ci-dessus
docker inspect "$PG" --format 'réseaux={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker exec "$PG" postgres --version
# Bases et rôles EXISTANTS (aucun mot de passe affiché) :
docker exec "$PG" psql -U postgres -c '\l' 2>/dev/null || echo "adapter l'utilisateur admin (-U ...)"
docker exec "$PG" psql -U postgres -c '\du' 2>/dev/null
docker inspect "$PG" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'   # où est le volume de données
```

### 6b. Postgres **service hôte** (hors Docker)
```bash
ss -ltnp 2>/dev/null | grep ':5432' || sudo ss -ltnp | grep ':5432'
systemctl status postgresql --no-pager 2>/dev/null | head -5
sudo -u postgres psql -c '\l' 2>/dev/null
sudo -u postgres psql -c '\du' 2>/dev/null
psql --version
```

**Ce que je cherche** : version (compat migrations), **sur quel réseau** on le
joint (nom de service DNS pour l'app), et s'il vaut mieux **créer une base + un
rôle dédiés** `humanbcorp` (recommandé, isolation) plutôt que partager une base
existante. Je te fournirai le `CREATE ROLE / CREATE DATABASE` une fois la version
connue. **Ne me donne pas les mots de passe existants.**

---

## 7. DNS des sous-domaines

```bash
for d in humanbcorp.com www.humanbcorp.com api.humanbcorp.com app.humanbcorp.com; do
  printf '%-28s %s\n' "$d" "$(dig +short "$d" | tr '\n' ' ')"
done
curl -s ifconfig.me; echo "  <- IP publique de CE serveur"
```

**Ce que je vérifie** : que chaque sous-domaine visé pointe déjà vers l'IP du
serveur (sinon certbot échouera). Si `api.` / `app.` n'existent pas encore, il
faudra créer les enregistrements A avant d'émettre les certs.

---

## 8. Registre d'images / build

```bash
# CI pousse déjà une image backend sur GHCR (cf. .github/workflows/deploy.yml).
# Le serveur peut-il puller ?
docker pull ghcr.io/edwintchakounte/humanbcorp:latest 2>&1 | tail -3
# Y a-t-il déjà un login registre ?
cat ~/.docker/config.json 2>/dev/null | grep -o '"[a-z0-9.]*":' | grep -v auths | head
```

**Ce que j'en tire** : builder les images **sur le serveur** (si RAM/CPU OK, §1)
ou **en CI puis pull** (comme l'actuel backend). Pour les 2 fronts Next, il n'y a
pas encore de Dockerfile ni de job CI → à créer selon ta préférence.

---

## Ce que je fais avec tes réponses

Une fois les sorties collées, je produis dans `deploy/` :
1. `docker-compose.prod.yml` **découplé** (api + vitrine + dashboard + qcluster +
   éventuel db), branché sur **ton** réseau partagé, **zéro port hôte** ;
2. les **3 blocs vhost** nginx (api / vitrine / dashboard) au format et à
   l'emplacement exacts de ton proxy, + la séquence certbot ;
3. les `Dockerfile` manquants pour `web/` et `dashboard/` (Next standalone) ;
4. un `RUNBOOK.md` pas-à-pas (ordre : DNS → réseau → images → up → vhost:80 →
   certs → vhost:443 → migrations → smoke-test `/api/v1/health/`).

### Décisions que j'attends de toi (en parallèle de la recon)
- **Sous-domaines** : `api.` / `app.` te vont, ou tu préfères d'autres noms
  (`dashboard.`, `admin.`) ? La vitrine reste sur l'apex `humanbcorp.com` ?
- **Postgres** : réutiliser le serveur PG existant (base+rôle dédiés) **ou**
  garder un conteneur Postgres à nous (plus simple, isolé) ?
- **Build des fronts** : sur le serveur, ou via CI/GHCR comme le backend ?

---

# ROUND 2 — reconnaissance ciblée (après le premier dump)

Faits établis au 1er dump : proxy = `backend-nginx-1` (net `backend_default`,
tient 80/443) · patron déjà déployé = projet `gathe-finance-prod`
(backend + 3 fronts Next + qcluster + db, images GHCR) · HumanB actuel =
monolithe `humanbcorp_web` + base `humanbcorp-humanbcorp_db-1`
(net `humanbcorp_internal`) · DNS : api/apex/www OK, `dashboard.` à créer.

Il me manque : (a) les montages + la config réelle du nginx central,
(b) le mécanisme TLS (aucun certbot vu en `docker ps`), (c) le **patron
gathe-finance** à copier, (d) les détails de la base HumanB.

```bash
# ---- a) nginx central : montages + comment les sites sont déclarés ----
NGINX=backend-nginx-1
docker inspect "$NGINX" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}){{"\n"}}{{end}}'
docker exec "$NGINX" sh -c 'ls -l /etc/nginx/conf.d/ 2>/dev/null'
docker exec "$NGINX" sh -c 'nginx -T 2>/dev/null | grep -E "server_name|proxy_pass|listen .*ssl|ssl_certificate " | sort -u'

# ---- b) TLS : certbot présent (même arrêté) ? certs déjà émis ? ----
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -iE 'certbot|acme|traefik' || echo "aucun certbot/traefik conteneur"
sudo ls -1 /etc/letsencrypt/live/ 2>/dev/null || echo "pas de /etc/letsencrypt sur l'hote"

# ---- c) LE PATRON : compose + vhost de gathe-finance (à copier) ----
docker inspect gathe-finance-prod-backend-1 --format 'workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}'
docker inspect gathe-finance-prod-site-1    --format 'compose={{index .Config.Labels "com.docker.compose.project.config_files"}}'
#   -> puis affiche ce compose (adapte le chemin ci-dessus) :
# cat <workdir>/docker-compose*.yml
#   -> et le bloc nginx de gathe-finance (cherche ses server_name dans le nginx -T ci-dessus)

# ---- d) base HumanB + réseaux de l'app actuelle ----
docker inspect humanbcorp_web --format 'nets={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker inspect humanbcorp-humanbcorp_db-1 --format 'img={{.Config.Image}} nets={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker exec humanbcorp-humanbcorp_db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\l" && psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt" | head -30'

# ---- DNS du sous-domaine dashboard ----
dig +short dashboard.humanbcorp.com
```

