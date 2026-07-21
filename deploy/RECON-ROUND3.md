# Reconnaissance serveur — Round 3 (les 4 fichiers modèles)

> En root sur le VPS. Lecture seule. Colle-moi les 4 sorties.
> ⚠️ **Ne cat AUCUN `.env`** (secrets) — on ne veut que des chemins et des configs.

Objectif : récupérer le **patron exact** déjà en prod (gathe-finance) + la conf
nginx où brancher HumanB + le mécanisme TLS, pour écrire un déploiement calqué
sur ce qui marche déjà chez toi.

---

## 1. Le compose modèle (gathe-finance = même archi découplée)
```bash
cat /opt/gathe-finance/infra/docker-compose*.yml
```

## 2. Le vhost nginx à 3 sous-domaines de gathe-finance (à copier)
```bash
docker exec backend-nginx-1 cat /etc/nginx/conf.d/gathe-finance.conf
```

## 3. La conf nginx montée depuis l'hôte (où humanbcorp sera routé)
```bash
sudo cat /home/deploy/afrikamode/backend/deploy/nginx/default.conf
```
> Me montre comment `humanbcorp.com` est routé **aujourd'hui** (variables
> `$backend`/`$up`, map par host…) et s'il y a déjà un cert humanbcorp.

## 4. Où vit le stack HumanB actuel (pour réutiliser SON .env) + mécanisme TLS
```bash
# Chemin du stack humanbcorp actuel (dossier qui contient son .env + compose) :
docker inspect humanbcorp_web --format 'workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}
config={{index .Config.Labels "com.docker.compose.project.config_files"}}'

# Comment les certificats sont émis (aucun conteneur certbot permanent) :
grep -rniE 'certbot|letsencrypt|acme' /home/deploy/afrikamode /opt/gathe-finance 2>/dev/null \
  | grep -viE '\.pem|fullchain|privkey' | head -20
```
