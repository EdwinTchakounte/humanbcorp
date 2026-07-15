"""E2E de l'ordre pédagogique (Flow A) — in-process, SQLite dev.

Vérifie que le rang des séances/activités est explicite, stable, et **identique
entre l'éditeur (dashboard) et l'espace apprenant** — le défaut d'origine étant
un tri implicite par ordre d'insertion, non garanti par la base.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_ordre_pedagogique.py
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

from lessonapp.models import Seance, Activity, Theme, Categorie, Sequence
from contents.models import Publication
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


def titles(payload_seances):
    return [s["title"] for s in payload_seances]


print("\n" + "=" * 72)
print("  E2E ORDRE PÉDAGOGIQUE — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first() or User.objects.get(username="fokam")
c = APIClient()
c.force_authenticate(user=admin)

# ── 1. Création : le rang suit l'ordre d'ajout ───────────────────────────
print("\n── 1. Création : chaque nouvel élément est ajouté à la suite ──")
theme = Theme.objects.create(
    title=f"Ordre E2E {SFX}", is_visible=True, t_type=1,
    categorie=Categorie.objects.first(),  # FK non-nullables
    sequence=Sequence.objects.first(),
)

created = []
for name in ("Alpha", "Beta", "Gamma"):
    r = c.post("/api/v1/modules/seances/", {"title": f"{name} {SFX}", "theme": theme.id, "s_type": 0}, format="json")
    created.append(r.data)
line("3 séances créées", all(s.get("id") for s in created))
line("Rangs attribués 1,2,3 à la création", [s["order"] for s in created] == [1, 2, 3],
     f"order={[s.get('order') for s in created]}")

r = c.get(f"/api/v1/modules/seances/?theme={theme.id}")
line("Liste API triée Alpha→Beta→Gamma",
     titles(r.data["results"] if "results" in r.data else r.data) == [f"Alpha {SFX}", f"Beta {SFX}", f"Gamma {SFX}"])

# ── 2. Réorganisation ────────────────────────────────────────────────────
print("\n── 2. Réorganisation (monter / descendre) ──")
alpha, beta, gamma = created

r = c.post(f"/api/v1/modules/seances/{gamma['id']}/reorder/", {"direction": "up"}, format="json")
line("Gamma monte d'un rang", r.status_code == 200 and r.data.get("moved") is True, f"{r.status_code}")
r = c.get(f"/api/v1/modules/seances/?theme={theme.id}")
got = titles(r.data["results"] if "results" in r.data else r.data)
line("Nouvel ordre Alpha→Gamma→Beta", got == [f"Alpha {SFX}", f"Gamma {SFX}", f"Beta {SFX}"], str(got))

r = c.post(f"/api/v1/modules/seances/{alpha['id']}/reorder/", {"direction": "up"}, format="json")
line("Monter le 1er élément est sans effet (butée)", r.status_code == 200 and r.data.get("moved") is False)
r = c.post(f"/api/v1/modules/seances/{beta['id']}/reorder/", {"direction": "down"}, format="json")
line("Descendre le dernier est sans effet (butée)", r.status_code == 200 and r.data.get("moved") is False)

# ── 3. Insertion tardive : la nouvelle séance NE passe PAS devant ────────
print("\n── 3. Insertion tardive : ajout en fin, pas en tête ──")
r = c.post("/api/v1/modules/seances/", {"title": f"Delta {SFX}", "theme": theme.id, "s_type": 0}, format="json")
delta = r.data
r = c.get(f"/api/v1/modules/seances/?theme={theme.id}")
got = titles(r.data["results"] if "results" in r.data else r.data)
line("Delta ajouté en dernier", got[-1] == f"Delta {SFX}", str(got))
# ...puis remonté en 1re position par 3 « up » successifs.
for _ in range(3):
    c.post(f"/api/v1/modules/seances/{delta['id']}/reorder/", {"direction": "up"}, format="json")
r = c.get(f"/api/v1/modules/seances/?theme={theme.id}")
got = titles(r.data["results"] if "results" in r.data else r.data)
line("Delta remonté en tête (séance oubliée récupérable)", got[0] == f"Delta {SFX}", str(got))

# ── 4. Activités : même mécanique dans une séance ───────────────────────
print("\n── 4. Activités d'une séance ──")
sid = alpha["id"]
acts = []
for name in ("Act1", "Act2", "Act3"):
    r = c.post("/api/v1/modules/activities/", {"title": f"{name} {SFX}", "seance": sid, "a_type": 3}, format="json")
    acts.append(r.data)
line("Rangs activités 1,2,3", [a.get("order") for a in acts] == [1, 2, 3], f"{[a.get('order') for a in acts]}")
c.post(f"/api/v1/modules/activities/{acts[2]['id']}/reorder/", {"direction": "up"}, format="json")
r = c.get(f"/api/v1/modules/activities/?seance={sid}")
got = titles(r.data["results"] if "results" in r.data else r.data)
line("Ordre activités Act1→Act3→Act2", got == [f"Act1 {SFX}", f"Act3 {SFX}", f"Act2 {SFX}"], str(got))

# ── 5. Le point critique : éditeur == apprenant ─────────────────────────
print("\n── 5. Cohérence éditeur ↔ apprenant (le défaut d'origine) ──")
pub = Publication.objects.filter(is_private=False).first()
pub.themes.add(theme)
appr, _ = User.objects.get_or_create(
    username=f"ordre-appr-{SFX}", defaults={"email": f"ordre-{SFX}@hbc.test", "first_name": "Ordre"}
)
Inscription.objects.create(participant=appr, publication=pub, status=Inscription.CONFIRMED)

r = c.get(f"/api/v1/modules/seances/?theme={theme.id}")
vue_editeur = titles(r.data["results"] if "results" in r.data else r.data)

pub_c = APIClient()
r = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(appr)}/formation/{pub.id}/")
line("Espace apprenant accessible", r.status_code == 200, f"{r.status_code}")
th = next((t for t in r.data["themes"] if t["title"] == theme.title), None)
vue_apprenant = [s["title"] for s in th["seances"]] if th else []
line("L'apprenant voit le MÊME ordre que l'éditeur", vue_editeur == vue_apprenant,
     f"éditeur={vue_editeur} apprenant={vue_apprenant}")

# Un UPDATE réécrit la ligne : sous PostgreSQL cela pouvait suffire à changer
# l'ordre renvoyé. On vérifie que le rang explicite y résiste.
s_mid = Seance.objects.filter(theme=theme).order_by("order")[1]
c.patch(f"/api/v1/modules/seances/{s_mid.id}/", {"title": s_mid.title}, format="json")
r = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(appr)}/formation/{pub.id}/")
th = next((t for t in r.data["themes"] if t["title"] == theme.title), None)
apres = [s["title"] for s in th["seances"]] if th else []
line("Ordre stable après réécriture d'une ligne (UPDATE)", apres == vue_apprenant,
     f"avant={vue_apprenant} après={apres}")

# ── 6. Périmètre : un formateur ne réorganise pas chez les autres ────────
print("\n── 6. Sécurité : reorder hors périmètre refusé ──")
formateur = User.objects.filter(username="formateur1").first()
if formateur:
    formateur.formations_animees.clear()
    fc = APIClient()
    fc.force_authenticate(user=formateur)
    r = fc.post(f"/api/v1/modules/seances/{alpha['id']}/reorder/", {"direction": "down"}, format="json")
    line("Formateur non affecté : reorder refusé", r.status_code in (403, 404), f"{r.status_code}")
    theme.instructors.add(formateur)
    r = fc.post(f"/api/v1/modules/seances/{alpha['id']}/reorder/", {"direction": "down"}, format="json")
    line("Formateur affecté : reorder autorisé", r.status_code == 200, f"{r.status_code}")
    formateur.formations_animees.clear()

# ── Nettoyage ────────────────────────────────────────────────────────────
pub.themes.remove(theme)
Inscription.objects.filter(participant=appr).delete()
Activity.objects.filter(seance__theme=theme).delete()
Seance.objects.filter(theme=theme).delete()
theme.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
