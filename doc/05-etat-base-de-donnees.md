# État de la base de données — HBC-RH

> Instantané généré le **2026-07-07** depuis `backend/db.sqlite3` (base de développement locale).
> 103 tables, 168 migrations appliquées.

---

## 1. Configuration & environnement

| | Développement (local) | Production (serveur) |
|---|---|---|
| **Moteur** | SQLite (`backend/db.sqlite3`, ~1,4 Mo) | PostgreSQL 16-alpine |
| **Sélection** | `settings.py` bascule sur Postgres **si** `POSTGRES_DB` est défini, sinon SQLite | `POSTGRES_DB` fourni via `.env` |
| **Hôte** | fichier local | service `humanbcorp_db` (port 5432) |
| **Fichier** | `backend/db.sqlite3` | volume Docker `pgdata:/var/lib/postgresql/data` |

### Répertoires (volumes Docker en prod)
- `pgdata` → `/var/lib/postgresql/data` — données PostgreSQL (persistantes).
- `media_volume` → `/app/mediafiles` — médias uploadés (servis par le nginx central).

### Réseaux Docker en prod
- `internal` — réseau **privé**, non exposé : Django ⇄ PostgreSQL. La base n'est **jamais** joignable depuis l'extérieur.
- `proxy` (= `backend_default`, externe) — réseau **partagé** du nginx central ; seul `humanbcorp_web:8000` y est branché.

> La base de prod est isolée sur `internal` : aucun port Postgres publié, accès uniquement par le conteneur applicatif.

---

## 2. Contenu du site (app `sitecms` — le CMS)

C'est le cœur métier actuel. Tout est éditable depuis le dashboard.

| Table | Lignes | Rôle |
|---|---:|---|
| `sitecms_page` | **8** | Pages du site |
| `sitecms_section` | **30** | Sections (blocs typés) |
| `sitecms_card` | **97** | Cartes (contenus des sections) |
| `sitecms_article` | **6** | Articles de blog |
| `sitecms_mediaasset` | **51** | Médiathèque (photos importées) |
| `sitecms_sitesettings` | **1** | Réglages globaux (singleton) |

### Pages (8, toutes publiées `is_active=1`, toutes dans le menu)
| Ordre | Slug | Titre |
|---:|---|---|
| 0 | `accueil` | Human Brain Corporation-RH \| Libérer le potentiel humain |
| 1 | `a-propos` | À propos |
| 2 | `services` | Services |
| 3 | `realisations` | Réalisations |
| 4 | `blog` | Blog |
| 5 | `recrutement` | Recrutement |
| 6 | `equipe` | Équipe |
| 7 | `contact` | Contact |

### Sections par page (30 au total, toutes visibles)
- **accueil** (7) : hero · stats · about · services · gallery · features · cta
- **a-propos** (4) : hero · about · features · cta
- **services** (4) : hero · services · features · cta
- **realisations** (3) : hero · gallery · cta
- **blog** (2) : hero · cta
- **recrutement** (4) : hero · features · services · cta
- **equipe** (4) : hero · services · features · cta
- **contact** (2) : hero · contact

### Cartes par type de section (97 au total)
gallery 41 · features 16 · services 15 · about 11 · hero 7 · stats 4 · contact 3

### Articles de blog (6, tous publiés)
| Date | Catégorie | Titre |
|---|---|---|
| 2026-06-20 | Recrutement | 5 clés pour réussir vos recrutements |
| 2026-06-05 | Management | Fidéliser ses talents durablement |
| 2026-05-22 | Conformité | La conformité RH sans stress |
| 2026-05-08 | Recrutement | Réussir l'onboarding de vos recrues |
| 2026-04-18 | Formation | Former pour performer durablement |
| 2026-04-02 | Externalisation | Externaliser sa paie : mode d'emploi |

### Réglages du site (`SiteSettings`, singleton)
- **Marque** : Human Brain Corporation-RH — *« Libérer le potentiel humain »*
- **Adresse** : 300, Rue Foucault, Akwa-Douala — Douala, Cameroun
- **Téléphones** : +237 696 305 891 · +237 678 623 424 · +237 656 275 091
- **Email** : recrutementhbcrh@gmail.com · **WhatsApp** : 237696305891
- **Bilingue** : slogan/tagline EN renseignés (*Unlock human potential* / *Turn your HR challenges into opportunities*)

---

## 3. Comptes & authentification

- **37 utilisateurs** au total, **2 comptes staff/superuser** :
  - `fokam` (superuser historique, créé 2024-05-30)
  - `cmsadmin` (superuser CMS, créé 2026-07-06) — login dashboard
- `auth_group` : 8 groupes · `auth_permission` : 416 permissions
- Allauth présent mais **aucun compte social** (`socialaccount_*` = 0)
- 48 sessions actives

---

## 4. Autres apps (héritage du projet — hors périmètre RH actuel)

Le projet conserve les tables des apps d'origine (plateforme pédagogique « Algomaat »), **non utilisées** par la vitrine RH mais toujours présentes en base :

| Domaine | Tables notables | Volumétrie |
|---|---|---|
| Pédagogie | `lessonapp_*`, `SEQUENCE_*`, `material_*` | quelques dizaines de lignes, beaucoup à 0 |
| Contenus | `contents_publication` (10), `contents_space` (5), `bucket_*` | actif partiellement |
| Agenda | `calendarapp_event` (22), `calendarapp_meeting` (33) | actif |
| Paiement | `paiement_paiement` (5), `paiement_paiemententrant` (5) | actif |
| Chat | `chat_project` (2), `chat_chatmessage` (0) | peu utilisé |
| Docs (2 versions) | `document_*`, `materials_*` | **vides (0 partout)** — candidats à suppression |

> Les apps `materials_*` et `document_*` sont entièrement vides : elles peuvent être retirées lors d'un futur nettoyage sans perte de données.

---

## 5. Synthèse

- ✅ **Base de dev = SQLite** ; la prod utilisera **PostgreSQL 16** isolé sur le réseau `internal`, données sur le volume `pgdata`, médias sur `media_volume`.
- ✅ Le **CMS `sitecms` est entièrement peuplé** : 8 pages, 30 sections, 97 cartes, 6 articles, 51 médias, réglages complets et bilingues — tout piloté depuis le dashboard.
- ⚠️ La base traîne encore ~90 tables de l'ancien projet pédagogique, dont plusieurs totalement vides (nettoyage possible).
- 🔐 Accès admin CMS via `cmsadmin` (staff/superuser).
