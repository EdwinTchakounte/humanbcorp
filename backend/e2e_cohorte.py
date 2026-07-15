"""E2E du cloisonnement par cohorte (Flow B1) — in-process, SQLite dev.

Une même formation (Theme) vendue deux fois — session de mars, session de juin —
doit donner à chaque apprenant SON planning et à lui seul. Le calendrier est
porté par la cohorte (`Publication.events`), pas par le programme : le
rattachement historique par `EventTheme` faisait fuiter les dates et les liens
visio d'une session à l'autre.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_cohorte.py
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

from lessonapp.models import Theme, Seance, Categorie, Sequence
from contents.models import Publication, Category
from bucket.models import Inscription
from calendarapp.models import Event, Meeting
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
print("  E2E CLOISONNEMENT PAR COHORTE — HBC-RH")
print("=" * 72)

# ── Décor : 1 programme, 2 sessions ──────────────────────────────────────
print("\n── Décor : un programme « Excel » vendu en mars ET en juin ──")
theme = Theme.objects.create(
    title=f"Excel {SFX}", is_visible=True, t_type=1,
    categorie=Categorie.objects.first(), sequence=Sequence.objects.first(),
)
Seance.objects.create(title=f"Séance 1 {SFX}", theme=theme, s_type=0)

cat = Category.objects.first()
mars = Publication.objects.create(title=f"Excel MARS {SFX}", description="session de mars",
                                  price=Decimal("1000"), categorie=cat, is_private=False)
juin = Publication.objects.create(title=f"Excel JUIN {SFX}", description="session de juin",
                                  price=Decimal("1000"), categorie=cat, is_private=False)
mars.themes.add(theme)
juin.themes.add(theme)
line("Le même programme est vendu par 2 cohortes", theme.publications.count() == 2)

admin = User.objects.filter(is_superuser=True).first()
ev_mars = Event.objects.create(user=admin, title=f"Cours MARS {SFX}",
                               start_time=timezone.now() + timedelta(days=10),
                               end_time=timezone.now() + timedelta(days=10, hours=2))
ev_juin = Event.objects.create(user=admin, title=f"Cours JUIN {SFX}",
                               start_time=timezone.now() + timedelta(days=100),
                               end_time=timezone.now() + timedelta(days=100, hours=2))
Meeting.objects.create(event=ev_mars, m_type=0, link_url="https://meet.test/mars-secret")
mars.events.add(ev_mars)
juin.events.add(ev_juin)

appr_mars = User.objects.create(username=f"mars-{SFX}", email=f"mars-{SFX}@hbc.test", first_name="Marc")
appr_juin = User.objects.create(username=f"juin-{SFX}", email=f"juin-{SFX}@hbc.test", first_name="Julie")
Inscription.objects.create(participant=appr_mars, publication=mars, status=Inscription.CONFIRMED)
Inscription.objects.create(participant=appr_juin, publication=juin, status=Inscription.CONFIRMED)

pub_c = APIClient()


def planning(user, pub):
    r = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(user)}/formation/{pub.id}/")
    return r, [s["title"] for s in r.data.get("schedule", [])]


# ── 1. Chaque apprenant ne voit que SON planning ─────────────────────────
print("\n── 1. Cloisonnement du planning ──")
r, vus_mars = planning(appr_mars, mars)
line("Espace apprenant (mars) accessible", r.status_code == 200, f"{r.status_code}")
line("L'apprenant de mars voit son propre créneau", any("MARS" in v for v in vus_mars), str(vus_mars))
line("…et PAS celui de juin (fuite fermée)", not any("JUIN" in v for v in vus_mars), str(vus_mars))

r, vus_juin = planning(appr_juin, juin)
line("Symétriquement, l'apprenant de juin ne voit que juin",
     any("JUIN" in v for v in vus_juin) and not any("MARS" in v for v in vus_juin), str(vus_juin))

# Le lien visio est la donnée sensible : il ne doit pas traverser les cohortes.
r_juin = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(appr_juin)}/formation/{juin.id}/")
liens = [m["link_url"] for s in r_juin.data.get("schedule", []) for m in s.get("meetings", [])]
line("Le lien visio de mars ne fuit pas chez l'apprenant de juin",
     not any("mars-secret" in (l or "") for l in liens), str(liens))

# ── 2. Le contenu, lui, reste partagé (c'est le but) ─────────────────────
print("\n── 2. Le programme reste commun aux deux sessions ──")
r_m = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(appr_mars)}/formation/{mars.id}/")
r_j = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(appr_juin)}/formation/{juin.id}/")
titres_m = [t["title"] for t in r_m.data["themes"]]
titres_j = [t["title"] for t in r_j.data["themes"]]
line("Les deux cohortes lisent le même programme (écrit une fois)",
     titres_m == titres_j == [theme.title], f"{titres_m} / {titres_j}")
line("Le planning n'est plus dupliqué sous chaque thème",
     all("schedule" not in t for t in r_m.data["themes"]))

# ── 3. Back-office : participants = les inscrits de CETTE cohorte ────────
print("\n── 3. Participants d'un créneau = les inscrits de sa cohorte ──")
c = APIClient()
c.force_authenticate(user=admin)
r = c.get(f"/api/v1/modules/events/{ev_mars.id}/participants/")
emails = [p["email"] for p in r.data]
line("Le créneau de mars liste l'apprenant de mars", appr_mars.email in emails, str(emails)[:60])
line("…et n'expose pas l'apprenant de juin", appr_juin.email not in emails, str(emails)[:60])

r = c.get(f"/api/v1/modules/events/{ev_mars.id}/")
line("L'API expose la cohorte du créneau", r.data.get("publication_id") == mars.id,
     f"publication_id={r.data.get('publication_id')}")

# ── 4. Périmètre formateur sur les cohortes ─────────────────────────────
print("\n── 4. Sécurité : un formateur ne rattache pas un créneau hors périmètre ──")
formateur = User.objects.filter(username="formateur1").first()
if formateur:
    formateur.formations_animees.clear()
    fc = APIClient()
    fc.force_authenticate(user=formateur)
    payload = {"title": f"Sonde {SFX}", "start_time": timezone.now(), "end_time": timezone.now(),
               "publication": mars.id}
    r = fc.post("/api/v1/modules/events/", payload, format="json")
    line("Formateur non affecté : rattachement refusé", r.status_code == 403, f"{r.status_code}")

    theme.instructors.add(formateur)
    r = fc.post("/api/v1/modules/events/", payload, format="json")
    line("Formateur affecté au programme vendu : autorisé", r.status_code == 201, f"{r.status_code}")
    if r.status_code == 201:
        Event.objects.filter(pk=r.data["id"]).delete()
    formateur.formations_animees.clear()

# ── Nettoyage ────────────────────────────────────────────────────────────
Inscription.objects.filter(participant__in=[appr_mars, appr_juin]).delete()
appr_mars.delete(); appr_juin.delete()
mars.delete(); juin.delete()
Meeting.objects.filter(event__in=[ev_mars, ev_juin]).delete()
ev_mars.delete(); ev_juin.delete()
Seance.objects.filter(theme=theme).delete()
theme.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
