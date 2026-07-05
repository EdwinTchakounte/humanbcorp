# 00 — Analyse initiale du projet

_Date : 2026-07-04_

## Contexte

Le répertoire `HumanB/` contient une application **Django 5.0** héritée du projet
« Algomaat » (à l'origine une plateforme e-learning de code pour enfants). L'objectif
est de la **rebrander en site vitrine RH** pour **Human Brain Corporation-RH** et de la
**déployer sur humanbcorp.com**.

## Stack technique

| Élément | Détail |
|---------|--------|
| Framework | Django 5.0 + Django REST Framework |
| Temps réel | Channels + Daphne (chat WebSocket) — **non prioritaire** en prod |
| Auth | django-allauth (login Google OAuth) |
| Statics | WhiteNoise |
| Base de données | SQLite en dev → **PostgreSQL** en prod |
| Serveur applicatif | Gunicorn (WSGI) |

## Applications Django présentes

`contents`, `bucket`, `registration`, `calendarapp`, `abstracts`, `material`,
`lessonapp`, `chat`, `paiement`. Le back-office (dashboard, cours, chat, paiement)
est conservé tel quel ; seule la **partie publique (landing + habillage global)**
est rebrandée dans ce volet.

## Point de départ « vue actuelle »

- **`Algomaat/templates/base.html`** : squelette commun (nav, footer, meta, modale).
  Identité orange (`--brand: #ff4d29`), logo `LOGO.png`, textes « Algomaat / cours pour enfants ».
- **`Algomaat/templates/home.html`** : page d'accueil (hero slider, à propos, services
  « programmation / robotique », chiffres, portfolio).
- **`Algomaat/static/css/STYle2.css`** : styles, variable de marque `--brand`.
- **CTA principal** : modale « Réservez un cours d'essai gratuit » → `registration.send_email`.

## Ressources fournies (dossier `ressources/`)

- `logo.png` — logo **HBC** (marine + or).
- `Human Brain Corporation (1).pdf` — plaquette avec le positionnement, les services
  et les coordonnées à intégrer (voir [01-charte-graphique-hbc.md](01-charte-graphique-hbc.md)).

## Déjà en place (volet déploiement, session précédente)

`Dockerfile`, `entrypoint.sh`, `docker-compose.yml`, `nginx/default.conf`,
`.dockerignore`, `.env.example`, workflow GitHub Actions `.github/workflows/deploy.yml`
(build + push GHCR), `requirements.txt` nettoyé/épinglé, `settings.py` adapté
(PostgreSQL + sécurité par variables d'env). Ces éléments sont **ré-adaptés** au
domaine humanbcorp.com dans ce volet (voir [04-deploiement-humanbcorp.md](04-deploiement-humanbcorp.md)).

## Sécurité — dette identifiée

Le fichier `.env` historique (secrets Algomaat : SECRET_KEY, Google OAuth, mot de passe
Gmail) a été committé en clair par le passé. Il est désormais **hors suivi git**. Ces
secrets doivent être **révoqués/régénérés** (rappel dans le doc de déploiement).
