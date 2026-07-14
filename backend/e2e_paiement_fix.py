"""E2E des corrections de fragilité paiement (in-process, SQLite dev).

1. Paiement PARTIEL → l'accès (inscription CONFIRMED) n'est PAS accordé ; il ne
   l'est qu'au paiement intégral (SEMI_PAID → TOTAL_PAID).
2. Rapprochement webhook Tara de secours par TÉLÉPHONE + MONTANT : deux paiements
   en attente sur le même numéro mais de montants différents sont bien distingués.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_paiement_fix.py
"""
import os
import time
import django
from decimal import Decimal

SFX = str(int(time.time()))[-7:]  # suffixe unique par run (isolation)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from contents.models import Publication, Category
from lessonapp.models import Theme
from bucket.models import Inscription, Order, OrderInscription
from apps_coop.payments.models import Payment
from apps_coop.payments.services import handle_webhook_event
from sitecms.public_catalog import load_order

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = fails = 0


def line(label, ok, extra=""):
    global step, fails
    step += 1
    if not ok:
        fails += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


def mk_payment(member, montant, phone, order=None):
    return Payment.objects.create(
        member=member, montant=Decimal(montant), type=Payment.Type.FRAIS_INSCRIPTION,
        source=Payment.Source.MOBILE_MONEY, statut=Payment.Statut.EN_ATTENTE,
        provider_code="tara", order=order, date_versement=timezone.now(),
        payer_phone="".join(c for c in phone if c.isdigit()),
    )


print("\n" + "=" * 72)
print("  E2E CORRECTIONS PAIEMENT — HBC-RH")
print("=" * 72)

# ── 1. Paiement partiel ne donne PAS l'accès ─────────────────────────────
print("\n── 1. Paiement partiel → pas d'accès tant que non soldé ──")
client = APIClient()
pub = Publication.objects.filter(is_private=False).first()
theme = Theme.objects.filter(is_deleted=False).first()
pub.themes.add(theme)
pub.price = Decimal("1000.00")
pub.save(update_fields=["price"])

r = client.post("/api/v1/site/inscription/", {
    "formation_id": pub.id, "first_name": "Payeur", "last_name": "Partiel",
    "email": f"pay-partiel-{SFX}@hbc.test", "phone": "691234567",
}, format="json")
line("Inscription créée (Order PENDING)", r.status_code == 201, str(r.data.get("detail", ""))[:40])
order = load_order(r.data["order_token"])
# L'inscription de CETTE commande (via OrderInscription, pas par (user, pub)).
insc = OrderInscription.objects.select_related("inscription").filter(order=order).first().inscription

# Paiement partiel : 400 / 1000
p1 = mk_payment(order.buyer, "400.00", "691234567", order=order)
handle_webhook_event(p1.idempotency_key, "valide")
order.refresh_from_db(); insc.refresh_from_db()
line("Après 400/1000 : commande SEMI_PAID", order.status == Order.SEMI_PAID, f"status={order.status}")
line("Après 400/1000 : inscription NON confirmée (pas d'accès)", insc.status != Inscription.CONFIRMED,
     f"insc.status={insc.status} (attendu ≠ {Inscription.CONFIRMED})")

# Solde : +600 → 1000/1000
p2 = mk_payment(order.buyer, "600.00", "691234567", order=order)
handle_webhook_event(p2.idempotency_key, "valide")
order.refresh_from_db(); insc.refresh_from_db()
line("Après solde 1000/1000 : commande TOTAL_PAID", order.status == Order.TOTAL_PAID, f"status={order.status}")
line("Après solde : inscription CONFIRMED (accès accordé)", insc.status == Inscription.CONFIRMED,
     f"insc.status={insc.status}")

# ── 2. Rapprochement webhook par téléphone + montant ─────────────────────
print("\n── 2. Fallback webhook : téléphone + montant (désambiguïsation) ──")
u2, _ = User.objects.get_or_create(username=f"pay-disambig-{SFX}", defaults={"email": f"disambig-{SFX}@hbc.test"})
PHONE = "69" + SFX  # 9 chiffres, unique par run
# Deux paiements EN_ATTENTE, même numéro, montants différents.
pa = mk_payment(u2, "1000.00", PHONE)  # ne doit PAS être confirmé
pb = mk_payment(u2, "2500.00", PHONE)  # doit être confirmé (montant du webhook)

# Webhook Tara sans notre UUID (clé inconnue) → tombe sur le fallback phone+montant.
handle_webhook_event(
    f"CLE-INCONNUE-{SFX}",
    "valide",
    provider_reference=f"PAY-TARA-{SFX}",
    raw_payload={"phoneNumber": "237" + PHONE, "productPrice": 2500, "status": "SUCCESS"},
)
pa.refresh_from_db(); pb.refresh_from_db()
line("Le paiement du BON montant (2500) est validé", pb.statut == Payment.Statut.VALIDE, f"pb.statut={pb.statut}")
line("Le paiement de l'AUTRE montant (1000) reste en attente", pa.statut == Payment.Statut.EN_ATTENTE,
     f"pa.statut={pa.statut}")

# ── Récap ────────────────────────────────────────────────────────────────
print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
