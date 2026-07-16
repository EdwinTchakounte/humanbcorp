"""E2E du flux d'abonnement agenda — in-process, SQLite dev.

L'apprenant colle une URL dans Google Agenda ; ses séances s'y synchronisent, y
compris quand on les déplace. Le format iCalendar est strict et Google refuse un
flux mal formé SANS RIEN DIRE : ce test vérifie la structure autant que le fond.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_agenda_ics.py
"""
import os
import re
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
from sitecms.learner import sign_member, sign_member_calendar

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = fails = 0


def line(label, ok, extra=""):
    global step, fails
    step += 1
    if not ok:
        fails += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


def deplier(texte):
    """Annule le pliage RFC 5545 pour pouvoir chercher dans les valeurs."""
    return texte.replace("\r\n ", "").replace("\r\n", "\n")


print("\n" + "=" * 72)
print("  E2E FLUX D'AGENDA (iCalendar) — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
now = timezone.now()

theme = Theme.objects.create(title=f"Prog {SFX}", t_type=1, is_visible=True)
s1 = Seance.objects.create(title=f"Les bases {SFX}", theme=theme, s_type=0)
pub = Publication.objects.create(
    title=f"Session {SFX}", description="s", price=Decimal("1000"),
    categorie=Category.objects.first(), is_private=False, mode=Publication.COHORTE,
    date_debut=now + timedelta(days=10), date_fin=now + timedelta(days=14),
)
pub.themes.add(theme)

ev = Event.objects.create(user=admin, title="Cours", description="",
                          start_time=now + timedelta(days=10),
                          end_time=now + timedelta(days=10, hours=3), seance=s1)
Meeting.objects.create(event=ev, m_type=1, link_url="https://zoom.test/abc")
pub.events.add(ev)
# Un créneau de test ne doit jamais atterrir dans l'agenda de l'apprenant.
ev_test = Event.objects.create(user=admin, title=f"NE-PAS-DIFFUSER {SFX}", description="",
                               start_time=now + timedelta(days=11),
                               end_time=now + timedelta(days=11, hours=1), is_test=True)
pub.events.add(ev_test)

appr = User.objects.create(username=f"cal-{SFX}", email=f"cal-{SFX}@hbc.test", first_name="Ada")
ins = Inscription.objects.create(participant=appr, publication=pub, status=Inscription.CONFIRMED)

c = APIClient()
url = f"/api/v1/site/mon-espace/{sign_member_calendar(appr)}/agenda.ics"
r = c.get(url)
ics = r.content.decode()
plat = deplier(ics)

# ── 1. Un flux qu'un agenda accepte ─────────────────────────────────────
print("\n── 1. Le flux est un iCalendar valide ──")
line("Le flux est servi", r.status_code == 200, f"HTTP {r.status_code}")
line("Annoncé comme un calendrier", "text/calendar" in r["Content-Type"], r["Content-Type"])
line("Enveloppe VCALENDAR complète",
     ics.startswith("BEGIN:VCALENDAR") and ics.rstrip().endswith("END:VCALENDAR"))
line("Version et producteur déclarés", "VERSION:2.0" in ics and "PRODID:" in ics)
# Le CRLF n'est pas un détail : un flux en LF seul est rejeté.
line("Lignes terminées en CRLF (exigé, sinon rejet)",
     "\r\n" in ics and not re.search(r"(?<!\r)\n", ics))
lignes = [l for l in ics.split("\r\n") if l]
trop_longues = [l for l in lignes if len(l.encode("utf-8")) > 75]
line("Aucune ligne au-delà de 75 octets (pliage)", not trop_longues,
     f"{len(trop_longues)} ligne(s) trop longue(s)")
line("Le nom d'agenda est lisible", "X-WR-CALNAME:Mes formations" in plat)
line("Une fréquence de rafraîchissement est suggérée", "REFRESH-INTERVAL" in ics)
line("Le flux n'est pas mis en cache", "no-cache" in r["Cache-Control"], r["Cache-Control"])

# ── 2. Le contenu de la séance ──────────────────────────────────────────
print("\n── 2. La séance porte l'information utile ──")
line("Un événement est présent", plat.count("BEGIN:VEVENT") == 1,
     f"{plat.count('BEGIN:VEVENT')} événement(s)")
line("Intitulé « Séance 1 — … » (le rang du programme)",
     f"SUMMARY:Séance {s1.order} — Les bases {SFX}" in plat,
     [l for l in plat.split("\n") if l.startswith("SUMMARY")][:1])
line("La formation est nommée", pub.title in plat)
line("Le lien de visio est joignable", "https://zoom.test/abc" in plat)
line("Les dates sont en UTC", re.search(r"DTSTART:\d{8}T\d{6}Z", plat) is not None)
line("Un identifiant stable permet la mise à jour (pas de doublon)",
     f"UID:hbc-event-{ev.id}@" in plat)

# ── 3. Le cloisonnement du jeton ────────────────────────────────────────
print("\n── 3. Le flux n'ouvre QUE le planning ──")
# Le jeton d'agenda est distinct de celui du contenu : recopier le lien magique
# dans le flux annulerait ce cloisonnement — une fuite d'agenda deviendrait une
# fuite de la formation entière.
line("Le lien magique du contenu n'apparaît PAS dans le flux",
     "mon-espace/" not in plat and sign_member(appr)[:20] not in plat)
r2 = c.get(f"/api/v1/site/mon-espace/{sign_member(appr)}/agenda.ics")
line("Un jeton de contenu ne donne pas l'agenda (sels distincts)", r2.status_code == 404,
     f"HTTP {r2.status_code}")
r3 = c.get(f"/api/v1/site/mon-espace/{sign_member_calendar(appr)}/")
line("Un jeton d'agenda ne donne pas le contenu", r3.status_code == 404, f"HTTP {r3.status_code}")
r4 = c.get("/api/v1/site/mon-espace/nimporte-quoi/agenda.ics")
line("Un jeton forgé est rejeté", r4.status_code == 404, f"HTTP {r4.status_code}")

# ── 4. Ce qui ne doit pas y figurer ─────────────────────────────────────
print("\n── 4. Le flux ne diffuse pas n'importe quoi ──")
line("Les créneaux de test sont exclus", "NE-PAS-DIFFUSER" not in plat)

autre = Publication.objects.create(
    title=f"Autre session {SFX}", description="a", price=Decimal("1"),
    categorie=Category.objects.first(), is_private=False,
)
autre.themes.add(theme)
ev_autre = Event.objects.create(user=admin, title=f"AUTRE-COHORTE {SFX}", description="",
                                start_time=now + timedelta(days=12),
                                end_time=now + timedelta(days=12, hours=1))
autre.events.add(ev_autre)
plat2 = deplier(c.get(url).content.decode())
line("Le planning des autres cohortes n'y est pas", "AUTRE-COHORTE" not in plat2)

# ── 5. L'accès est revérifié à chaque requête ───────────────────────────
print("\n── 5. Une URL fuitée ne survit pas aux droits ──")
ins.status = Inscription.CANCEL
ins.save(update_fields=["status"])
vide = deplier(c.get(url).content.decode())
line("Inscription annulée : le flux se vide", "BEGIN:VEVENT" not in vide)
line("…mais reste un calendrier valide (pas d'erreur chez Google)",
     vide.startswith("BEGIN:VCALENDAR"))
ins.status = Inscription.CONFIRMED
ins.save(update_fields=["status"])

pub.acces_duree_mois = 1
pub.date_fin = now - timedelta(days=400)
pub.date_debut = now - timedelta(days=405)
pub.save()
expire = deplier(c.get(url).content.decode())
line("Accès expiré : le flux se vide aussi", "BEGIN:VEVENT" not in expire)

# ── 6. L'URL est donnée à l'apprenant ───────────────────────────────────
print("\n── 6. L'apprenant trouve son URL d'abonnement ──")
pub.acces_duree_mois = None
pub.save()
esp = c.get(f"/api/v1/site/mon-espace/{sign_member(appr)}/")
agenda_url = esp.data.get("agenda_url", "")
line("Son espace expose l'URL d'agenda", bool(agenda_url), agenda_url[:52] + "…")
line("…qui pointe bien le flux", agenda_url.endswith(".ics"))

# ── Nettoyage ────────────────────────────────────────────────────────────
Inscription.objects.filter(participant=appr).delete()
appr.delete()
Meeting.objects.filter(event=ev).delete()
pub.delete(); autre.delete()
ev.delete(); ev_test.delete(); ev_autre.delete()
Seance.objects.filter(theme=theme).delete()
theme.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
