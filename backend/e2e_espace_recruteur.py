"""E2E de l'espace recruteur (lecture seule, cloisonné) — in-process, SQLite dev.

Étape intermédiaire : une entreprise cliente (groupe Recruiter) suit SES offres
et candidatures, dossier complet + CV, sans jamais rien écrire ni voir le
périmètre d'un autre recruteur. On vérifie : le gate, le cloisonnement strict par
`owner`, le CV cloisonné, la lecture seule (405 en écriture), l'absence de notes
internes, l'overview restreint, l'attribution côté super-admin, et le profil
(module « Mes recrutements » exclusif).

Tout est déroulé dans une transaction ROLLBACK — aucune donnée n'est laissée.

Lancer : POSTGRES_DB= DEBUG=True ALLOWED_HOSTS='*' ../.venv_local/bin/python e2e_espace_recruteur.py
"""
import os
import time

import django

SFX = str(int(time.time()))[-6:]

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import Group, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from rest_framework.test import APIClient

from recruitment.models import Application, JobOffer
from sitecms.roles import RECRUITER_GROUP, profile_payload

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = fails = 0


def line(label, ok, extra=""):
    global step, fails
    step += 1
    if not ok:
        fails += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


def fake_cv(name):
    return SimpleUploadedFile(f"{name}.pdf", b"%PDF-1.4 fake cv", content_type="application/pdf")


print("\n" + "=" * 72)
print("  E2E ESPACE RECRUTEUR (LECTURE SEULE, CLOISONNÉ) — HBC-RH")
print("=" * 72)

try:
    with transaction.atomic():
        grp, _ = Group.objects.get_or_create(name=RECRUITER_GROUP)
        admin = User.objects.create_superuser(f"rhadmin-{SFX}", f"rhadmin-{SFX}@hbc.test", "x")
        rec_a = User.objects.create_user(f"reca-{SFX}", f"reca-{SFX}@ent.test", "x", first_name="UCB")
        rec_b = User.objects.create_user(f"recb-{SFX}", f"recb-{SFX}@ent.test", "x", first_name="Orange")
        rec_a.groups.add(grp)
        rec_b.groups.add(grp)
        intrus = User.objects.create_user(f"intrus-{SFX}", f"intrus-{SFX}@x.test", "x")  # ni recruteur

        # Offres : une par recruteur + une non attribuée (HBC en propre).
        off_a = JobOffer.objects.create(title=f"Dev A {SFX}", description="x", owner=rec_a)
        off_b = JobOffer.objects.create(title=f"Dev B {SFX}", description="x", owner=rec_b)
        off_hbc = JobOffer.objects.create(title=f"Dev HBC {SFX}", description="x", owner=None)

        # Candidatures : 2 sur A, 1 sur B, 1 spontanée (offer=null).
        app_a1 = Application.objects.create(
            offer=off_a, first_name="Awa", last_name="Diop", email=f"awa-{SFX}@m.test",
            phone="+237600", cover_letter="Motivée.", cv=fake_cv(f"cva1-{SFX}"),
            status=Application.Status.SHORTLISTED, rating=4,
        )
        Application.objects.create(
            offer=off_a, first_name="Ben", last_name="Kum", email=f"ben-{SFX}@m.test",
            cv=fake_cv(f"cva2-{SFX}"),
        )
        app_b1 = Application.objects.create(
            offer=off_b, first_name="Cé", last_name="Nga", email=f"ce-{SFX}@m.test",
            cv=fake_cv(f"cvb1-{SFX}"),
        )
        Application.objects.create(
            offer=None, first_name="Spon", last_name="Tané", email=f"sp-{SFX}@m.test",
            cv=fake_cv(f"cvsp-{SFX}"),
        )

        ca = APIClient(); ca.force_authenticate(user=admin)
        cA = APIClient(); cA.force_authenticate(user=rec_a)
        cB = APIClient(); cB.force_authenticate(user=rec_b)
        ci = APIClient(); ci.force_authenticate(user=intrus)

        # ── 1. Gate ───────────────────────────────────────────────────────
        print("\n── 1. Accès réservé aux recruteurs ──")
        line("Intrus (non-recruteur) refusé sur offres (403)",
             ci.get("/api/v1/rh/espace/offres/").status_code == 403)
        line("Intrus refusé sur candidatures (403)",
             ci.get("/api/v1/rh/espace/candidatures/").status_code == 403)
        line("Intrus refusé sur overview (403)",
             ci.get("/api/v1/rh/espace/overview/").status_code == 403)
        line("Recruteur A accède à ses offres (200)",
             cA.get("/api/v1/rh/espace/offres/").status_code == 200)

        # ── 2. Cloisonnement des offres ───────────────────────────────────
        print("\n── 2. Chacun ne voit QUE ses offres ──")
        ra = cA.get("/api/v1/rh/espace/offres/").json()
        ids_a = {o["id"] for o in ra["results"]} if isinstance(ra, dict) and "results" in ra else {o["id"] for o in ra}
        line("A voit son offre", off_a.id in ids_a)
        line("A ne voit pas l'offre de B", off_b.id not in ids_a)
        line("A ne voit pas l'offre HBC non attribuée", off_hbc.id not in ids_a)

        # ── 3. Cloisonnement des candidatures ─────────────────────────────
        print("\n── 3. Chacun ne voit QUE les candidats de ses offres ──")
        la = cA.get("/api/v1/rh/espace/candidatures/").json()
        rows_a = la["results"] if isinstance(la, dict) and "results" in la else la
        ids_app_a = {a["id"] for a in rows_a}
        line("A voit ses 2 candidats", len(rows_a) == 2, f"n={len(rows_a)}")
        line("A ne voit pas le candidat de B", app_b1.id not in ids_app_a)
        line("A ne voit aucune spontanée", all(a["offer"] is not None for a in rows_a))
        # dossier complet + PAS de notes internes
        d = next(a for a in rows_a if a["id"] == app_a1.id)
        line("Dossier complet : email/téléphone/lettre présents",
             bool(d["email"]) and d["phone"] == "+237600" and d["cover_letter"] == "Motivée.")
        line("CV disponible (url cloisonnée)", "/rh/espace/candidatures/" in (d["cv_url"] or ""))
        line("Statut/évaluation visibles", d["status_label"] == "Présélectionnée" and d["rating"] == 4)
        line("Aucune note interne exposée", "notes" not in d)

        # ── 4. CV cloisonné ───────────────────────────────────────────────
        print("\n── 4. Téléchargement du CV borné à ses candidats ──")
        line("A télécharge le CV de son candidat (200)",
             cA.get(f"/api/v1/rh/espace/candidatures/{app_a1.id}/cv/").status_code == 200)
        line("A ne peut PAS télécharger le CV du candidat de B (404)",
             cA.get(f"/api/v1/rh/espace/candidatures/{app_b1.id}/cv/").status_code == 404)
        line("A ne voit pas le détail du candidat de B (404)",
             cA.get(f"/api/v1/rh/espace/candidatures/{app_b1.id}/").status_code == 404)

        # ── 5. Lecture seule ──────────────────────────────────────────────
        print("\n── 5. Aucune écriture possible ──")
        line("POST offre refusé (405)",
             cA.post("/api/v1/rh/espace/offres/", {"title": "x", "description": "y"}, format="json").status_code == 405)
        line("PATCH candidature refusé (405)",
             cA.patch(f"/api/v1/rh/espace/candidatures/{app_a1.id}/", {"status": 5}, format="json").status_code == 405)
        line("DELETE candidature refusé (405)",
             cA.delete(f"/api/v1/rh/espace/candidatures/{app_a1.id}/").status_code == 405)
        app_a1.refresh_from_db()
        line("Statut inchangé après tentative", app_a1.status == Application.Status.SHORTLISTED)

        # ── 6. Overview restreint ─────────────────────────────────────────
        print("\n── 6. Overview restreint à son périmètre ──")
        ov = cA.get("/api/v1/rh/espace/overview/").json()
        line("A : 2 candidatures au total", ov["applications"]["total"] == 2, f"={ov['applications']['total']}")
        line("A : 1 offre", ov["offers"]["total"] == 1, f"={ov['offers']['total']}")
        ovb = cB.get("/api/v1/rh/espace/overview/").json()
        line("B : 1 candidature au total", ovb["applications"]["total"] == 1, f"={ovb['applications']['total']}")

        # ── 7. Attribution côté super-admin ───────────────────────────────
        print("\n── 7. Le super-admin attribue et liste les recruteurs ──")
        lr = ca.get("/api/v1/rh/recruteurs/").json()
        ids_rec = {u["id"] for u in lr}
        line("Liste des recruteurs contient A et B", rec_a.id in ids_rec and rec_b.id in ids_rec)
        line("Liste n'inclut pas l'intrus", intrus.id not in ids_rec)
        r = ca.patch(f"/api/v1/rh/offres/{off_hbc.id}/", {"owner": rec_a.id}, format="json")
        line("Attribution de l'offre HBC à A (200)", r.status_code == 200, f"HTTP {r.status_code}")
        line("owner_name renvoyé", r.json().get("owner_name") == "UCB")
        line("A voit désormais l'offre ré-attribuée",
             off_hbc.id in {o["id"] for o in (cA.get("/api/v1/rh/espace/offres/").json().get("results", []))})

        # ── 8. Profil : module exclusif ───────────────────────────────────
        print("\n── 8. Profil recruteur : périmètre strict ──")
        p = profile_payload(rec_a)
        line("profile.is_recruiter = True", p["is_recruiter"] is True)
        keys = {m["key"] for m in p["modules"]}
        line("Voit le module « Mes recrutements »", "rh_espace" in keys)
        line("Ne voit PAS le module RH super-admin", "rh" not in keys)
        line("Ne voit PAS les formations/paiements", "formations" not in keys and "paiements" not in keys)
        line("Son module est en lecture seule",
             all(not m["can_write"] for m in p["modules"] if m["key"] == "rh_espace"))
        # Un admin ne voit pas le module recruteur (il a /rh)
        pa = profile_payload(admin)
        line("Le super-admin ne voit pas « Mes recrutements »",
             "rh_espace" not in {m["key"] for m in pa["modules"]})

        transaction.set_rollback(True)  # aucune donnée laissée en base
except Exception as e:  # noqa: BLE001
    print(f"\n\033[91mEXCEPTION\033[0m {type(e).__name__}: {e}")
    fails += 1

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} OK — {fails} KO")
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
