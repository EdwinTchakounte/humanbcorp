"""E2E : rôle FORMATEUR (auteur limité) + SUIVI apprenants (in-process, SQLite dev).

Scénario complet :
  - admin crée une formation, y affecte un formateur ;
  - le formateur (périmètre restreint) édite le contenu/quiz de SA formation
    et se voit refuser l'accès à une autre formation ;
  - deux apprenants inscrits (CONFIRMED) terminent une activité + passent le quiz ;
  - admin ET formateur consultent le suivi (progression + scores).

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_formateur_suivi.py
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient

from lessonapp.models import Theme, Sequence, Categorie
from contents.models import Publication
from bucket.models import Inscription
from sitecms import learner as L

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = 0
fails = 0


def line(label, ok, extra=""):
    global step, fails
    step += 1
    if not ok:
        fails += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


def auth(client, username, password):
    r = client.post("/api/v1/auth/token/", {"username": username, "password": password}, format="json")
    assert r.status_code == 200, f"login {username} → {r.status_code} {r.data}"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    return r.data["profile"]


print("\n" + "=" * 72)
print("  E2E FORMATEUR (auteur limité) + SUIVI — HBC-RH")
print("=" * 72)

# ── 0. Comptes ───────────────────────────────────────────────────────────
print("\n── 0. Comptes de test ──")
teacher_group, _ = Group.objects.get_or_create(name="Teacher")
formateur, created = User.objects.get_or_create(
    username="formateur1", defaults={"email": "formateur1@hbc.test", "first_name": "Fatou", "last_name": "Formatrice"},
)
formateur.set_password("Formateur@HBC2026")
formateur.is_staff = False
formateur.save()
formateur.groups.add(teacher_group)
formateur.formations_animees.clear()  # périmètre propre à chaque run (pas d'accumulation)
line("Formateur 'formateur1' (groupe Teacher)", formateur.groups.filter(name="Teacher").exists(),
     f"{'créé' if created else 'existant'}")

learners = []
for i in (1, 2):
    u, _ = User.objects.get_or_create(
        username=f"apprenant{i}", defaults={"email": f"apprenant{i}@hbc.test", "first_name": f"App{i}", "last_name": "Renant"},
    )
    u.set_password("Apprenant@HBC2026")
    u.save()
    learners.append(u)
line("2 apprenants créés", len(learners) == 2)

admin_client = APIClient()
prof = auth(admin_client, "admin", "Admin@HBC2026")
line("Login admin", prof.get("is_admin") is True, f"modules={len(prof.get('modules', []))}")

# ── 1. Admin crée une formation et y affecte le formateur ────────────────
print("\n── 1. Admin : création formation + affectation formateur ──")
seq = Sequence.objects.filter(is_deleted=False).first()
cat = Categorie.objects.filter(is_deleted=False).first()
assert seq and cat, "Il faut au moins une séquence et une catégorie existantes."
r = admin_client.post("/api/v1/modules/themes/", {
    "title": "Formation E2E Formateur", "t_type": 1, "is_visible": True,
    "sequence": seq.id, "categorie": cat.id,
}, format="json")
line("POST création formation (admin)", r.status_code == 201, str(r.data)[:60])
theme_id = r.data["id"]

r = admin_client.patch(f"/api/v1/modules/themes/{theme_id}/", {"instructors": [formateur.id]}, format="json")
ok = r.status_code == 200 and formateur.id in [d["id"] for d in r.data.get("instructors_detail", [])]
line("PATCH affectation formateur à la formation", ok,
     f"instructors={[d['name'] for d in r.data.get('instructors_detail', [])]}")

# Une autre formation, NON affectée au formateur (pour tester le refus).
other = Theme.objects.filter(is_deleted=False).exclude(pk=theme_id).first()
line("Formation témoin hors périmètre repérée", other is not None, f"#{other.id if other else '—'}")

# ── 2. Formateur : périmètre restreint ───────────────────────────────────
print("\n── 2. Formateur : périmètre (voit/édite ses formations seulement) ──")
teach = APIClient()
tprof = auth(teach, "formateur1", "Formateur@HBC2026")
mod_keys = {m["key"] for m in tprof.get("modules", [])}
line("Login formateur", tprof.get("is_teacher") is True, f"modules={sorted(mod_keys)}")
line("Modules limités (formations/agenda/suivi, PAS paiements/inscriptions)",
     {"formations", "agenda", "suivi"}.issubset(mod_keys) and not ({"paiements", "inscriptions", "cms"} & mod_keys))

r = teach.get("/api/v1/modules/themes/")
ids = [t["id"] for t in (r.data if isinstance(r.data, list) else r.data.get("results", []))]
line("GET formations → sa formation visible, celle d'autrui masquée",
     ids == [theme_id] and (other is None or other.id not in ids), f"vus={ids} attendu=[{theme_id}]")

# Création de contenu SUR SA formation → autorisé
r = teach.post("/api/v1/modules/seances/", {"title": "Séance 1", "theme": theme_id, "s_type": 0}, format="json")
line("POST séance sur SA formation → 201", r.status_code == 201, str(r.data)[:50])
seance_id = r.data.get("id")

r = teach.post("/api/v1/modules/activities/", {"title": "Cours vidéo", "seance": seance_id, "a_type": 3}, format="json")
line("POST activité contenu → 201", r.status_code == 201)
content_act = r.data.get("id")
r = teach.post("/api/v1/modules/components/", {"activity": content_act, "title": "Intro", "paragraph": "Bienvenue."}, format="json")
line("POST bloc de contenu → 201", r.status_code == 201)

r = teach.post("/api/v1/modules/activities/", {"title": "Quiz final", "seance": seance_id, "a_type": 1}, format="json")
line("POST activité quiz → 201", r.status_code == 201)
quiz_act = r.data.get("id")
r = teach.post("/api/v1/modules/quiz-questions/", {
    "activity": quiz_act, "title": "2 + 2 = ?", "points": 1, "input_type": 2,
    "options": [{"title": "3", "is_answer": False}, {"title": "4", "is_answer": True}, {"title": "5", "is_answer": False}],
}, format="json")
line("POST question de quiz (avec bonne réponse) → 201", r.status_code == 201)

# Tentative HORS périmètre → refus
if other:
    r = teach.post("/api/v1/modules/seances/", {"title": "Intrusion", "theme": other.id, "s_type": 0}, format="json")
    line("POST séance sur formation d'autrui → 403", r.status_code == 403, f"HTTP {r.status_code}")
    r = teach.get(f"/api/v1/modules/seances/?theme={other.id}")
    seen = r.data if isinstance(r.data, list) else r.data.get("results", [])
    line("GET séances d'autrui → vide (invisible)", len(seen) == 0, f"{len(seen)} vues")

# ── 2bis. Durcissement : taxonomie partagée, affectation, overview ────────
print("\n── 2bis. Durcissement du périmètre ──")
# Le formateur NE peut PAS supprimer/éditer une séquence ou catégorie partagée.
r = teach.delete(f"/api/v1/modules/sequences/{seq.id}/")
line("DELETE séquence partagée (formateur) → 403", r.status_code == 403, f"HTTP {r.status_code}")
r = teach.patch(f"/api/v1/modules/formation-categories/{cat.id}/", {"name": "Piraté"}, format="json")
line("PATCH catégorie partagée (formateur) → 403", r.status_code == 403, f"HTTP {r.status_code}")
# ... mais il PEUT créer une nouvelle catégorie (ajout inline autorisé).
r = teach.post("/api/v1/modules/formation-categories/", {"name": f"Cat perso {theme_id}"}, format="json")
line("POST nouvelle catégorie (formateur) → 201", r.status_code == 201, f"HTTP {r.status_code}")
# Overview : le compteur de formations respecte le périmètre.
r = teach.get("/api/v1/modules/formations/overview/")
line("Overview formateur : counts.themes == périmètre", r.data.get("counts", {}).get("themes") == 1,
     f"themes={r.data.get('counts', {}).get('themes')}")
# Le formateur NE peut PAS se retirer / réaffecter (instructors ignoré).
r = teach.patch(f"/api/v1/modules/themes/{theme_id}/", {"instructors": []}, format="json")
still = formateur.id in [d["id"] for d in (r.data.get("instructors_detail") or [])]
line("PATCH instructors=[] par formateur → ignoré (reste affecté)", still,
     f"instructors={[d['name'] for d in (r.data.get('instructors_detail') or [])]}")
# Liste des formateurs réservée aux admins.
r = teach.get("/api/v1/modules/formations/teachers/")
line("GET teachers (formateur) → 403", r.status_code == 403, f"HTTP {r.status_code}")
# Admin, lui, PEUT réaffecter.
r = admin_client.get("/api/v1/modules/formations/teachers/")
line("GET teachers (admin) → 200", r.status_code == 200, f"{len(r.data)} formateur(s)")

# ── 2ter. Import de quiz depuis un fichier (CSV) ─────────────────────────
print("\n── 2ter. Import de quiz par fichier ──")
from django.core.files.uploadedfile import SimpleUploadedFile
csv_content = (
    "question,option1,option2,option3,correct,points,type\r\n"
    "Capitale du Cameroun ?,Douala,Yaoundé,Kribi,2,1,radio\r\n"
    "Langages de prog ?,Python,HTML,Java,\"1,3\",2,checkbox\r\n"
).encode("utf-8")
up = SimpleUploadedFile("quiz.csv", csv_content, content_type="text/csv")
r = teach.post("/api/v1/modules/quiz-questions/import/", {"activity": quiz_act, "file": up}, format="multipart")
ok = r.status_code == 201 and r.data.get("imported") == 2
line("POST import CSV (2 questions) → 201", ok, f"imported={r.data.get('imported')} errors={r.data.get('errors')}")
# Vérifie que les questions importées sont bien listées avec leurs bonnes réponses
r = teach.get(f"/api/v1/modules/quiz-questions/?activity={quiz_act}")
qs = r.data if isinstance(r.data, list) else []
imported = [q for q in qs if "Capitale" in q["title"] or "Langages" in q["title"]]
line("Questions importées présentes dans le quiz", len(imported) == 2, f"{len(qs)} question(s) au total")
multi = next((q for q in imported if "Langages" in q["title"]), {})
n_ans = sum(1 for o in multi.get("options", []) if o["is_answer"])
line("Question checkbox : 2 bonnes réponses (Python+Java)", multi.get("input_type") == 1 and n_ans == 2, f"input_type={multi.get('input_type')} bonnes={n_ans}")
# Template téléchargeable
r = teach.get("/api/v1/modules/quiz-questions/template/?fmt=csv")
line("GET template CSV → 200", r.status_code == 200 and b"question" in r.content, f"HTTP {r.status_code}")
r = teach.get("/api/v1/modules/quiz-questions/template/?fmt=xlsx")
line("GET template XLSX → 200", r.status_code == 200 and len(r.content) > 100, f"{len(r.content)} octets")

# ── 3. Inscriptions apprenants (CONFIRMED) sur une publication du thème ──
print("\n── 3. Apprenants inscrits (CONFIRMED) ──")
theme = Theme.objects.get(pk=theme_id)
# Publication DÉDIÉE au test (isolée) → seuls nos 2 apprenants comptent dans le suivi.
from contents.models import Category
pub_cat = Category.objects.first()
pub = Publication.objects.create(
    title="Publication E2E Formateur", description="Test", price="1000.00",
    categorie=pub_cat, is_private=False,
)
pub.themes.add(theme)
for u in learners:
    Inscription.objects.get_or_create(participant=u, publication=pub, defaults={"status": Inscription.CONFIRMED})
    Inscription.objects.filter(participant=u, publication=pub).update(status=Inscription.CONFIRMED)
line("2 inscriptions CONFIRMED reliées au thème", True, f"pub #{pub.id}")

# ── 4. Les apprenants avancent (quiz + activité terminée) ────────────────
print("\n── 4. Parcours apprenant (quiz + progression) ──")
client = APIClient()
# apprenant 1 : passe le quiz (bonne réponse) + termine le cours
tok1 = L.sign_member(learners[0])
# récupère les options du quiz pour répondre juste
detail = client.get(f"/api/v1/site/mon-espace/{tok1}/formation/{pub.id}/")
qid = None
def walk(n):
    global qid
    if isinstance(n, dict):
        if n.get("type") == 1 and n.get("questions"):
            for q in n["questions"]:
                qid = q["id"]
        for v in n.values():
            walk(v)
    elif isinstance(n, list):
        for v in n:
            walk(v)
walk(detail.data)
# Réponse CORRECTE (récupérée en base, invisible côté apprenant) → score plein.
from material.models import InputQuestionBox
correct = list(InputQuestionBox.objects.filter(question_id=qid, is_answer=True).values_list("id", flat=True))
r = client.post(f"/api/v1/site/mon-espace/{tok1}/quiz/{quiz_act}/", {"answers": {str(qid): correct}}, format="json")
line("Apprenant 1 soumet le quiz", r.status_code == 200, f"score={r.data.get('score')}/{r.data.get('max_score')}")
r = client.post(f"/api/v1/site/mon-espace/{tok1}/activite/{content_act}/terminer/")
line("Apprenant 1 termine le cours", r.status_code in (200, 201), f"HTTP {r.status_code}")

# apprenant 2 : termine seulement le cours (pas de quiz)
tok2 = L.sign_member(learners[1])
r = client.post(f"/api/v1/site/mon-espace/{tok2}/activite/{content_act}/terminer/")
line("Apprenant 2 termine le cours (sans quiz)", r.status_code in (200, 201))

# ── 5. Suivi (admin) ─────────────────────────────────────────────────────
print("\n── 5. Suivi côté admin ──")
r = admin_client.get(f"/api/v1/modules/suivi/?theme={theme_id}")
line("GET /modules/suivi/ (admin)", r.status_code == 200)
formations = r.data.get("formations", [])
f0 = formations[0] if formations else {}
line("Formation présente dans le suivi", f0.get("id") == theme_id, f0.get("title", ""))
line("2 apprenants suivis", f0.get("learners_count") == 2, f"count={f0.get('learners_count')}")
byname = {l["name"]: l for l in f0.get("learners", [])}
a1 = next((l for l in f0.get("learners", []) if l["email"] == "apprenant1@hbc.test"), {})
a2 = next((l for l in f0.get("learners", []) if l["email"] == "apprenant2@hbc.test"), {})
line("Apprenant 1 : quiz noté visible", bool(a1.get("quizzes")),
     f"{a1.get('quizzes')}")
line("Apprenant 1 : progression > 0", a1.get("progress", {}).get("percent", 0) > 0,
     f"{a1.get('progress')}")
line("Apprenant 2 : progression enregistrée, aucun quiz", (not a2.get("quizzes")) and a2.get("progress", {}).get("done", 0) >= 1,
     f"{a2.get('progress')}")

# ── 6. Suivi (formateur) ─────────────────────────────────────────────────
print("\n── 6. Suivi côté formateur ──")
r = teach.get("/api/v1/modules/suivi/")
line("GET /modules/suivi/ (formateur)", r.status_code == 200)
tf = r.data.get("formations", [])
line("Formateur ne voit QUE sa formation dans le suivi", len(tf) == 1 and tf[0]["id"] == theme_id,
     f"{[x['id'] for x in tf]}")
line("Formateur voit les scores de ses apprenants", tf and tf[0].get("learners_count") == 2)

# ── Récap ────────────────────────────────────────────────────────────────
print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
