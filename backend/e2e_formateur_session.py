"""E2E du formateur rattaché à la SESSION (Flow B4) — in-process, SQLite dev.

Deux rôles étaient fusionnés par accident : **écrire** un programme et
**animer** une cohorte. Avec des sessions datées, Paul anime Excel en mars et
Marie en juin — chacun ne doit voir que ses apprenants et son planning, alors
qu'ils partagent le même programme.

  Theme.instructors       → auteurs du programme (droit d'édition)
  Publication.instructors → animateurs de la session (suivi + agenda)

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_formateur_session.py
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
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework.test import APIClient

from lessonapp.models import Theme, Seance, Activity
from lessonapp.models.bloc import Bloc
from contents.models import Publication, Category
from bucket.models import Inscription
from calendarapp.models import Event
from material.models import ActivityProgress

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
print("  E2E FORMATEUR PAR SESSION — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
teacher_group, _ = Group.objects.get_or_create(name="Teacher")
now = timezone.now()

# ── Décor : 1 programme, 2 sessions, 2 animateurs ────────────────────────
print("\n── Décor : Excel animé par Paul en mars, par Marie en juin ──")
theme = Theme.objects.create(title=f"Excel {SFX}", is_visible=True, t_type=1)
seance = Seance.objects.create(title=f"S1 {SFX}", theme=theme, s_type=0)
bloc = Bloc.objects.create(title="b", created_by=admin, categorie=Bloc.ACTIVITY)
act = Activity.objects.create(title=f"A1 {SFX}", seance=seance, bloc=bloc, a_type=3)

cat = Category.objects.first()
mars = Publication.objects.create(title=f"Excel MARS {SFX}", description="mars",
                                  price=Decimal("1000"), categorie=cat, is_private=False,
                                  date_debut=now + timedelta(days=5), date_fin=now + timedelta(days=9))
juin = Publication.objects.create(title=f"Excel JUIN {SFX}", description="juin",
                                  price=Decimal("1000"), categorie=cat, is_private=False,
                                  date_debut=now + timedelta(days=95), date_fin=now + timedelta(days=99))
mars.themes.add(theme)
juin.themes.add(theme)

paul = User.objects.create(username=f"paul-{SFX}", email=f"paul-{SFX}@hbc.test", first_name="Paul")
marie = User.objects.create(username=f"marie-{SFX}", email=f"marie-{SFX}@hbc.test", first_name="Marie")
paul.groups.add(teacher_group)
marie.groups.add(teacher_group)
mars.instructors.add(paul)
juin.instructors.add(marie)

# Un apprenant par session.
a_mars = User.objects.create(username=f"am-{SFX}", email=f"am-{SFX}@hbc.test", first_name="AppMars")
a_juin = User.objects.create(username=f"aj-{SFX}", email=f"aj-{SFX}@hbc.test", first_name="AppJuin")
Inscription.objects.create(participant=a_mars, publication=mars, status=Inscription.CONFIRMED)
Inscription.objects.create(participant=a_juin, publication=juin, status=Inscription.CONFIRMED)
ActivityProgress.objects.create(learner=a_mars, activity=act, completed=True)
ActivityProgress.objects.create(learner=a_juin, activity=act, completed=True)

ev_mars = Event.objects.create(user=admin, title=f"Cours MARS {SFX}",
                               start_time=now + timedelta(days=5), end_time=now + timedelta(days=5, hours=2))
ev_juin = Event.objects.create(user=admin, title=f"Cours JUIN {SFX}",
                               start_time=now + timedelta(days=95), end_time=now + timedelta(days=95, hours=2))
mars.events.add(ev_mars)
juin.events.add(ev_juin)

cp, cm = APIClient(), APIClient()
cp.force_authenticate(user=paul)
cm.force_authenticate(user=marie)

# ── 1. Suivi cloisonné par session ──────────────────────────────────────
print("\n── 1. Le suivi ne mélange plus les cohortes ──")
r = cp.get("/api/v1/modules/suivi/")
titres = [f["title"] for f in r.data["formations"]]
line("Paul accède au suivi", r.status_code == 200, f"{r.status_code}")
line("Paul voit SA session (mars)", mars.title in titres, str(titres)[:70])
line("…et PAS celle de Marie (juin)", juin.title not in titres, str(titres)[:70])

emails = [l["email"] for f in r.data["formations"] for l in f["learners"]]
line("Paul voit son apprenant de mars", a_mars.email in emails, str(emails)[:60])
line("…et jamais l'apprenant de juin", a_juin.email not in emails, str(emails)[:60])

r = cm.get("/api/v1/modules/suivi/")
emails_m = [l["email"] for f in r.data["formations"] for l in f["learners"]]
line("Symétrie : Marie voit juin et pas mars",
     a_juin.email in emails_m and a_mars.email not in emails_m, str(emails_m)[:60])

# Le suivi situe la session dans le temps (c'est une cohorte, pas un programme).
f0 = next((f for f in cp.get("/api/v1/modules/suivi/").data["formations"] if f["title"] == mars.title), None)
line("Le suivi expose les dates de la session", f0 is not None and f0.get("date_debut") is not None)
line("…et le programme derrière la session", f0 is not None and theme.title in (f0.get("programmes") or []),
     str(f0 and f0.get("programmes")))

# ── 2. Agenda cloisonné par session ─────────────────────────────────────
print("\n── 2. L'agenda suit la session animée ──")
r = cp.get("/api/v1/modules/events/")
data = r.data.get("results", r.data)
noms = [e["title"] for e in data]
line("Paul voit le créneau de mars", any("MARS" in n for n in noms), str(noms)[:60])
line("…et pas celui de juin", not any("JUIN" in n for n in noms), str(noms)[:60])

r = cp.post("/api/v1/modules/events/", {
    "title": f"Sonde {SFX}", "start_time": now, "end_time": now, "publication": juin.id,
}, format="json")
line("Paul ne peut pas poser un créneau sur la session de Marie", r.status_code == 403, f"{r.status_code}")
r = cp.post("/api/v1/modules/events/", {
    "title": f"OK {SFX}", "start_time": now, "end_time": now, "publication": mars.id,
}, format="json")
line("…mais bien sur la sienne", r.status_code == 201, f"{r.status_code}")
if r.status_code == 201:
    Event.objects.filter(pk=r.data["id"]).delete()

# ── 3. Écrire ≠ animer ──────────────────────────────────────────────────
print("\n── 3. Les deux rôles sont bien distincts ──")
# Paul anime mars mais n'est PAS auteur du programme : il ne l'édite pas.
r = cp.patch(f"/api/v1/modules/seances/{seance.id}/", {"title": "Piraté"}, format="json")
line("Animateur non auteur : ne peut pas éditer le programme", r.status_code in (403, 404), f"{r.status_code}")

theme.instructors.add(paul)  # Paul devient aussi auteur
r = cp.patch(f"/api/v1/modules/seances/{seance.id}/", {"title": f"S1 {SFX}"}, format="json")
line("Auteur du programme : édition autorisée", r.status_code == 200, f"{r.status_code}")

# Auteur d'un programme mais animateur d'aucune session de juin → pas ses apprenants.
r = cp.get("/api/v1/modules/suivi/")
emails = [l["email"] for f in r.data["formations"] for l in f["learners"]]
line("Être auteur du programme ne donne PAS les apprenants des autres sessions",
     a_juin.email not in emails, str(emails)[:60])

# ── Nettoyage ────────────────────────────────────────────────────────────
ActivityProgress.objects.filter(learner__in=[a_mars, a_juin]).delete()
Inscription.objects.filter(participant__in=[a_mars, a_juin]).delete()
for u in (a_mars, a_juin, paul, marie):
    u.delete()
mars.delete(); juin.delete()
ev_mars.delete(); ev_juin.delete()
Activity.objects.filter(seance=seance).delete()
seance.delete(); theme.delete(); bloc.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
