"""E2E du module monitoring (santé + activité) — in-process.

Vérifie : la sonde /health/ (publique, DB), le gate de l'overview (super-admin),
et la structure de la vue d'ensemble (services, paiements, activité, alertes).

Lancer : POSTGRES_DB= DEBUG=True ALLOWED_HOSTS='*' ../.venv_local/bin/python e2e_monitoring.py
"""
import os
import time

import django

SFX = str(int(time.time()))[-6:]
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import User
from rest_framework.test import APIClient

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
print("  E2E MONITORING (SANTÉ + ACTIVITÉ) — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
if admin is None:
    admin = User.objects.create_superuser(f"mon-{SFX}", f"mon-{SFX}@hbc.test", "x")
intrus = User.objects.create_user(f"intrus-{SFX}", f"i-{SFX}@x.test", "x")

anon = APIClient()
ci = APIClient(); ci.force_authenticate(user=intrus)
ca = APIClient(); ca.force_authenticate(user=admin)

print("\n── 1. Sonde /health/ (publique) ──")
h = anon.get("/api/v1/health/")
line("Health accessible sans auth (200)", h.status_code == 200, f"HTTP {h.status_code}")
hb = h.json()
line("Health : status ok + database ok", hb.get("status") == "ok" and hb.get("database") == "ok", str(hb))

print("\n── 2. Overview : réservé au super-admin ──")
line("Non-admin refusé (401/403)", ci.get("/api/v1/monitoring/overview/").status_code in (401, 403))
line("Anonyme refusé (401/403)", anon.get("/api/v1/monitoring/overview/").status_code in (401, 403))
o = ca.get("/api/v1/monitoring/overview/")
line("Super-admin accède (200)", o.status_code == 200, f"HTTP {o.status_code}")

print("\n── 3. Structure de la vue d'ensemble ──")
d = o.json() if o.status_code == 200 else {}
line("statut ∈ {ok, attention, critique}", d.get("statut") in ("ok", "attention", "critique"), str(d.get("statut")))
line("alertes est une liste", isinstance(d.get("alertes"), list))
serv = d.get("services", {})
line("services.database présent", serv.get("database") in ("ok", "down"))
line("services.scheduler présent", isinstance(serv.get("scheduler"), dict) and "running" in serv["scheduler"])
line("planifications détectées (setup_payment_crons)", serv.get("scheduler", {}).get("schedules", 0) >= 2,
     f"schedules={serv.get('scheduler', {}).get('schedules')}")
pay = d.get("paiements", {})
line("paiements : en_attente/bloques/valides_24h présents",
     all(k in pay for k in ("en_attente", "bloques", "valides_24h", "seuil_minutes")))
line("activite_recente est une liste", isinstance(d.get("activite_recente"), list))
line("compteurs webhooks/emails présents",
     "webhooks_erreurs_24h" in d and "emails_echec_24h" in d)

# nettoyage (l'intrus créé hors transaction)
intrus.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} OK — {fails} KO")
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
