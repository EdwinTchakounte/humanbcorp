"""E2E de l'inscription manuelle (Flow C) — in-process, SQLite dev.

Le parcours normal passe par une commande et un paiement. Sans porte de sortie,
trois cas réels étaient impossibles : offrir une place, inscrire une cohorte
interne, corriger une erreur. Le back-office était en lecture seule, et le
Django admin — seul recours — n'envoie pas le lien d'accès : l'apprenant se
retrouvait inscrit sans moyen d'entrer.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_inscription_manuelle.py
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

from lessonapp.models import Theme, Seance
from contents.models import Publication, Category
from bucket.models import Inscription
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
print("  E2E INSCRIPTION MANUELLE — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
c = APIClient()
c.force_authenticate(user=admin)

theme = Theme.objects.create(title=f"Prog {SFX}", t_type=1, is_visible=True)
Seance.objects.create(title=f"S1 {SFX}", theme=theme, s_type=0)
pub = Publication.objects.create(
    title=f"Session {SFX}", description="s", price=Decimal("50000"),
    categorie=Category.objects.first(), is_private=False, capacite=2,
)
pub.themes.add(theme)
EMAIL = f"offert-{SFX}@hbc.test"

# ── 1. Offrir une place ─────────────────────────────────────────────────
print("\n── 1. Offrir une place, sans passer par un paiement ──")
r = c.post("/api/v1/modules/inscriptions/inscrire/", {
    "email": EMAIL, "first_name": "Ada", "last_name": "Lovelace", "publication": pub.id,
}, format="json")
line("Apprenant inscrit à la main", r.status_code == 201, f"HTTP {r.status_code}")
line("Le lien d'accès lui est envoyé", r.data.get("lien_envoye") is True,
     str(r.data.get("detail"))[:46])

ins = Inscription.objects.filter(publication=pub).first()
line("L'inscription est directement confirmée", ins and ins.status == Inscription.CONFIRMED,
     f"status={ins and ins.status}")
line("…sans aucune commande ni paiement",
     not ins.participant.order_set.exists() if hasattr(ins.participant, "order_set") else True)

# ── 2. L'apprenant accède réellement au contenu ─────────────────────────
print("\n── 2. L'apprenant peut réellement entrer ──")
u = User.objects.get(email=EMAIL)
pc = APIClient()
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(u)}/")
line("Son espace s'ouvre", r.status_code == 200, f"HTTP {r.status_code}")
line("La session offerte y figure",
     any(f["publication_id"] == pub.id for f in r.data.get("formations", [])))
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(u)}/formation/{pub.id}/")
line("Et le contenu est servi", r.status_code == 200, f"HTTP {r.status_code}")

# ── 3. Pas de doublon ───────────────────────────────────────────────────
print("\n── 3. Deux fois le même apprenant : refusé, pas dupliqué ──")
r = c.post("/api/v1/modules/inscriptions/inscrire/", {
    "email": EMAIL, "first_name": "Ada", "publication": pub.id,
}, format="json")
line("Second appel refusé", r.status_code == 409, f"HTTP {r.status_code}")
line("Une seule inscription en base", Inscription.objects.filter(publication=pub).count() == 1,
     f"{Inscription.objects.filter(publication=pub).count()}")

# ── 4. Une inscription abandonnée est reprise, pas dupliquée ────────────
print("\n── 4. Un paiement abandonné se confirme au lieu de créer un doublon ──")
EMAIL2 = f"abandon-{SFX}@hbc.test"
u2 = User.objects.create(username=EMAIL2, email=EMAIL2, first_name="Bob")
Inscription.objects.create(participant=u2, publication=pub, status=Inscription.WAITING)
r = c.post("/api/v1/modules/inscriptions/inscrire/", {
    "email": EMAIL2, "first_name": "Bob", "publication": pub.id,
}, format="json")
line("L'inscription en attente est confirmée", r.status_code == 201, f"HTTP {r.status_code}")
line("…sans créer de seconde ligne",
     Inscription.objects.filter(participant=u2, publication=pub).count() == 1,
     f"{Inscription.objects.filter(participant=u2, publication=pub).count()}")

# ── 5. La capacité reste une capacité ───────────────────────────────────
print("\n── 5. Une place offerte reste une place ──")
line("Les 2 places sont prises", pub.places_restantes() == 0, f"{pub.places_restantes()}")
r = c.post("/api/v1/modules/inscriptions/inscrire/", {
    "email": f"trop-{SFX}@hbc.test", "first_name": "Trop", "publication": pub.id,
}, format="json")
line("Une 3e inscription sur une session complète est refusée", r.status_code == 409,
     f"HTTP {r.status_code}")
line("…avec une consigne exploitable", "capacité" in str(r.data.get("detail", "")).lower(),
     str(r.data.get("detail"))[:52])

# ── 6. Renvoyer le lien ─────────────────────────────────────────────────
print("\n── 6. Renvoyer le lien (e-mail perdu) ──")
r = c.post(f"/api/v1/modules/inscriptions/{ins.pk}/renvoyer-lien/")
line("Lien renvoyé", r.status_code == 200 and r.data.get("lien_envoye") is True, f"HTTP {r.status_code}")

en_attente = Inscription.objects.create(
    participant=User.objects.create(username=f"att-{SFX}", email=f"att-{SFX}@hbc.test"),
    publication=pub, status=Inscription.WAITING,
)
r = c.post(f"/api/v1/modules/inscriptions/{en_attente.pk}/renvoyer-lien/")
line("Pas de lien pour une inscription non confirmée", r.status_code == 400, f"HTTP {r.status_code}")

# ── 7. Périmètre ────────────────────────────────────────────────────────
print("\n── 7. Sécurité : réservé aux administrateurs ──")
formateur = User.objects.filter(username="formateur1").first()
if formateur:
    fc = APIClient()
    fc.force_authenticate(user=formateur)
    r = fc.post("/api/v1/modules/inscriptions/inscrire/", {
        "email": f"pirate-{SFX}@hbc.test", "first_name": "X", "publication": pub.id,
    }, format="json")
    line("Un formateur ne peut pas inscrire", r.status_code == 403, f"HTTP {r.status_code}")
    r = fc.post(f"/api/v1/modules/inscriptions/{ins.pk}/renvoyer-lien/")
    line("…ni renvoyer un lien d'accès", r.status_code in (403, 404), f"HTTP {r.status_code}")

anon = APIClient()
r = anon.post("/api/v1/modules/inscriptions/inscrire/", {
    "email": f"anon-{SFX}@hbc.test", "publication": pub.id,
}, format="json")
line("Un anonyme non plus", r.status_code in (401, 403), f"HTTP {r.status_code}")

# ── Nettoyage ────────────────────────────────────────────────────────────
Inscription.objects.filter(publication=pub).delete()
User.objects.filter(email__contains=SFX).delete()
pub.delete()
Seance.objects.filter(theme=theme).delete()
theme.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
