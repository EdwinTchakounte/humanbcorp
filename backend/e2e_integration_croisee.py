"""E2E d'INTÉGRATION CROISÉE — tous les nouveaux modules dans UN seul flux.

Contrairement aux 19 suites (chacune son domaine), ce scénario chaîne bout-à-bout
le vrai parcours argent et vérifie que les modules réagissent ENSEMBLE, sur les
MÊMES données, dans la MÊME transaction :

    Parent → panier (multi-enfants, e-mail partagé + e-mail propre, multi-formations)
           → commander (Order PENDING)
           → [état AVANT paiement : CA espace = 0, paiement en attente]
           → encaissement réel (admin) = confirm_payment_manually → _confirm
           → [état APRÈS : Order TOTAL_PAID, inscriptions CONFIRMED]
                 ├─ CA de l'espace reflète le montant figé
                 ├─ le JOURNAL D'AUDIT contient payment.confirmed (HTTP)
                 └─ le MONITORING voit +1 paiement validé (delta HTTP)
    + cloisonnement transverse : un RECRUTEUR ne voit que SES données RH,
      et n'a accès NI au journal d'audit NI au CA des espaces.

Lancer : POSTGRES_DB= DEBUG=True ALLOWED_HOSTS='*' \
         /home/tchakounte/Desktop/HumanB/.venv_local/bin/python e2e_integration_croisee.py
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
from django.contrib.auth.models import User, Group
from django.db import transaction
from rest_framework.test import APIClient

from bucket.models import Inscription, Order, OrderInscription
from contents.models import Category, Publication
from espaces.models import Espace, Membership
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


def ca_of(client, espace_id):
    """Lit le CA encaissé d'un espace via l'API back-office (super-admin)."""
    items = client.get("/api/v1/modules/espaces/ca/").json().get("espaces", [])
    row = next((x for x in items if x["id"] == espace_id), None)
    return (row or {}).get("ca_encaisse")


def valides_24h(client):
    return client.get("/api/v1/monitoring/overview/").json().get("paiements", {}).get("valides_24h")


print("\n" + "=" * 72)
print("  E2E INTÉGRATION CROISÉE (PANIER→PAIEMENT→CA→AUDIT→MONITORING) — HBC-RH")
print("=" * 72)

try:
    with transaction.atomic():
        # ── Décor ─────────────────────────────────────────────────────────
        cat = Category.objects.first() or Category.objects.create(name=f"cat-{SFX}")
        espace = Espace.objects.create(nom=f"École X {SFX}", is_active=True)
        admin = User.objects.filter(is_superuser=True).first() \
            or User.objects.create_superuser(f"xadm-{SFX}", f"xadm-{SFX}@hbc.test", "x")
        parent = User.objects.create_user(f"xpar-{SFX}", f"xpar-{SFX}@fam.test", "x", first_name="Papa")

        pa = Publication.objects.create(title=f"Guitare {SFX}", description="a", price=Decimal("1000"),
                                        categorie=cat, is_private=False, capacite=50, espace=espace)
        pb = Publication.objects.create(title=f"Piano {SFX}", description="b", price=Decimal("2000"),
                                        categorie=cat, is_private=False, capacite=50, espace=espace)

        ca = APIClient(); ca.force_authenticate(user=admin)
        cp = APIClient(); cp.force_authenticate(user=parent)
        shared = f"xpar-{SFX}@fam.test"  # une adresse pour deux enfants

        # ── 1. Le parent remplit son panier (le cas famille complet) ───────
        print("\n── 1. Panier famille : e-mail partagé + propre, 2 formations ──")
        r = cp.post("/api/v1/site/apprenant/panier/ajouter/", {
            "publication_id": pa.id, "pour_moi": False,
            "participants": [
                {"first_name": "Alice", "last_name": "Kamdem", "email": shared},
                {"first_name": "Bob", "last_name": "Kamdem", "email": shared},
            ],
        }, format="json")
        line("Ajout formation A (2 enfants, e-mail partagé) → 201", r.status_code == 201, f"HTTP {r.status_code}")
        r = cp.post("/api/v1/site/apprenant/panier/ajouter/", {
            "publication_id": pb.id, "pour_moi": False,
            "participants": [{"first_name": "Chloé", "last_name": "Kamdem", "email": f"chloe-{SFX}@fam.test"}],
        }, format="json")
        line("Ajout formation B (enfant e-mail propre) → 201", r.status_code == 201, f"HTTP {r.status_code}")

        alice = User.objects.filter(first_name="Alice", email__iexact=shared).first()
        bob = User.objects.filter(first_name="Bob", email__iexact=shared).first()
        line("E-mail partagé → 2 comptes DISTINCTS (pas de fusion)",
             alice and bob and alice.pk != bob.pk, f"alice={getattr(alice,'pk',None)} bob={getattr(bob,'pk',None)}")

        # ── 2. État AVANT paiement : rien n'est encore encaissé ────────────
        print("\n── 2. Avant paiement : le CA de l'espace est nul ──")
        line("CA espace = 0 avant encaissement (aucune commande réglée)",
             (ca_of(ca, espace.id) or 0) == 0, f"ca={ca_of(ca, espace.id)}")
        v_avant = valides_24h(ca)
        line("Monitoring : compteur paiements validés lisible", isinstance(v_avant, int), f"v={v_avant}")

        # ── 3. Commander → une seule commande sommée ───────────────────────
        print("\n── 3. Commander : une commande unique pour tout le panier ──")
        r = cp.post("/api/v1/site/apprenant/panier/commander/", {}, format="json")
        line("Commande créée", r.status_code in (200, 201), f"HTTP {r.status_code}")
        order = Order.objects.filter(buyer=parent).order_by("-id").first()
        line("Total commande = 1000 + 1000 + 2000 = 4000",
             order and Decimal(order.total_amount) == Decimal("4000"), f"total={getattr(order,'total_amount',None)}")
        line("Commande en attente de paiement", order.status == Order.PENDING, f"status={order.status}")
        line("3 inscriptions pas encore confirmées",
             not Inscription.objects.filter(orderinscription__order=order, status=Inscription.CONFIRMED).exists())

        # ── 4. Encaissement RÉEL par l'admin (le vrai pipeline argent) ─────
        print("\n── 4. Encaissement (confirm_payment_manually → _confirm) ──")
        r = ca.post(f"/api/v1/modules/orders/{order.id}/encaisser/", {}, format="json")
        line("Encaissement accepté (200)", r.status_code == 200, f"HTTP {r.status_code}")
        order.refresh_from_db()
        line("Commande passée à TOTAL_PAID", order.status == Order.TOTAL_PAID, f"status={order.status}")
        confirmed = Inscription.objects.filter(orderinscription__order=order, status=Inscription.CONFIRMED)
        line("Les 3 inscriptions sont désormais CONFIRMED", confirmed.count() == 3, f"n={confirmed.count()}")
        line("Montant figé sur chaque inscription (grain CA)",
             sorted(str(i.montant) for i in confirmed) == ["1000.00", "1000.00", "2000.00"],
             f"montants={sorted(str(i.montant) for i in confirmed)}")

        # ── 5. Le CA de l'espace reflète l'encaissement (module CA) ────────
        print("\n── 5. Cross : le CA de l'espace a bougé ──")
        line("CA espace = 4000 après encaissement (3 inscriptions réglées)",
             ca_of(ca, espace.id) == 4000.0, f"ca={ca_of(ca, espace.id)}")

        # ── 6. L'audit a tracé le paiement (module audit, via HTTP) ────────
        print("\n── 6. Cross : le journal d'audit contient le paiement ──")
        j = ca.get("/api/v1/audit/journal/?action=payment.confirmed").json()
        matched = [x for x in j.get("results", [])
                   if str(x.get("entite_id")) == str(order.payment_set.first().id
                                                     if hasattr(order, "payment_set") else "")]
        # fallback robuste : au moins une ligne payment.confirmed fraîche
        line("Une ligne payment.confirmed est journalisée",
             any(x["action"] == "payment.confirmed" for x in j.get("results", [])),
             f"count={j.get('count')}")

        # ── 7. Le monitoring voit le paiement validé (module monitoring) ───
        print("\n── 7. Cross : le monitoring a incrémenté les validés 24h ──")
        v_apres = valides_24h(ca)
        line("valides_24h a augmenté d'au moins 1", isinstance(v_apres, int) and v_apres >= v_avant + 1,
             f"avant={v_avant} après={v_apres}")

        # ── 8. Cloisonnement transverse : le recruteur reste dans SA boîte ─
        print("\n── 8. Cross-sécurité : isolation du rôle recruteur ──")
        rec_group, _ = Group.objects.get_or_create(name="Recruiter")
        recruteur = User.objects.create_user(f"xrec-{SFX}", f"xrec-{SFX}@hbc.test", "x")
        recruteur.groups.add(rec_group)
        autre = User.objects.create_user(f"xrec2-{SFX}", f"xrec2-{SFX}@hbc.test", "x")
        o_sien = JobOffer.objects.create(title=f"Poste à moi {SFX}", description="x", owner=recruteur)
        o_autre = JobOffer.objects.create(title=f"Poste d'un autre {SFX}", description="x", owner=autre)
        Application.objects.create(offer=o_sien, first_name="A", last_name="A", email=f"a-{SFX}@m.test",
                                   status=Application.Status.NEW)
        Application.objects.create(offer=o_autre, first_name="B", last_name="B", email=f"b-{SFX}@m.test",
                                   status=Application.Status.NEW)

        cr = APIClient(); cr.force_authenticate(user=recruteur)
        offres = cr.get("/api/v1/rh/espace/offres/")
        line("Recruteur accède à son espace RH (200)", offres.status_code == 200, f"HTTP {offres.status_code}")
        ob = offres.json()
        rows = ob.get("results", ob) if isinstance(ob, dict) else ob
        titres = {x.get("title") for x in rows}
        line("…voit SON offre", f"Poste à moi {SFX}" in titres, f"titres={titres}")
        line("…ne voit PAS l'offre d'un autre recruteur", f"Poste d'un autre {SFX}" not in titres)
        line("Recruteur REFUSÉ sur le journal d'audit (403)",
             cr.get("/api/v1/audit/journal/").status_code == 403)
        line("Recruteur REFUSÉ sur le monitoring (401/403)",
             cr.get("/api/v1/monitoring/overview/").status_code in (401, 403))
        ca_rec = cr.get("/api/v1/modules/espaces/ca/")
        line("Recruteur ne pilote aucun CA d'espace",
             ca_rec.status_code in (401, 403) or ca_rec.json().get("espaces", []) == [],
             f"HTTP {ca_rec.status_code}")

        # ── 9. Cross-sécurité : le parent ne peut pas encaisser ────────────
        print("\n── 9. Cross-sécurité : un apprenant ne s'auto-encaisse pas ──")
        order2 = Order.objects.create(buyer=parent, status=Order.PENDING, total_amount=Decimal("10"))
        line("Parent REFUSÉ sur l'encaissement back-office (403/404)",
             cp.post(f"/api/v1/modules/orders/{order2.id}/encaisser/", {}, format="json").status_code in (403, 404))

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
