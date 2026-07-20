"""E2E du module d'audit (journal des actions) — in-process, transaction ROLLBACK.

On vérifie que : (1) une action sensible (changement de statut d'une candidature)
écrit une vraie ligne d'audit avec l'avant→après et l'acteur ; (2) l'API journal
est réservée au super-admin, filtrable (action/type/recherche) et paginée ;
(3) le journal est immuable ; (4) les réglages `AppSetting` sont lus dynamiquement.

Lancer : POSTGRES_DB= DEBUG=True ALLOWED_HOSTS='*' ../.venv_local/bin/python e2e_audit.py
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
from django.db import transaction
from rest_framework.test import APIClient

from apps_coop.audit.models import AuditLog, AppSetting
from apps_coop.audit.services import get_int_setting, record
from recruitment.models import Application, JobOffer

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
print("  E2E MODULE D'AUDIT (JOURNAL DES ACTIONS) — HBC-RH")
print("=" * 72)

try:
    with transaction.atomic():
        admin = User.objects.create_superuser(f"auditadm-{SFX}", f"aa-{SFX}@hbc.test", "x")
        intrus = User.objects.create_user(f"intrus-{SFX}", f"i-{SFX}@x.test", "x")
        offer = JobOffer.objects.create(title=f"Audit poste {SFX}", description="x")
        appli = Application.objects.create(
            offer=offer, first_name="Awa", last_name="Diop", email=f"awa-{SFX}@m.test",
            status=Application.Status.NEW,
        )

        ca = APIClient(); ca.force_authenticate(user=admin)
        ci = APIClient(); ci.force_authenticate(user=intrus)

        # ── 1. Une action sensible écrit une ligne d'audit ────────────────
        print("\n── 1. Traçage d'une action RH ──")
        n0 = AuditLog.objects.count()
        r = ca.patch(f"/api/v1/rh/candidatures/{appli.id}/",
                     {"status": Application.Status.SHORTLISTED, "rating": 4}, format="json")
        line("PATCH statut candidature (200)", r.status_code == 200, f"HTTP {r.status_code}")
        line("Une ligne d'audit a été écrite", AuditLog.objects.count() == n0 + 1)
        e = AuditLog.objects.latest("created_at")
        line("action = application.updated", e.action == "application.updated", e.action)
        line("entité correcte", e.entite_type == "Application" and e.entite_id == str(appli.id))
        line("acteur = l'admin", e.user_id == admin.id)
        line("avant→après du statut capturé",
             e.details.get("status") == [Application.Status.NEW, Application.Status.SHORTLISTED],
             str(e.details.get("status")))
        line("changement de note capturé", e.details.get("rating") == [None, 4], str(e.details.get("rating")))

        # ── 2. API journal : gate + lecture ───────────────────────────────
        print("\n── 2. API journal (super-admin, lecture seule) ──")
        line("Non-admin refusé (403)", ci.get("/api/v1/audit/journal/").status_code == 403)
        j = ca.get("/api/v1/audit/journal/")
        line("Super-admin accède (200)", j.status_code == 200)
        body = j.json()
        line("Réponse paginée", "results" in body and "count" in body)
        line("La ligne apparaît dans le journal",
             any(x["action"] == "application.updated" for x in body["results"]))

        # ── 3. Filtres + facettes ─────────────────────────────────────────
        print("\n── 3. Filtres et facettes ──")
        f = ca.get("/api/v1/audit/journal/?action=application.updated").json()
        line("Filtre par action", all(x["action"] == "application.updated" for x in f["results"]) and f["count"] >= 1)
        f2 = ca.get("/api/v1/audit/journal/?entite_type=Application").json()
        line("Filtre par type d'entité", all(x["entite_type"] == "Application" for x in f2["results"]))
        f3 = ca.get(f"/api/v1/audit/journal/?q=awa-{SFX}").json()  # recherche large (aucune ligne, mais 200)
        line("Recherche renvoie 200", "results" in f3)
        fac = ca.get("/api/v1/audit/journal/facets/").json()
        line("Facettes : actions distinctes", "application.updated" in fac["actions"])
        line("Facettes : types distincts", "Application" in fac["entite_types"])

        # ── 4. Immuabilité ────────────────────────────────────────────────
        print("\n── 4. Journal append-only ──")
        try:
            e.action = "hack"; e.save()
            line("Modification d'une ligne refusée", False, "modif acceptée !")
        except ValueError:
            line("Modification d'une ligne refusée", True)
        # pas d'endpoint d'écriture exposé
        line("POST sur le journal interdit (405)",
             ca.post("/api/v1/audit/journal/", {"action": "x"}, format="json").status_code == 405)
        line("DELETE sur une ligne interdit (405)",
             ca.delete(f"/api/v1/audit/journal/{e.id}/").status_code == 405)

        # ── 5. Réglages dynamiques ────────────────────────────────────────
        print("\n── 5. Réglages ajustables (AppSetting) ──")
        line("Défaut si absent", get_int_setting(f"seuil-{SFX}", 30) == 30)
        AppSetting.objects.create(key=f"seuil-{SFX}", value="90")
        line("Valeur lue dynamiquement", get_int_setting(f"seuil-{SFX}", 30) == 90)

        # ── 6. record() est défensif ──────────────────────────────────────
        print("\n── 6. Robustesse ──")
        before = AuditLog.objects.count()
        record(action="x" * 500, entite_type="Y" * 500, entite_id=None, user=None, details=None)
        line("record() tolère des entrées hors-normes sans lever", AuditLog.objects.count() == before + 1)

        transaction.set_rollback(True)
except Exception as e:  # noqa: BLE001
    print(f"\n\033[91mEXCEPTION\033[0m {type(e).__name__}: {e}")
    fails += 1

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} OK — {fails} KO")
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
