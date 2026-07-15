"""E2E du modèle de cohorte (Flow B2) — in-process, SQLite dev.

Vérifie que la logique décidée est réellement encodée dans le modèle :
  - une Publication EST une session : mode, dates, capacité, durée d'accès ;
  - la capacité refuse les inscriptions au-delà des places ;
  - la durée d'accès est configurable PAR OFFRE et ne court pas du même point
    selon le mode : fin de session en cohorte, date d'achat en accès libre ;
  - un programme (Theme) n'est plus obligé d'appartenir à un trimestre scolaire.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_modele_cohorte.py
"""
import os
import time
from datetime import timedelta
from decimal import Decimal

import django

SFX = str(int(time.time()))[-6:]

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import User
from django.utils import timezone
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
print("  E2E MODÈLE DE COHORTE — HBC-RH")
print("=" * 72)

cat = Category.objects.first()
admin = User.objects.filter(is_superuser=True).first()
now = timezone.now()

# ── 1. Le programme se libère du squelette scolaire ──────────────────────
print("\n── 1. Un programme n'appartient plus à un trimestre scolaire ──")
theme = Theme.objects.create(title=f"Prog {SFX}", is_visible=True, t_type=1)  # sans sequence !
line("Formation créée SANS séquence ni catégorie scolaire", theme.pk is not None)
line("…et sa séquence est bien vide", theme.sequence is None)
Seance.objects.create(title=f"S1 {SFX}", theme=theme, s_type=0)

# ── 2. Capacité ──────────────────────────────────────────────────────────
print("\n── 2. Capacité : la session refuse au-delà des places ──")
petite = Publication.objects.create(
    title=f"Petite session {SFX}", description="2 places", price=Decimal("1000"),
    categorie=cat, is_private=False, mode=Publication.COHORTE,
    date_debut=now + timedelta(days=10), date_fin=now + timedelta(days=20), capacite=2,
)
petite.themes.add(theme)
line("Places restantes = capacité au départ", petite.places_restantes() == 2,
     f"{petite.places_restantes()}")

c = APIClient()
codes = []
for i in range(3):
    r = c.post("/api/v1/site/inscription/", {
        "formation_id": petite.id, "first_name": f"P{i}", "last_name": "X",
        "email": f"cap{i}-{SFX}@hbc.test", "phone": "691234567",
    }, format="json")
    codes.append(r.status_code)
line("Les 2 premières inscriptions passent", codes[:2] == [201, 201], str(codes))
line("La 3e est refusée : session complète (409)", codes[2] == 409, str(codes))
line("Places restantes tombées à 0", petite.places_restantes() == 0, f"{petite.places_restantes()}")
line("La session se déclare complète", petite.est_complete())

r = c.get(f"/api/v1/site/formations/{petite.id}/")
line("Le catalogue public annonce la session complète",
     r.data.get("complete") is True and r.data.get("places_restantes") == 0,
     f"complete={r.data.get('complete')} restantes={r.data.get('places_restantes')}")
line("…et expose les dates de session", r.data.get("date_debut") is not None)

# ── 3. Durée d'accès — cohorte : ancrée sur la FIN DE SESSION ────────────
print("\n── 3. Durée d'accès en cohorte : ancrée sur la fin de session ──")
finie = Publication.objects.create(
    title=f"Session finie {SFX}", description="terminée", price=Decimal("1000"),
    categorie=cat, is_private=False, mode=Publication.COHORTE,
    date_debut=now - timedelta(days=400), date_fin=now - timedelta(days=370),
    acces_duree_mois=6,  # fin + 6 mois = il y a ~6 mois → expiré
)
finie.themes.add(theme)
appr1 = User.objects.create(username=f"exp-{SFX}", email=f"exp-{SFX}@hbc.test", first_name="Exp")
ins1 = Inscription.objects.create(participant=appr1, publication=finie, status=Inscription.CONFIRMED)
line("Échéance calculée depuis la fin de session, pas depuis l'achat",
     finie.fin_acces(depuis=ins1.created_at).date() == (finie.date_fin + timedelta(days=182)).date()
     or finie.fin_acces(depuis=ins1.created_at) < now,
     str(finie.fin_acces(depuis=ins1.created_at)))

pc = APIClient()
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(appr1)}/formation/{finie.id}/")
line("Accès au contenu refusé après échéance (403)", r.status_code == 403, f"{r.status_code}")
line("…avec un motif explicite", r.data.get("acces_expire") is True, str(r.data.get("detail"))[:44])

esp = pc.get(f"/api/v1/site/mon-espace/{sign_member(appr1)}/")
f0 = next((f for f in esp.data["formations"] if f["publication_id"] == finie.id), None)
line("La formation reste listée, marquée expirée (l'apprenant comprend)",
     f0 is not None and f0["acces_expire"] is True)

# Session récente + même durée → toujours ouvert.
recente = Publication.objects.create(
    title=f"Session recente {SFX}", description="récente", price=Decimal("1000"),
    categorie=cat, is_private=False, mode=Publication.COHORTE,
    date_debut=now - timedelta(days=10), date_fin=now - timedelta(days=2), acces_duree_mois=6,
)
recente.themes.add(theme)
appr2 = User.objects.create(username=f"ok-{SFX}", email=f"ok-{SFX}@hbc.test", first_name="Ok")
Inscription.objects.create(participant=appr2, publication=recente, status=Inscription.CONFIRMED)
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(appr2)}/formation/{recente.id}/")
line("Session terminée récemment : accès toujours ouvert", r.status_code == 200, f"{r.status_code}")

# ── 4. Durée d'accès — accès libre : ancrée sur l'ACHAT ──────────────────
print("\n── 4. Accès libre : la durée court depuis l'achat (pas de fin de session) ──")
libre = Publication.objects.create(
    title=f"Auto-formation {SFX}", description="libre", price=Decimal("1000"),
    categorie=cat, is_private=False, mode=Publication.LIBRE, acces_duree_mois=12,
)
libre.themes.add(theme)
appr3 = User.objects.create(username=f"libre-{SFX}", email=f"libre-{SFX}@hbc.test", first_name="Lib")
ins3 = Inscription.objects.create(participant=appr3, publication=libre, status=Inscription.CONFIRMED)
fin3 = libre.fin_acces(depuis=ins3.created_at)
line("Échéance = achat + 12 mois", fin3 is not None and 360 <= (fin3 - ins3.created_at).days <= 370,
     f"{(fin3 - ins3.created_at).days} jours")
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(appr3)}/formation/{libre.id}/")
line("Achat récent en accès libre : contenu servi", r.status_code == 200, f"{r.status_code}")

# Ancienne inscription en accès libre → expirée.
vieille = Inscription.objects.create(participant=appr3, publication=libre, status=Inscription.CONFIRMED)
Inscription.objects.filter(pk=vieille.pk).update(created_at=now - timedelta(days=400))
vieille.refresh_from_db()
line("Achat de plus de 12 mois : échéance dépassée",
     libre.fin_acces(depuis=vieille.created_at) < now)

# ── 5. Accès à vie (durée non renseignée) ───────────────────────────────
print("\n── 5. Durée vide = accès à vie ──")
avie = Publication.objects.create(
    title=f"A vie {SFX}", description="à vie", price=Decimal("1000"),
    categorie=cat, is_private=False, mode=Publication.COHORTE,
    date_debut=now - timedelta(days=2000), date_fin=now - timedelta(days=1900),
)
avie.themes.add(theme)
appr4 = User.objects.create(username=f"vie-{SFX}", email=f"vie-{SFX}@hbc.test", first_name="Vie")
ins4 = Inscription.objects.create(participant=appr4, publication=avie, status=Inscription.CONFIRMED)
line("Aucune échéance calculée", avie.fin_acces(depuis=ins4.created_at) is None)
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(appr4)}/formation/{avie.id}/")
line("Session très ancienne mais accès à vie : contenu servi", r.status_code == 200, f"{r.status_code}")

# ── 6. Cohérence back-office ────────────────────────────────────────────
print("\n── 6. Le back-office refuse les incohérences ──")
ac = APIClient()
ac.force_authenticate(user=admin)
r = ac.patch(f"/api/v1/modules/publications/{recente.id}/",
             {"date_debut": (now + timedelta(days=30)).isoformat(),
              "date_fin": (now + timedelta(days=10)).isoformat()}, format="json")
line("Fin de session avant son début : refusé", r.status_code == 400, f"{r.status_code}")
r = ac.patch(f"/api/v1/modules/publications/{petite.id}/", {"capacite": 1}, format="json")
line("Capacité réduite sous le nombre d'inscrits : refusé", r.status_code == 400, f"{r.status_code}")
r = ac.patch(f"/api/v1/modules/publications/{libre.id}/",
             {"date_debut": now.isoformat()}, format="json")
line("Dates sur une offre en accès libre : refusé", r.status_code == 400, f"{r.status_code}")

# ── Nettoyage ────────────────────────────────────────────────────────────
for u in (appr1, appr2, appr3, appr4):
    Inscription.objects.filter(participant=u).delete()
    u.delete()
for p in (petite, finie, recente, libre, avie):
    Inscription.objects.filter(publication=p).delete()
    p.delete()
Seance.objects.filter(theme=theme).delete()
theme.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
