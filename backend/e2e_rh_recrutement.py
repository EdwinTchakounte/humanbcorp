"""E2E de la gestion RH super-admin (Étape 5) — in-process, SQLite dev.

Le recrutement est un outil PLATEFORME du super-admin : aucun rattachement à un
espace/école. On vérifie le gate strict (seul le super-admin accède), le CRUD des
offres, le pipeline des candidatures (avancement / évaluation / affectation), le
fil de notes internes, le téléchargement contrôlé du CV, et la vue d'ensemble.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_rh_recrutement.py
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
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

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
print("  E2E RH & RECRUTEMENT (SUPER-ADMIN) — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
if admin is None:
    admin = User.objects.create_superuser(f"admin-{SFX}", f"admin-{SFX}@hbc.test", "x")
intrus = User.objects.create(username=f"intrus-{SFX}", email=f"intrus-{SFX}@hbc.test")  # ni admin ni staff

ca = APIClient(); ca.force_authenticate(user=admin)
ci = APIClient(); ci.force_authenticate(user=intrus)

# ── 1. Gate : seul le super-admin accède au module RH ────────────────────
print("\n── 1. Accès réservé au super-admin ──")
line("Non-admin refusé sur les offres (403)", ci.get("/api/v1/rh/offres/").status_code == 403)
line("Non-admin refusé sur les candidatures (403)", ci.get("/api/v1/rh/candidatures/").status_code == 403)
line("Non-admin refusé sur l'overview (403)", ci.get("/api/v1/rh/overview/").status_code == 403)
line("Super-admin accède aux offres (200)", ca.get("/api/v1/rh/offres/").status_code == 200)

# ── 2. CRUD des offres ───────────────────────────────────────────────────
print("\n── 2. Le super-admin gère les offres ──")
r = ca.post("/api/v1/rh/offres/", {
    "title": f"Formateur Data {SFX}", "description": "Animer des formations data.",
    "contract_type": "CDI", "department": "Pédagogie",
}, format="json")
line("Création d'offre (201)", r.status_code == 201, f"HTTP {r.status_code}")
offer_id = r.json().get("id")
slug = r.json().get("slug")
line("Slug auto-généré", bool(slug), f"slug={slug}")
r = ca.patch(f"/api/v1/rh/offres/{offer_id}/", {"is_published": False}, format="json")
line("Dépublication de l'offre", r.status_code == 200 and r.json().get("is_published") is False)

# ── 3. Décor : deux candidatures (dont une sur l'offre) ──────────────────
offer = JobOffer.objects.get(pk=offer_id)
appli = Application.objects.create(
    offer=offer, first_name="Awa", last_name="Diop", email=f"awa-{SFX}@mail.test",
    phone="+237600000000", cover_letter="Motivée.",
    cv=SimpleUploadedFile(f"cv-{SFX}.pdf", b"%PDF-1.4 fake cv", content_type="application/pdf"),
)
spont = Application.objects.create(
    first_name="Ben", email=f"ben-{SFX}@mail.test",
    cv=SimpleUploadedFile(f"cv2-{SFX}.pdf", b"%PDF-1.4 fake cv2", content_type="application/pdf"),
)

# ── 4. Pipeline : lister, filtrer, faire avancer, noter, affecter ────────
print("\n── 3. Pipeline des candidatures ──")
r = ca.get(f"/api/v1/rh/candidatures/?offer={offer_id}")
res = r.json().get("results", r.json()) if r.status_code == 200 else []
ids = {a["id"] for a in res}
line("Filtre par offre : voit la candidature liée, pas la spontanée",
     appli.id in ids and spont.id not in ids, f"ids={ids}")
r = ca.get("/api/v1/rh/candidatures/?spontaneous=true")
res = r.json().get("results", r.json())
line("Filtre spontanées : voit Ben, pas Awa",
     spont.id in {a["id"] for a in res} and appli.id not in {a["id"] for a in res})

r = ca.patch(f"/api/v1/rh/candidatures/{appli.id}/", {
    "status": Application.Status.SHORTLISTED, "rating": 4, "assigned_to": admin.id,
}, format="json")
ok = r.status_code == 200
d = r.json() if ok else {}
line("Avancement + évaluation + affectation", ok and d.get("status") == 2 and d.get("rating") == 4
     and d.get("assigned_to") == admin.id, f"HTTP {r.status_code} {d.get('status')}/{d.get('rating')}")
line("Coordonnées candidat en lecture seule (non modifiables)",
     ca.patch(f"/api/v1/rh/candidatures/{appli.id}/", {"email": "hack@x.test"},
              format="json").json().get("email") == f"awa-{SFX}@mail.test")
line("Évaluation hors bornes rejetée (400)",
     ca.patch(f"/api/v1/rh/candidatures/{appli.id}/", {"rating": 9}, format="json").status_code == 400)
line("Création directe interdite (405)",
     ca.post("/api/v1/rh/candidatures/", {"first_name": "X"}, format="json").status_code == 405)

# ── 5. Notes internes ────────────────────────────────────────────────────
print("\n── 4. Fil de notes internes ──")
r = ca.post(f"/api/v1/rh/candidatures/{appli.id}/notes/", {"body": "Excellent entretien."}, format="json")
line("Ajout d'une note (201)", r.status_code == 201, f"HTTP {r.status_code}")
line("Note vide rejetée (400)",
     ca.post(f"/api/v1/rh/candidatures/{appli.id}/notes/", {"body": "  "}, format="json").status_code == 400)
r = ca.get(f"/api/v1/rh/candidatures/{appli.id}/notes/")
notes = r.json()
line("Le fil renvoie la note + son auteur",
     len(notes) == 1 and notes[0]["body"] == "Excellent entretien." and notes[0]["author_name"],
     f"n={len(notes)}")

# ── 6. Téléchargement contrôlé du CV ─────────────────────────────────────
print("\n── 5. Téléchargement du CV (accès contrôlé) ──")
r = ca.get(f"/api/v1/rh/candidatures/{appli.id}/cv/")
line("Super-admin télécharge le CV (200)", r.status_code == 200, f"HTTP {r.status_code}")
line("Non-admin refusé sur le CV (403)",
     ci.get(f"/api/v1/rh/candidatures/{appli.id}/cv/").status_code == 403)

# ── 7. Vue d'ensemble ────────────────────────────────────────────────────
print("\n── 6. Vue d'ensemble du pipeline ──")
r = ca.get("/api/v1/rh/overview/")
ov = r.json() if r.status_code == 200 else {}
line("Overview accessible (200)", r.status_code == 200)
line("Le pipeline expose des étapes ordonnées", isinstance(ov.get("pipeline"), list) and len(ov["pipeline"]) >= 4)
line("Compteur d'offres cohérent (≥1)", ov.get("offers", {}).get("total", 0) >= 1)
line("Compteur de candidatures cohérent (≥2)", ov.get("applications", {}).get("total", 0) >= 2)

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + (f"  ({fails} échec(s))" if fails else ""))
print("=" * 72)
