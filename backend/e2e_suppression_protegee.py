"""E2E de la suppression protégée — in-process, SQLite dev.

Le contenu est partagé par toutes les cohortes d'une formation : le supprimer
frappe aussi les sessions déjà vendues. Et `QuizAttempt`/`ActivityProgress`
pointent l'activité en CASCADE — une suppression sèche effaçait les scores et
les progressions des apprenants qui avaient payé.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_suppression_protegee.py
"""
import os
import time
from decimal import Decimal

import django

SFX = str(int(time.time()))[-6:]

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from lessonapp.models import Theme, Seance, Activity, Categorie, Sequence
from lessonapp.models.bloc import Bloc
from contents.models import Publication, Category
from bucket.models import Inscription
from material.models import ActivityProgress, QuizAttempt
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
print("  E2E SUPPRESSION PROTÉGÉE — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
theme = Theme.objects.create(
    title=f"Prog {SFX}", is_visible=True, t_type=1,
    categorie=Categorie.objects.first(), sequence=Sequence.objects.first(),
)
seance_vierge = Seance.objects.create(title=f"Vierge {SFX}", theme=theme, s_type=0)
seance_suivie = Seance.objects.create(title=f"Suivie {SFX}", theme=theme, s_type=0)
bloc = Bloc.objects.create(title="b", created_by=admin, categorie=Bloc.ACTIVITY)
act_vierge = Activity.objects.create(title=f"ActVierge {SFX}", seance=seance_vierge, bloc=bloc, a_type=3)
act_suivie = Activity.objects.create(title=f"ActSuivie {SFX}", seance=seance_suivie, bloc=bloc, a_type=1)

cat = Category.objects.first()
pub = Publication.objects.create(title=f"Session {SFX}", description="s", price=Decimal("1000"),
                                 categorie=cat, is_private=False)
pub.themes.add(theme)
appr = User.objects.create(username=f"appr-{SFX}", email=f"appr-{SFX}@hbc.test", first_name="Ada")
Inscription.objects.create(participant=appr, publication=pub, status=Inscription.CONFIRMED)

# L'apprenant a travaillé : une progression + un score de quiz.
ActivityProgress.objects.create(learner=appr, activity=act_suivie, completed=True)
QuizAttempt.objects.create(learner=appr, activity=act_suivie, score=8, max_score=10, answers={})

c = APIClient()
c.force_authenticate(user=admin)

# ── 1. Contenu jamais suivi : suppression directe ────────────────────────
print("\n── 1. Contenu que personne n'a suivi : rien ne bloque ──")
r = c.delete(f"/api/v1/modules/seances/{seance_vierge.id}/")
line("Suppression d'une séance vierge : pas de blocage", r.status_code == 204, f"{r.status_code}")
seance_vierge.refresh_from_db()
line("…et elle est retirée du programme", seance_vierge.is_deleted)

# ── 2. Contenu suivi : garde-fou ────────────────────────────────────────
print("\n── 2. Contenu déjà suivi : confirmation exigée ──")
r = c.delete(f"/api/v1/modules/seances/{seance_suivie.id}/")
line("Suppression refusée sans confirmation (409)", r.status_code == 409, f"{r.status_code}")
line("Le nombre d'apprenants impactés est remonté", r.data.get("learners_impacted") == 1,
     f"impacted={r.data.get('learners_impacted')}")
seance_suivie.refresh_from_db()
line("La séance est toujours là après le refus", not seance_suivie.is_deleted)

# ── 3. Confirmation explicite ───────────────────────────────────────────
print("\n── 3. Après confirmation : retirée, mais rien n'est détruit ──")
r = c.delete(f"/api/v1/modules/seances/{seance_suivie.id}/?force=true")
line("Suppression confirmée acceptée", r.status_code == 204, f"{r.status_code}")
seance_suivie.refresh_from_db()
line("La séance est retirée du programme", seance_suivie.is_deleted)
line("L'activité existe toujours en base (pas de CASCADE)",
     Activity.objects.filter(pk=act_suivie.pk).exists())
line("La PROGRESSION de l'apprenant est conservée",
     ActivityProgress.objects.filter(learner=appr, activity=act_suivie).exists())
line("Le SCORE de quiz de l'apprenant est conservé",
     QuizAttempt.objects.filter(learner=appr, activity=act_suivie, score=8).exists())

# ── 4. Effet réel côté apprenant ────────────────────────────────────────
print("\n── 4. L'apprenant ne voit plus le contenu retiré ──")
pub_c = APIClient()
r = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(appr)}/formation/{pub.id}/")
titres = [s["title"] for t in r.data["themes"] for s in t["seances"]]
line("Espace apprenant accessible", r.status_code == 200, f"{r.status_code}")
line("La séance retirée n'apparaît plus", seance_suivie.title not in titres, str(titres))
line("La séance vierge retirée non plus", seance_vierge.title not in titres, str(titres))

# La progression ne doit pas compter le contenu retiré : sinon le pourcentage
# ne pourrait jamais atteindre 100 %.
esp = pub_c.get(f"/api/v1/site/mon-espace/{sign_member(appr)}/")
f0 = next((f for f in esp.data["formations"] if f["publication_id"] == pub.id), None)
line("Le contenu retiré sort du calcul de progression",
     f0 is not None and f0["progress"]["total"] == 0, str(f0 and f0["progress"]))

# ── 5. Périmètre ────────────────────────────────────────────────────────
print("\n── 5. Sécurité : hors périmètre, pas de suppression ──")
formateur = User.objects.filter(username="formateur1").first()
if formateur:
    formateur.formations_animees.clear()
    s2 = Seance.objects.create(title=f"Autre {SFX}", theme=theme, s_type=0)
    fc = APIClient()
    fc.force_authenticate(user=formateur)
    r = fc.delete(f"/api/v1/modules/seances/{s2.id}/")
    line("Formateur non affecté : suppression refusée", r.status_code in (403, 404), f"{r.status_code}")
    s2.refresh_from_db()
    line("…et la séance est intacte", not s2.is_deleted)
    s2.delete()

# ── Nettoyage ────────────────────────────────────────────────────────────
ActivityProgress.objects.filter(learner=appr).delete()
QuizAttempt.objects.filter(learner=appr).delete()
Inscription.objects.filter(participant=appr).delete()
appr.delete()
pub.delete()
Activity.objects.filter(seance__theme=theme).delete()
Seance.objects.filter(theme=theme).delete()
theme.delete()
bloc.delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
