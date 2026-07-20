"""E2E des comptes apprenants (Étape 4) — mot de passe classique, in-process.

Un apprenant ayant souscrit peut désormais **activer un vrai compte** (mot de
passe) depuis son lien magique, puis se connecter par e-mail + mot de passe pour
retrouver ses ressources — c'est par ce compte que passe l'accès scopé. On
vérifie : marquage apprenant à la création, impossibilité de se connecter tant
que le compte n'est pas activé, activation, connexion JWT, accès aux ressources
confirmées via le compte, et isolation (un apprenant ne voit que SES formations).

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_apprenant_compte.py
"""
import os
import time
from decimal import Decimal

import django

SFX = str(int(time.time()))[-6:]

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from lessonapp.models import Theme, Seance, Activity
from lessonapp.models.bloc import Bloc
from contents.models import Publication, Category
from bucket.models import Inscription
from espaces.models import Espace
from sitecms.public_catalog import _guest_user
from sitecms.learner import sign_member

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = fails = 0


def line(label, ok, extra=""):
    global step, fails
    step += 1
    if not ok:
        fails += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


print("\n" + "=" * 72)
print("  E2E COMPTES APPRENANTS (MOT DE PASSE) — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
if admin is None:
    admin = User.objects.create_superuser(f"admin-{SFX}", f"admin-{SFX}@hbc.test", "x")
cat = Category.objects.first() or Category.objects.create(name=f"cat-{SFX}")
ecole = Espace.objects.create(nom=f"École {SFX}", is_active=True)


def formation(titre):
    pub = Publication.objects.create(title=titre, description="d", price=Decimal("1000"),
                                     categorie=cat, is_private=False, espace=ecole)
    theme = Theme.objects.create(title=f"T-{titre}", is_visible=True, t_type=1)
    pub.themes.add(theme)
    seance = Seance.objects.create(title=f"S-{titre}", theme=theme, s_type=0)
    bloc = Bloc.objects.create(title="b", created_by=admin, categorie=Bloc.ACTIVITY)
    act = Activity.objects.create(title=f"A-{titre}", seance=seance, bloc=bloc, a_type=3)
    return pub, act


# Décor : deux apprenants, chacun sa formation confirmée.
pub_a, act_a = formation(f"Alice {SFX}")
pub_b, act_b = formation(f"Bob {SFX}")

alice = _guest_user(email=f"alice-{SFX}@hbc.test", first_name="Alice", last_name="M")
bob = _guest_user(email=f"bob-{SFX}@hbc.test", first_name="Bob", last_name="N")
Inscription.objects.create(participant=alice, publication=pub_a, status=Inscription.CONFIRMED)
Inscription.objects.create(participant=bob, publication=pub_b, status=Inscription.CONFIRMED)

PWD = "s3cret-apprenant"
c = APIClient()

# ── 1. À la souscription : étiquette apprenant, pas encore de mot de passe ─
print("\n── 1. L'invité est marqué apprenant, sans mot de passe utilisable ──")
alice.refresh_from_db()
line("Alice est dans le groupe Learner", alice.groups.filter(name__iexact="Learner").exists())
line("…et n'a pas de mot de passe utilisable", not alice.has_usable_password())

# ── 2. Impossible de se connecter tant que le compte n'est pas activé ─────
print("\n── 2. Connexion refusée avant activation ──")
r = c.post("/api/v1/site/apprenant/login/", {"username": alice.username, "password": PWD}, format="json")
line("Login refusé (compte non activé)", r.status_code == 401, f"HTTP {r.status_code}")

# ── 3. Activation du mot de passe depuis le lien magique ──────────────────
print("\n── 3. Activation via le lien magique ──")
token = sign_member(alice)
r = c.post(f"/api/v1/site/mon-espace/{token}/compte/", {"password": "court"}, format="json")
line("Mot de passe trop court rejeté (400)", r.status_code == 400, f"HTTP {r.status_code}")
r = c.post(f"/api/v1/site/mon-espace/{token}/compte/", {"password": PWD}, format="json")
line("Activation acceptée", r.status_code == 200 and r.json().get("ok") is True, f"HTTP {r.status_code}")
alice.refresh_from_db()
line("Alice a désormais un mot de passe utilisable", alice.has_usable_password())

# ── 4. Connexion par e-mail + mot de passe → JWT apprenant ────────────────
print("\n── 4. Connexion et claim is_learner ──")
r = c.post("/api/v1/site/apprenant/login/", {"username": alice.username, "password": PWD}, format="json")
ok_login = r.status_code == 200 and "access" in r.json()
line("Login réussi (JWT émis)", ok_login, f"HTTP {r.status_code}")
data = r.json() if ok_login else {}
line("Réponse marque is_learner=True", data.get("is_learner") is True)
access = data.get("access")

# ── 5. Accès aux ressources via le compte authentifié ─────────────────────
print("\n── 5. L'espace apprenant est servi via le compte (JWT) ──")
c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
r = c.get("/api/v1/site/apprenant/mon-espace/")
line("mon-espace authentifié : accès OK", r.status_code == 200, f"HTTP {r.status_code}")
body = r.json() if r.status_code == 200 else {}
pubs = {f["publication_id"] for f in body.get("formations", [])}
line("Alice voit SA formation", pub_a.id in pubs, f"pubs={pubs}")
line("…et pas celle de Bob", pub_b.id not in pubs)
f_a = next((f for f in body.get("formations", []) if f["publication_id"] == pub_a.id), {})
line("La formation porte le nom de l'école", f_a.get("ecole") == ecole.nom, f"ecole={f_a.get('ecole')}")
line("has_account=True dans le profil", body.get("learner", {}).get("has_account") is True)

r = c.get(f"/api/v1/site/apprenant/formation/{pub_a.id}/")
line("Contenu de sa formation servi", r.status_code == 200 and r.json().get("themes"), f"HTTP {r.status_code}")

# ── 6. Isolation : pas d'accès à la formation d'un autre apprenant ────────
print("\n── 6. Isolation par souscription ──")
r = c.get(f"/api/v1/site/apprenant/formation/{pub_b.id}/")
line("Formation de Bob refusée à Alice (403)", r.status_code == 403, f"HTTP {r.status_code}")

# ── 7. Écriture scopée : progression sur son activité, pas sur une autre ──
print("\n── 7. Progression scopée (compte authentifié) ──")
r = c.post(f"/api/v1/site/apprenant/activite/{act_a.id}/terminer/", {"done": True}, format="json")
line("Alice marque SON activité terminée", r.status_code == 200 and r.json().get("completed") is True,
     f"HTTP {r.status_code}")
r = c.post(f"/api/v1/site/apprenant/activite/{act_b.id}/terminer/", {"done": True}, format="json")
line("…mais pas une activité de Bob (403)", r.status_code == 403, f"HTTP {r.status_code}")

# ── 8. Le lien magique historique fonctionne toujours (non-régression) ────
print("\n── 8. Le lien magique reste opérationnel ──")
c.credentials()  # retire le JWT
r = c.get(f"/api/v1/site/mon-espace/{token}/")
line("mon-espace par lien magique : toujours OK", r.status_code == 200, f"HTTP {r.status_code}")

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + (f"  ({fails} échec(s))" if fails else ""))
print("=" * 72)
