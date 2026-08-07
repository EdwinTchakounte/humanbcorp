---
noteId: "mise-en-ligne-humanbcorp"
tags: [deploiement, ops, humanbcorp, seed, connexion]
---

# 🚀 Mise en ligne sur **humanbcorp.com** — pull + seeds + comptes de connexion

Cible : **humanbcorp.com** (domaine actuellement en ligne). Les images fraîchement
buildées (merge PR #2, run CI vert) pointent déjà sur `api.humanbcorp.com` → **rien à
re-baker**, il suffit de tirer les images et relancer.

Hôtes : vitrine `humanbcorp.com` · API `api.humanbcorp.com` · dashboard `dashboard.humanbcorp.com`.
Projet Docker **`humanbcorp`** (`/home/humanbcorp/humanbcorp/`). Reverse-proxy central
**`backend-nginx-1`** → **reload only, JAMAIS recreate** (mutualisé).

---

## 1. Pull + relance des conteneurs (mêmes commandes qu'avant)

```bash
cd /home/humanbcorp/humanbcorp

docker compose -p humanbcorp -f docker-compose.prod.yml pull
docker compose -p humanbcorp -f docker-compose.prod.yml up -d
docker compose -p humanbcorp -f docker-compose.prod.yml ps        # tout "running"
```
> L'entrypoint API joue migrations + collectstatic au démarrage. Le `.env` n'est pas touché.

---

## 2. Comptes de connexion (inline — idempotent, marche avec l'image actuelle)

> Déjà créés lors du précédent passage ; relancer ne duplique pas et réaligne juste les
> mots de passe. À coller tel quel :

```bash
docker exec -i humanbcorp_api python manage.py shell <<'PY'
from django.contrib.auth.models import Group, User

# admin (superuser)
admin, _ = User.objects.get_or_create(
    username="admin",
    defaults={"email": "admin@hbc.test", "first_name": "Admin", "last_name": "HBC"})
admin.is_staff = admin.is_superuser = True
admin.set_password("Admin@HBC2026"); admin.save()

# formateur (groupe Teacher)
tg, _ = Group.objects.get_or_create(name="Teacher")
f, _ = User.objects.get_or_create(
    username="formateur1",
    defaults={"email": "formateur1@hbc.test", "first_name": "Fatou", "last_name": "Formatrice"})
f.is_staff = True; f.set_password("Formateur@HBC2026"); f.save(); f.groups.add(tg)

# apprenants
for i in (1, 2):
    u, _ = User.objects.get_or_create(
        username=f"apprenant{i}",
        defaults={"email": f"apprenant{i}@hbc.test", "first_name": f"App{i}", "last_name": "Renant"})
    u.set_password("Apprenant@HBC2026"); u.save()

print("Comptes OK:", list(User.objects.values_list("username", flat=True)))
PY
```

### 🔑 Identifiants (à saisir sur `https://humanbcorp.com/connexion`)

| Rôle | Identifiant | Mot de passe | Redirection après connexion |
|---|---|---|---|
| **Admin** | `admin` | `Admin@HBC2026` | → dashboard (complet) |
| **Formateur** | `formateur1` | `Formateur@HBC2026` | → dashboard (périmètre restreint) |
| **Apprenant** | `apprenant1` | `Apprenant@HBC2026` | → son espace (vitrine) |
| **Apprenant** | `apprenant2` | `Apprenant@HBC2026` | → son espace (vitrine) |

> **Le bouton « Connexion » de la vitrine est désormais unifié** : il redirige
> automatiquement selon le profil (staff → dashboard, apprenant → espace).

---

## 3. (optionnel) Recharger le contenu de démo

Utile seulement si le catalogue est vide. Commandes de gestion (déjà dans l'image) :
```bash
docker exec humanbcorp_api python manage.py seed_site --force   # vitrine (pages/sections)
docker exec humanbcorp_api python manage.py import_media        # photos
docker exec humanbcorp_api python manage.py seed_fees           # frais de paiement
```
> ⚠️ **PAS** `seed_rates` (module absent → erreur). `seed_algorithmique.py` est gitignoré
> (contenu de démo) → **absent de l'image** : à ignorer en prod, on garde le vrai catalogue.

### Lien magique d'un apprenant (accès sans mot de passe)
```bash
docker exec -i humanbcorp_api python manage.py shell <<'PY'
from django.contrib.auth.models import User
from django.core import signing
u = User.objects.get(username="apprenant1")
print("https://humanbcorp.com/mon-espace/" + signing.dumps({"member": u.pk}, salt="sitecms.learner.member"))
PY
```

---

## 4. Reload nginx — **reload only, jamais recreate**

Nécessaire seulement si la conf nginx a changé, ou pour re-résoudre les upstreams :
```bash
docker exec backend-nginx-1 nginx -t         # valider AVANT
docker exec backend-nginx-1 nginx -s reload  # à chaud, sans coupure
```
> ❌ Pas de `up -d --force-recreate nginx` ni `restart` du proxy (couperait les autres sites).

---

## 5. Vérifications (hôtes humanbcorp.com)

```bash
curl -I https://api.humanbcorp.com/api/v1/health/     # 200 {"status":"ok"...}
curl -I https://humanbcorp.com/                       # 200 (vitrine, nouveau design)
curl -I https://dashboard.humanbcorp.com/             # 200/307 (login)
```

Puis dans le navigateur (Ctrl+Shift+R pour vider le cache) :
1. `https://humanbcorp.com` → **nouveau design** (hero XL, stats en dégradé, en-tête verre).
2. `https://humanbcorp.com/connexion` → tester **admin / formateur / apprenant** (tableau §2).

> ⚠️ Ne jamais cliquer « Payer » au checkout : vrai paiement Tara (fonds réels).
> ⚠️ Cible horus-lab.com à la place ? → il faut d'abord poser les variables CI + rebuild
> (cf. `deploy/BASCULE-HORUS-LAB.md`) ; les images actuelles sont pour humanbcorp.com.
