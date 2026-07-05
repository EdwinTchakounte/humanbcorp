# ok_serveur/ — bundle prêt à déployer sur le VPS

Fichiers à copier sur le serveur pour la mise en production de `humanbcorp.com`.
Runbook complet et à jour : [`../doc/04-deploiement-humanbcorp.md`](../doc/04-deploiement-humanbcorp.md).

| Fichier | Destination sur le VPS | Phase |
|---------|------------------------|-------|
| `docker-compose.prod.yml` | `/home/humanbcorp/humanbcorp/docker-compose.prod.yml` | 4-5 |
| `.env` | `/home/humanbcorp/humanbcorp/.env` *(non versionné)* | 4 |
| `humanbcorp-nginx.conf` | à coller dans `/home/deploy/afrikamode/backend/deploy/nginx/default.conf` | 6-7 |
| `commandes.md` | fiche de toutes les commandes par phase (rien à copier — référence) | — |

> ⚠️ `.env` contient un `SECRET_KEY` déjà généré mais **`POSTGRES_PASSWORD` est un
> placeholder** (`CHANGE_ME_STRONG_PASSWORD`) — le renseigner **avant** le 1er `up -d`.

## Copier vers le serveur
Depuis ce poste (le `.env` est local, non poussé sur GitHub) :
```bash
# le stack (user humanbcorp)
scp ok_serveur/docker-compose.prod.yml ok_serveur/.env \
    humanbcorp@81.0.246.144:/home/humanbcorp/humanbcorp/

# le bloc nginx (à intégrer côté proxy central — droits admin)
scp ok_serveur/humanbcorp-nginx.conf humanbcorp@81.0.246.144:/tmp/
```

## Démarrer (phases 4-5, sur le VPS en `humanbcorp`)
```bash
cd /home/humanbcorp/humanbcorp
nano .env                                    # mettre un vrai POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=40 humanbcorp_web
```
Logs attendus : *Database is up* → *Applying database migrations* → *Collecting static files*
→ gunicorn **Listening at 0.0.0.0:8000**.

## TLS + routage (phases 6-7-8)
Voir l'en-tête de `humanbcorp-nginx.conf` et les étapes 6-8 du runbook.
