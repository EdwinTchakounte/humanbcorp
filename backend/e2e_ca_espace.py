"""E2E de l'attribution du CA par espace (Étape 3) — in-process, SQLite dev.

L'encaissement est centralisé (portefeuille super-admin), mais chaque école a
son suivi propre : souscriptions rattachées + chiffre d'affaires. On vérifie que
l'attribution se fige au grain de la souscription (`Inscription.espace`, dérivé
de la publication), que le CA encaissé ne compte que les souscriptions
confirmées, et que le périmètre est bon (responsable = son école ; formateur
rattaché = rien ; super-admin = tout).

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_ca_espace.py
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
from rest_framework.test import APIClient

from contents.models import Publication, Category
from bucket.models import Inscription, Order, OrderInscription
from espaces.models import Espace, Membership

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
print("  E2E CHIFFRE D'AFFAIRES PAR ESPACE — HBC-RH")
print("=" * 72)

teacher_group, _ = Group.objects.get_or_create(name="Teacher")
cat = Category.objects.first() or Category.objects.create(name=f"cat-{SFX}")

# ── Décor : deux écoles, leurs responsables, un formateur rattaché ────────
print("\n── Décor : École Alpha & École Beta, chacune son responsable ──")
alpha = Espace.objects.create(nom=f"Alpha {SFX}", is_active=True)
beta = Espace.objects.create(nom=f"Beta {SFX}", is_active=True)

r_alpha = User.objects.create(username=f"ralpha-{SFX}", email=f"ralpha-{SFX}@hbc.test")
r_beta = User.objects.create(username=f"rbeta-{SFX}", email=f"rbeta-{SFX}@hbc.test")
formateur = User.objects.create(username=f"form-{SFX}", email=f"form-{SFX}@hbc.test")
formateur.groups.add(teacher_group)

Membership.objects.create(user=r_alpha, espace=alpha, role=Membership.Role.RESPONSABLE)
Membership.objects.create(user=r_beta, espace=beta, role=Membership.Role.RESPONSABLE)
Membership.objects.create(user=formateur, espace=alpha, role=Membership.Role.FORMATEUR)

admin = User.objects.filter(is_superuser=True).first()
if admin is None:
    admin = User.objects.create_superuser(f"admin-{SFX}", f"admin-{SFX}@hbc.test", "x")

# Publications : 2 chez Alpha (1000, 500), 1 chez Beta (2000).
pa1 = Publication.objects.create(title=f"A1 {SFX}", description="a1", price=Decimal("1000"),
                                 categorie=cat, is_private=False, espace=alpha)
pa2 = Publication.objects.create(title=f"A2 {SFX}", description="a2", price=Decimal("500"),
                                 categorie=cat, is_private=False, espace=alpha)
pb1 = Publication.objects.create(title=f"B1 {SFX}", description="b1", price=Decimal("2000"),
                                 categorie=cat, is_private=False, espace=beta)


def app(n):
    return User.objects.create(username=f"app{n}-{SFX}", email=f"app{n}-{SFX}@hbc.test")


def vendre(participant, pub):
    """Souscription réellement VENDUE : inscription confirmée + commande RÉGLÉE.

    C'est ce que compte le CA « encaissé » : le montant figé de l'inscription,
    rattachée à un Order TOTAL_PAID (comme le vrai flux paiement/encaissement).
    """
    insc = Inscription.objects.create(participant=participant, publication=pub, status=Inscription.CONFIRMED)
    order = Order.objects.create(buyer=participant, status=Order.TOTAL_PAID, total_amount=pub.price)
    OrderInscription.objects.create(order=order, inscription=insc)
    return insc


def offrir(participant, pub):
    """Place OFFERTE : inscription confirmée SANS commande réglée (comme `inscrire`).
    Elle compte comme souscription, mais 0 au CA — c'est le cœur du correctif E1."""
    return Inscription.objects.create(participant=participant, publication=pub, status=Inscription.CONFIRMED)


# ── 1. L'espace de la souscription se dérive de la publication ───────────
print("\n── 1. Attribution auto au grain de la souscription ──")
i1 = vendre(app(1), pa1)
line("Inscription hérite de l'espace de sa publication (sans le préciser)",
     i1.espace_id == alpha.id, f"espace={i1.espace_id} attendu={alpha.id}")

# Alpha : 3 VENDUES (1000 + 1000 + 500 = 2500) + 1 OFFERTE (confirmée mais hors CA)
# + 1 en attente ; 5 apprenants distincts.
vendre(app(2), pa1)
vendre(app(3), pa2)
offrir(app(6), pa2)  # place offerte : confirmée, mais 0 au CA
Inscription.objects.create(participant=app(4), publication=pa1, status=Inscription.WAITING)
# Beta : 1 vendue (2000).
vendre(app(5), pb1)

ca_client = APIClient()


def ca_as(user):
    ca_client.force_authenticate(user=user)
    return ca_client.get("/api/v1/modules/espaces/ca/")


def find(items, espace_id):
    return next((x for x in items if x["id"] == espace_id), None)


# ── 2. Le responsable voit SON école, et seulement elle ─────────────────
print("\n── 2. Périmètre : le responsable ne voit que son espace ──")
r = ca_as(r_alpha)
line("Responsable Alpha : accès OK", r.status_code == 200, f"HTTP {r.status_code}")
items = r.json().get("espaces", []) if r.status_code == 200 else []
ids = {x["id"] for x in items}
line("…voit Alpha", alpha.id in ids)
line("…ne voit PAS Beta", beta.id not in ids, f"ids={ids}")

a = find(items, alpha.id) or {}
line("CA encaissé Alpha = 2500 (3 vendues ; l'attente ET l'offerte exclues)",
     a.get("ca_encaisse") == 2500.0, f"ca={a.get('ca_encaisse')}")
sous = a.get("souscriptions", {})
line("Souscriptions Alpha : 5 total / 4 confirmées / 1 en attente",
     sous.get("total") == 5 and sous.get("confirmed") == 4 and sous.get("waiting") == 1,
     f"{sous}")
line("Place offerte : comptée en souscription (4 confirmées) mais PAS au CA (2500)",
     sous.get("confirmed") == 4 and a.get("ca_encaisse") == 2500.0,
     f"confirmed={sous.get('confirmed')} ca={a.get('ca_encaisse')}")
line("Apprenants distincts Alpha = 5", a.get("apprenants") == 5, f"n={a.get('apprenants')}")

# ── 3. Symétrie : le responsable Beta voit Beta, pas Alpha ──────────────
print("\n── 3. Symétrie de l'isolation ──")
r = ca_as(r_beta)
items = r.json().get("espaces", [])
ids = {x["id"] for x in items}
line("Responsable Beta voit Beta, pas Alpha", beta.id in ids and alpha.id not in ids, f"ids={ids}")
b = find(items, beta.id) or {}
line("CA encaissé Beta = 2000", b.get("ca_encaisse") == 2000.0, f"ca={b.get('ca_encaisse')}")

# ── 4. Un formateur rattaché ne pilote pas le CA ────────────────────────
print("\n── 4. Le formateur rattaché n'a pas le CA de l'école ──")
r = ca_as(formateur)
items = r.json().get("espaces", [])
line("Formateur : aucun espace piloté (CA hors de son rôle)", items == [], f"items={items}")

# ── 5. Le super-admin voit les deux écoles ──────────────────────────────
print("\n── 5. Le super-admin transcende les espaces ──")
r = ca_as(admin)
items = r.json().get("espaces", [])
ids = {x["id"] for x in items}
line("Admin voit Alpha ET Beta", alpha.id in ids and beta.id in ids)
a = find(items, alpha.id) or {}
b = find(items, beta.id) or {}
line("Admin : CA Alpha=2500 et Beta=2000",
     a.get("ca_encaisse") == 2500.0 and b.get("ca_encaisse") == 2000.0,
     f"alpha={a.get('ca_encaisse')} beta={b.get('ca_encaisse')}")

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + (f"  ({fails} échec(s))" if fails else ""))
print("=" * 72)
