"""E2E des séances datées (Flow B3) — in-process, SQLite dev.

Le modèle de vente est « sessions à dates fixes », mais une Seance n'a pas de
date : c'est un chapitre du programme, réutilisé d'une session à l'autre. La
date appartient à la cohorte. Le lien Event → Seance permet enfin de dire
« la séance 3 a lieu le 12 mars » — et « la même séance 3 a lieu le 4 juin »
pour l'autre cohorte, sans dupliquer le contenu.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_seances_datees.py
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
print("  E2E SÉANCES DATÉES — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
now = timezone.now()
c = APIClient()
c.force_authenticate(user=admin)

# ── Décor : un programme de 3 séances, vendu deux fois ───────────────────
print("\n── Décor : programme « Excel » (3 séances), vendu en mars et en juin ──")
theme = Theme.objects.create(title=f"Excel {SFX}", t_type=1, is_visible=True)
s1 = Seance.objects.create(title=f"Les bases {SFX}", theme=theme, s_type=0)
s2 = Seance.objects.create(title=f"Les formules {SFX}", theme=theme, s_type=0)
s3 = Seance.objects.create(title=f"Les graphiques {SFX}", theme=theme, s_type=0)
# Le rang doit être attribué même hors API (admin Django, script, import) :
# sinon la séance resterait à 0 et passerait devant toutes les autres.
line("Rangs attribués à la création hors API", [s1.order, s2.order, s3.order] == [1, 2, 3],
     f"{[s1.order, s2.order, s3.order]}")

cat = Category.objects.first()
mars = Publication.objects.create(title=f"Excel MARS {SFX}", description="mars",
                                  price=Decimal("1000"), categorie=cat, is_private=False,
                                  mode=Publication.COHORTE,
                                  date_debut=now + timedelta(days=30), date_fin=now + timedelta(days=40))
juin = Publication.objects.create(title=f"Excel JUIN {SFX}", description="juin",
                                  price=Decimal("1000"), categorie=cat, is_private=False,
                                  mode=Publication.COHORTE,
                                  date_debut=now + timedelta(days=120), date_fin=now + timedelta(days=130))
mars.themes.add(theme)
juin.themes.add(theme)

# ── 1. Dater une séance ─────────────────────────────────────────────────
print("\n── 1. Un créneau désigne la séance qu'il couvre ──")
r = c.post("/api/v1/modules/events/", {
    "title": "Cours", "start_time": now + timedelta(days=30),
    "end_time": now + timedelta(days=30, hours=3), "publication": mars.id, "seance": s3.id,
}, format="json")
line("Créneau créé sur la séance 3", r.status_code == 201, f"HTTP {r.status_code}")
line("L'API renvoie le titre de la séance", r.data.get("seance_title") == s3.title,
     str(r.data.get("seance_title")))
line("…et son rang (« Séance 3 »)", r.data.get("seance_order") == 3, str(r.data.get("seance_order")))
ev_mars = Event.objects.get(pk=r.data["id"])
Meeting.objects.create(event=ev_mars, m_type=1, link_url="https://zoom.test/mars")

# ── 2. La même séance, une autre date, pour l'autre cohorte ─────────────
print("\n── 2. La MÊME séance à une autre date pour l'autre cohorte ──")
r = c.post("/api/v1/modules/events/", {
    "title": "Cours", "start_time": now + timedelta(days=120),
    "end_time": now + timedelta(days=120, hours=3), "publication": juin.id, "seance": s3.id,
}, format="json")
line("La séance 3 est aussi datée pour juin", r.status_code == 201, f"HTTP {r.status_code}")
line("Le contenu n'est PAS dupliqué (même séance)", r.data.get("seance") == s3.id)
ev_juin = Event.objects.get(pk=r.data["id"])

# ── 3. Refus des rattachements incohérents ──────────────────────────────
print("\n── 3. On ne date pas la séance d'un autre programme ──")
autre = Theme.objects.create(title=f"Autre {SFX}", t_type=1, is_visible=True)
s_autre = Seance.objects.create(title=f"Hors sujet {SFX}", theme=autre, s_type=0)
r = c.post("/api/v1/modules/events/", {
    "title": "X", "start_time": now, "end_time": now,
    "publication": mars.id, "seance": s_autre.id,
}, format="json")
line("Séance d'un programme non vendu par la session : refusée", r.status_code == 400,
     f"HTTP {r.status_code}")
r = c.post("/api/v1/modules/events/", {
    "title": "X", "start_time": now, "end_time": now, "seance": s1.id,
}, format="json")
line("Séance sans session : refusée", r.status_code == 400, f"HTTP {r.status_code}")

# Un créneau sans séance reste possible (réunion, examen, rattrapage).
r = c.post("/api/v1/modules/events/", {
    "title": f"Réunion {SFX}", "start_time": now, "end_time": now, "publication": mars.id,
}, format="json")
line("Un créneau sans séance reste possible (réunion, examen…)", r.status_code == 201,
     f"HTTP {r.status_code}")
ev_reunion = Event.objects.get(pk=r.data["id"]) if r.status_code == 201 else None

# ── 4. Ce que voit l'apprenant ──────────────────────────────────────────
print("\n── 4. L'apprenant lit « Séance 3 — le 12 mars » ──")
appr = User.objects.create(username=f"appr-{SFX}", email=f"appr-{SFX}@hbc.test", first_name="Ada")
Inscription.objects.create(participant=appr, publication=mars, status=Inscription.CONFIRMED)
pc = APIClient()
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(appr)}/formation/{mars.id}/")
line("Espace apprenant accessible", r.status_code == 200, f"{r.status_code}")
sched = r.data.get("schedule", [])
cours = next((s for s in sched if s.get("seance_id") == s3.id), None)
line("Le planning identifie la séance couverte", cours is not None)
if cours:
    line("…avec son rang", cours.get("seance_order") == 3, str(cours.get("seance_order")))
    line("…son titre", cours.get("seance_title") == s3.title, str(cours.get("seance_title")))
    line("…sa date", cours.get("start_time") is not None)
    line("…et son lien visio", any(m["link_url"] for m in cours.get("meetings", [])))
reunion = next((s for s in sched if s.get("seance_id") is None), None)
line("Un créneau sans séance reste affiché (sans rang)", reunion is not None)

# L'apprenant de mars ne voit QUE la date de mars pour cette séance.
dates = [s["start_time"] for s in sched if s.get("seance_id") == s3.id]
line("Une seule date pour sa cohorte (pas celle de juin)", len(dates) == 1, f"{len(dates)} date(s)")

# ── 5. Symétrie côté cohorte de juin ────────────────────────────────────
print("\n── 5. L'autre cohorte voit sa propre date pour la même séance ──")
appr2 = User.objects.create(username=f"appr2-{SFX}", email=f"appr2-{SFX}@hbc.test", first_name="Bob")
Inscription.objects.create(participant=appr2, publication=juin, status=Inscription.CONFIRMED)
r = pc.get(f"/api/v1/site/mon-espace/{sign_member(appr2)}/formation/{juin.id}/")
sched2 = r.data.get("schedule", [])
c2 = next((s for s in sched2 if s.get("seance_id") == s3.id), None)
line("La cohorte de juin voit la même séance…", c2 is not None)
line("…à SA date, différente de celle de mars",
     c2 is not None and cours is not None and c2["start_time"] != cours["start_time"],
     f"mars={cours and str(cours['start_time'])[:10]} / juin={c2 and str(c2['start_time'])[:10]}")
line("…et le lien visio de mars ne fuit pas",
     not any("zoom.test/mars" in (m.get("link_url") or "") for s in sched2 for m in s.get("meetings", [])))

# ── Nettoyage ────────────────────────────────────────────────────────────
Inscription.objects.filter(participant__in=[appr, appr2]).delete()
appr.delete(); appr2.delete()
Meeting.objects.filter(event__in=[ev_mars, ev_juin]).delete()
Event.objects.filter(title__contains=SFX).delete()
ev_mars.delete(); ev_juin.delete()
if ev_reunion:
    ev_reunion.delete()
mars.delete(); juin.delete()
Seance.objects.filter(theme__in=[theme, autre]).delete()
theme.delete(); autre.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
