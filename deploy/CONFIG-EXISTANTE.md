# Config existante à réutiliser dans l'évolution — sorties serveur

> **But** : capitaliser sur ce qui est **déjà configuré** côté ancien HumanB / VPS
> (nginx central, volumes média, base, variables, TLS) pour que le stack découplé
> s'y **greffe** au lieu de tout refaire.
>
> **Mode d'emploi** : lance chaque commande sur le serveur (root), puis **colle sa
> sortie dans le bloc ``` correspondant**, en dessous. Commandes en lecture seule.
> ⚠️ **Ne colle AUCUN secret** : pas de contenu de `.env`, pas de mot de passe /
> `SECRET_KEY` / clés Tara. On ne veut que des chemins, noms de volumes et confs.

---

## Acquis du round 1-2 (déjà connus, pour rappel)
- Proxy central : `backend-nginx-1` · réseau partagé `backend_default` · tient 80/443
- TLS : certs dans le volume `backend_certbot_certs`, webroot `backend_certbot_www`
  (aucun conteneur certbot permanent)
- Patron déjà en prod à copier : projet `gathe-finance-prod` (compose dans `/opt/gathe-finance/infra`)
- HumanB actuel : `humanbcorp_web` (sur `backend_default` + `humanbcorp_internal`)
  + base `humanbcorp-humanbcorp_db-1` (base `humanbcorp`)
- DNS OK : `api.`, `dashboard.`, apex + `www` → 81.0.246.144

---

## 1. Compose modèle (gathe-finance) — l'archi découplée déjà en place
```bash
cat /opt/gathe-finance/infra/docker-compose*.yml
```
<!-- COLLE LA SORTIE ICI -->
```

```

---

## 2. Vhost 3-sous-domaines de gathe-finance — le gabarit nginx à copier
```bash
docker exec backend-nginx-1 cat /etc/nginx/conf.d/gathe-finance.conf
```
<!-- COLLE LA SORTIE ICI -->
```

```

---

## 3. Conf nginx montée depuis l'hôte — routage ACTUEL de humanbcorp.com
```bash
sudo cat /home/deploy/afrikamode/backend/deploy/nginx/default.conf
```
<!-- COLLE LA SORTIE ICI (c'est ce fichier qu'on fera évoluer, sans casser les autres sites) -->
```

```

---

## 4. Emplacement du stack HumanB actuel (pour réutiliser SON compose + .env)
```bash
docker inspect humanbcorp_web --format 'workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}
config={{index .Config.Labels "com.docker.compose.project.config_files"}}'
# Puis liste (SANS cat du .env) ce que contient ce dossier :
ls -la <workdir_affiché_ci-dessus>
```
<!-- COLLE LA SORTIE ICI -->
```

```

---

## 5. Volumes de l'ancien HumanB à PRÉSERVER (média/static + données)
```bash
docker inspect humanbcorp_web --format '{{range .Mounts}}{{.Name}}  {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
docker volume ls | grep -i humanbcorp
```
<!-- COLLE LA SORTIE ICI (le volume média = fichiers uploadés référencés par la base ; à remonter tel quel) -->
```

```

---

## 6. Mécanisme d'émission des certificats (pas de certbot permanent)
```bash
grep -rniE 'certbot|letsencrypt|acme' /home/deploy/afrikamode /opt/gathe-finance 2>/dev/null \
  | grep -viE '\.pem|fullchain|privkey' | head -20
```
<!-- COLLE LA SORTIE ICI (me montre la commande docker run certbot réellement utilisée) -->
```

```

---

## 7. Variables d'env de l'ancien HumanB — SEULEMENT LES CLÉS (pas les valeurs)
> Pour savoir quelles variables existent déjà (à reprendre) sans révéler leurs valeurs.
```bash
docker inspect humanbcorp_web --format '{{range .Config.Env}}{{println .}}{{end}}' | cut -d= -f1 | sort
```
<!-- COLLE LA SORTIE ICI (uniquement les NOMS de variables ressortent avec cut -d= -f1) -->
```

```

---

### Ce que j'en ferai
À partir de ces 7 sorties, j'écris le déploiement **en réutilisant l'existant** :
même base, même `.env` (mêmes clés), **même volume média remonté**, vhosts greffés
dans `default.conf` sans toucher aux autres sites, certs via la même méthode que
tes autres projets. Rien n'est refait à zéro : le découplé **prolonge** l'ancien.
