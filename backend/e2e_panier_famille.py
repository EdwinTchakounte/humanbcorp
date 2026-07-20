"""E2E du panier famille (parent → enfants) — in-process, transaction ROLLBACK.

Cas dimensionnant : un parent paie pour plusieurs enfants, sur PLUSIEURS
formations, chaque enfant ayant soit son propre e-mail, soit une adresse
PARTAGÉE avec un frère/sœur. On vérifie que :
- deux enfants distincts sous une même adresse ne FUSIONNENT pas (2 comptes) ;
- chacun reçoit un lien d'accès distinct (magic-link par enfant) ;
- plusieurs formations tiennent dans un seul panier → une seule commande sommée ;
- un enfant avec son propre e-mail garde un compte « normal » (username = e-mail).

Lancer : POSTGRES_DB= DEBUG=True ALLOWED_HOSTS='*' ../.venv_local/bin/python e2e_panier_famille.py
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
from django.db import transaction
from rest_framework.test import APIClient

from bucket.models import Inscription, Order
from contents.models import Category, Publication
from sitecms.learner import learner_space_url

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
print("  E2E PANIER FAMILLE (PARENT → ENFANTS) — HBC-RH")
print("=" * 72)

try:
    with transaction.atomic():
        cat = Category.objects.first() or Category.objects.create(name=f"cat-{SFX}")
        parent = User.objects.create_user(f"parent-{SFX}", f"parent-{SFX}@fam.test", "x", first_name="Papa")
        pa = Publication.objects.create(title=f"Guitare {SFX}", description="a", price=Decimal("1000"),
                                        categorie=cat, is_private=False, capacite=100)
        pb = Publication.objects.create(title=f"Piano {SFX}", description="b", price=Decimal("2000"),
                                        categorie=cat, is_private=False, capacite=100)

        c = APIClient(); c.force_authenticate(user=parent)
        shared = f"parent-{SFX}@fam.test"  # une seule adresse pour 2 enfants

        # ── 1. Deux enfants sous une MÊME adresse, sur la formation A ──────
        print("\n── 1. E-mail partagé → deux comptes distincts ──")
        r = c.post("/api/v1/site/apprenant/panier/ajouter/", {
            "publication_id": pa.id, "pour_moi": False,
            "participants": [
                {"first_name": "Alice", "last_name": "Kamdem", "email": shared},
                {"first_name": "Bob", "last_name": "Kamdem", "email": shared},
            ],
        }, format="json")
        line("Ajout accepté (201)", r.status_code == 201, f"HTTP {r.status_code}")
        line("2 lignes ajoutées (pas de fusion)", len(r.json().get("ajoutes", [])) == 2,
             f"n={len(r.json().get('ajoutes', []))}")

        alice = User.objects.filter(first_name="Alice", last_name="Kamdem", email__iexact=shared).first()
        bob = User.objects.filter(first_name="Bob", last_name="Kamdem", email__iexact=shared).first()
        line("Deux comptes DISTINCTS créés", alice and bob and alice.pk != bob.pk,
             f"alice={getattr(alice,'pk',None)} bob={getattr(bob,'pk',None)}")
        line("…partageant la même adresse de contact",
             alice.email.lower() == shared and bob.email.lower() == shared)
        line("…avec des identifiants (username) distincts", alice.username != bob.username,
             f"{alice.username} ≠ {bob.username}")
        line("Chaque enfant a un lien d'accès distinct",
             learner_space_url(alice) != learner_space_url(bob))

        # ── 2. Une autre formation, enfant avec son PROPRE e-mail ─────────
        print("\n── 2. Multi-formations + e-mail propre ──")
        r = c.post("/api/v1/site/apprenant/panier/ajouter/", {
            "publication_id": pb.id, "pour_moi": False,
            "participants": [{"first_name": "Chloé", "last_name": "Kamdem", "email": f"chloe-{SFX}@fam.test"}],
        }, format="json")
        line("Ajout formation B accepté (201)", r.status_code == 201, f"HTTP {r.status_code}")
        chloe = User.objects.filter(first_name="Chloé").first()
        line("Enfant à e-mail propre : compte normal (username = e-mail)",
             chloe and chloe.username == f"chloe-{SFX}@fam.test", getattr(chloe, "username", None))

        panier = c.get("/api/v1/site/apprenant/panier/").json()
        line("Panier : 3 lignes sur 2 formations", len(panier.get("lignes", [])) == 3,
             f"n={len(panier.get('lignes', []))}")

        # ── 3. Une seule commande, sommée ─────────────────────────────────
        print("\n── 3. Un seul paiement pour tout le panier ──")
        r = c.post("/api/v1/site/apprenant/panier/commander/", {}, format="json")
        line("Commande créée", r.status_code in (200, 201), f"HTTP {r.status_code}")
        order = Order.objects.filter(buyer=parent).order_by("-id").first()
        line("Total = 1000 + 1000 + 2000 = 4000",
             order and Decimal(order.total_amount) == Decimal("4000"), f"total={getattr(order,'total_amount',None)}")
        line("3 inscriptions rattachées à la commande",
             order.orderinscription_set.count() == 3, f"n={order.orderinscription_set.count()}")

        # ── 4. Les enfants sont bien 3 participants distincts ─────────────
        print("\n── 4. Trois apprenants distincts ──")
        parts = {i.participant_id for i in Inscription.objects.filter(publication__in=[pa, pb])}
        line("3 participants distincts", len(parts) == 3, f"n={len(parts)}")
        line("Le parent n'est PAS inscrit (pour_moi=False)", parent.id not in parts)
        ma = c.get("/api/v1/site/apprenant/mes-apprenants/").json()
        noms = {a.get("nom") for a in (ma if isinstance(ma, list) else ma.get("apprenants", []))}
        line("« Mes apprenants » liste les 3 enfants",
             {"Alice Kamdem", "Bob Kamdem", "Chloé Kamdem"}.issubset(noms), f"noms={noms}")

        transaction.set_rollback(True)
except Exception as e:  # noqa: BLE001
    import traceback
    print(f"\n\033[91mEXCEPTION\033[0m {type(e).__name__}: {e}")
    traceback.print_exc()
    fails += 1

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} OK — {fails} KO")
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
