"""E2E du flow de base HBC-RH (in-process, SQLite dev).

Enchaine, du point de vue d'un visiteur, TOUTE la chaine :
config -> catalogue -> inscription invite -> paiement (Tara) -> confirmation
-> espace apprenant -> contenu/quiz/progression -> recrutement -> documents.

Ne lit AUCUN secret : les cles Tara/Brevo sont evaluees en booleen uniquement.
Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_flow.py
"""
import os
import django
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]  # APIClient in-process utilise l'hôte 'testserver'
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from contents.models import Publication
from lessonapp.models import Theme, Activity
from sitecms import learner as L
from sitecms.public_catalog import load_order

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = 0


def line(label, ok, extra=""):
    global step
    step += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


client = APIClient()
print("\n" + "=" * 70)
print("  E2E FLOW DE BASE — HBC-RH")
print("=" * 70)

# ── 0. Config (booleens, jamais de valeur) ──────────────────────────────
print("\n── 0. Configuration détectée (sans exposer les secrets) ──")
tara_real = bool(settings.TARA_API_KEY) and bool(settings.TARA_BUSINESS_ID)
brevo_real = "brevo" in settings.EMAIL_BACKEND.lower()
print(f"      Paiement Tara .......... {'REEL (clés présentes)' if tara_real else 'MOCK (clés vides)'}")
print(f"      Email backend .......... {'Brevo (envoi réel)' if brevo_real else settings.EMAIL_BACKEND.split('.')[-1]}")
print(f"      BREVO_API_KEY présente .. {bool(settings.ANYMAIL.get('BREVO_API_KEY'))}")
print(f"      PUBLIC_BASE_URL ........ {settings.PUBLIC_BASE_URL}")
print(f"      SITE_PUBLIC_URL ........ {settings.SITE_PUBLIC_URL}")
print(f"      AUTO_VALIDATE (test) ... {settings.PAYMENTS_TEST_AUTO_VALIDATE}")

# ── 1. Setup : relier une Publication publique à un Theme avec contenu ───
print("\n── 1. Préparation du scénario ──")
theme = Theme.objects.get(pk=11)  # 'Les fonctions' : quiz (act#6) + pdf (act#7)
pub = Publication.objects.filter(is_private=False).first()
pub.themes.add(theme)
line(f"Publication #{pub.id} '{pub.title[:30]}' reliée au Theme #{theme.id}", True,
     f"prix={pub.price}")

EMAIL = "e2e-visiteur@example.com"

# ── 2. Catalogue public ─────────────────────────────────────────────────
print("\n── 2. Parcours visiteur ──")
r = client.get("/api/v1/site/formations/")
line("GET catalogue formations", r.status_code == 200, f"{len(r.data)} formations")
r = client.get(f"/api/v1/site/formations/{pub.id}/")
line("GET détail formation", r.status_code == 200, r.data.get("title", "")[:30])

# ── 3. Inscription invité ───────────────────────────────────────────────
r = client.post("/api/v1/site/inscription/", {
    "formation_id": pub.id, "first_name": "Edwin", "last_name": "Visiteur",
    "email": EMAIL, "phone": "691234567",
}, format="json")
ok = r.status_code == 201
line("POST inscription invité (compte + Order PENDING + email accusé)", ok,
     r.data.get("detail", "")[:40] if ok else str(r.data)[:60])
if not ok:
    raise SystemExit("Inscription échouée, arrêt.")
order_token = r.data["order_token"]

r = client.get(f"/api/v1/site/inscription/{order_token}/")
line("GET suivi commande (polling)", r.status_code == 200,
     f"paid={r.data.get('paid')} status={r.data.get('status')}")

# ── 4. Paiement (init Tara / mock) ──────────────────────────────────────
print("\n── 4. Paiement Mobile Money ──")
r = client.post(f"/api/v1/site/inscription/{order_token}/payer/", {
    "phone": "691234567", "network": "MTN",
}, format="json")
ok = r.status_code == 200 and r.data.get("payment_id")
line("POST payer (init STK push / mock)", ok, r.data.get("detail", str(r.data))[:45])
if not ok:
    raise SystemExit("Init paiement échouée, arrêt.")
payment_id = r.data["payment_id"]

# ── 5. Confirmation (webhook Tara simulé — chemin de production) ─────────
from apps_coop.payments.models import Payment
from apps_coop.payments.services import handle_webhook_event
p = Payment.objects.get(pk=payment_id)
updated = handle_webhook_event(p.idempotency_key, "valide")
line("Webhook Tara → paiement validé (handle_webhook_event)",
     updated.statut == Payment.Statut.VALIDE, f"statut={updated.statut}")

r = client.get(f"/api/v1/site/inscription/{order_token}/")
line("GET suivi commande après paiement", r.data.get("paid") is True,
     f"paid={r.data.get('paid')} status={r.data.get('status')}")

# ── 6. Espace apprenant (lien magique) ──────────────────────────────────
print("\n── 6. Espace apprenant ──")
order = load_order(order_token)
member_token = L.sign_member(order.buyer)
magic = f"{settings.SITE_PUBLIC_URL}/mon-espace/{member_token}"
r = client.get(f"/api/v1/site/mon-espace/{member_token}/")
line("GET mon-espace (liste des formations de l'apprenant)", r.status_code == 200,
     f"{len(r.data.get('formations', r.data if isinstance(r.data, list) else []))} formation(s)")

r = client.get(f"/api/v1/site/mon-espace/{member_token}/formation/{pub.id}/")
ok = r.status_code == 200
line("GET contenu formation (séances/activités/planning)", ok)
quiz_activity_id, questions = None, []
if ok:
    seances = r.data.get("seances") or r.data.get("theme", {}).get("seances") or []
    # trouve une activité quiz + ses questions
    def walk(node):
        global quiz_activity_id, questions
        if isinstance(node, dict):
            if node.get("type") == 1 and node.get("questions"):
                quiz_activity_id = node.get("id")
                questions = node["questions"]
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(r.data)
    line("  contenu déserialisé", True,
         f"quiz_activity={quiz_activity_id} questions={len(questions)}")

# ── 7. Quiz + progression ───────────────────────────────────────────────
print("\n── 7. Quiz & progression ──")
if quiz_activity_id is None:
    quiz_activity_id = 6  # act quiz connu du Theme 11
answers = {}
for q in questions:
    opts = q.get("options") or q.get("choices") or []
    if opts:
        answers[str(q["id"])] = [opts[0].get("id")]
r = client.post(f"/api/v1/site/mon-espace/{member_token}/quiz/{quiz_activity_id}/",
                {"answers": answers}, format="json")
line("POST soumission quiz (scoring + QuizAttempt)", r.status_code in (200, 201),
     f"score={r.data.get('score')}/{r.data.get('max_score')}" if r.status_code == 200 else str(r.data)[:50])

# progression : marquer l'activité PDF terminée
r = client.post(f"/api/v1/site/mon-espace/{member_token}/activite/7/terminer/")
line("POST marquer activité terminée (progression)", r.status_code in (200, 201),
     f"HTTP {r.status_code}")

# ── 8. Recrutement ──────────────────────────────────────────────────────
print("\n── 8. Recrutement ──")
r = client.get("/api/v1/site/offres/")
offers = r.data if isinstance(r.data, list) else r.data.get("results", [])
line("GET liste des offres", r.status_code == 200, f"{len(offers)} offre(s)")
slug = offers[0]["slug"] if offers else ""
if slug:
    r = client.get(f"/api/v1/site/offres/{slug}/")
    line("GET détail offre", r.status_code == 200, r.data.get("title", "")[:30])
cv = SimpleUploadedFile("cv_edwin.pdf", b"%PDF-1.4 fake cv content", content_type="application/pdf")
r = client.post("/api/v1/site/candidature/", {
    "offer_slug": slug, "first_name": "Edwin", "last_name": "Candidat",
    "email": EMAIL, "phone": "691234567", "cover_letter": "Candidature E2E.",
    "cv": cv,
}, format="multipart")
line("POST candidature (upload CV + accusé)", r.status_code in (200, 201),
     str(r.data)[:50])

# ── 9. Documents publics ────────────────────────────────────────────────
print("\n── 9. Documents ──")
r = client.get("/api/v1/site/documents/")
docs = r.data if isinstance(r.data, list) else r.data.get("results", [])
line("GET liste documents téléchargeables", r.status_code == 200, f"{len(docs)} document(s)")

# ── Récap ───────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print(f"  Lien espace apprenant généré : {magic[:72]}…")
print("=" * 70 + "\n")
