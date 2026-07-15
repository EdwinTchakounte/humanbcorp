"""E2E de non-régression sur l'application historique (débranchée).

Cette app Django à templates a été écrite sans modèle d'autorisation : les
droits s'y déduisaient de l'appartenance à un groupe, avec une branche « else »
réservée aux administrateurs — où tout visiteur ANONYME atterrissait, n'étant
membre d'aucun groupe. Sept failles exploitables sans session en sont sorties.

Elle est désormais débranchée (Algomaat/urls.py). Ce test vérifie DEUX niveaux :

  1. les routes ne répondent plus du tout — c'est ce qui ferme la classe entière ;
  2. les vues elles-mêmes restent fail-closed, appelées en direct. Ce second
     niveau garde sa valeur le jour où quelqu'un rebranche une route : la
     protection ne doit pas reposer sur le seul urls.py.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_legacy_securite.py
"""
import json
import os
from decimal import Decimal

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import AnonymousUser, Group, User
from django.test import Client, RequestFactory
from django.utils import timezone

from bucket.models import Order
from calendarapp.models import Event
from paiement.models import PaiementEntrant

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = fails = 0
rf = RequestFactory()


def line(label, ok, extra=""):
    global step, fails
    step += 1
    if not ok:
        fails += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


def call(vue, methode="get", chemin="/x", user=None, data=None, *args, **kwargs):
    """Appelle une vue EN DIRECT (hors routage) pour tester sa protection propre."""
    req = getattr(rf, methode)(chemin, data or {})
    req.user = user or AnonymousUser()
    return vue(req, *args, **kwargs)


def corps(resp):
    try:
        return json.loads(resp.content)
    except Exception:  # noqa: BLE001 — réponse HTML ou vide
        return None


print("\n" + "=" * 72)
print("  E2E SÉCURITÉ DE L'APP HISTORIQUE (DÉBRANCHÉE) — HBC-RH")
print("=" * 72)

admin = User.objects.filter(is_superuser=True).first()
teacher = User.objects.filter(username="formateur1").first()
cust_group = Group.objects.filter(name="Simple_Customer").first()
client = cust_group.user_set.first() if cust_group else None

# ── 1. Les routes ne répondent plus ─────────────────────────────────────
print("\n── 1. L'application historique n'est plus routée ──")
c = Client()
ROUTES = [
    "/", "/about/", "/administration/", "/d/", "/bucket/",
    "/bucket/ajax_get_reservations", "/registration/ajax_get_users/",
    "/registration/ajax_get_user/2", "/registration/admin_new_user/",
    "/paiement/ajax_get_order_data", "/paiement/entrant/",
    "/calendarapp/delete_event/1/", "/lessonapp/", "/chat/",
    "/publications/search/", "/spaces/show_all_spaces/", "/accounts/login/",
]
injoignables = [u for u in ROUTES if c.get(u).status_code == 404]
line(f"Les {len(ROUTES)} routes historiques renvoient 404",
     len(injoignables) == len(ROUTES),
     f"{len(injoignables)}/{len(ROUTES)} — restantes : {[u for u in ROUTES if u not in injoignables]}")

# ── 2. L'API et l'admin Django survivent ────────────────────────────────
print("\n── 2. Ce qui doit vivre n'a pas été emporté ──")
for url, attendu, label in [
    ("/api/v1/site/formations/", 200, "catalogue public"),
    ("/api/v1/site/nav/", 200, "navigation vitrine"),
    ("/api/v1/site/settings/", 200, "réglages du site"),
    ("/api/v1/site/documents/", 200, "documents publics"),
    ("/api/v1/modules/suivi/", 401, "suivi (auth exigée)"),
]:
    r = c.get(url)
    line(f"API — {label}", r.status_code == attendu, f"HTTP {r.status_code}")
line("Admin Django accessible (redirige vers son login)", c.get("/admin/").status_code == 302)
# L'admin appelle get_absolute_url pour « Voir sur le site » : sans garde-fou,
# le débranchement de calendarapp le ferait tomber en NoReverseMatch.
ev = Event.objects.first()
line("Event.get_absolute_url ne casse plus l'admin (NoReverseMatch)",
     ev is None or ev.get_absolute_url() is None)

# ── 3. Défense en profondeur : les vues restent fail-closed ─────────────
# Rebrancher une route ne doit pas rouvrir les failles : on appelle les vues
# directement, hors routage.
print("\n── 3. Même rebranchées, les vues refusent l'anonyme ──")
from bucket.views import ajax_get_reservations
from paiement.views import ajax_get_order_data, paiement_entrant
from registration.views import admin_new_user_view, ajax_get_user, ajax_get_users
from calendarapp.views.other_views import delete_event

line("Réservations : rien pour l'anonyme", corps(call(ajax_get_reservations)) == [])
line("Annuaire des comptes : rien pour l'anonyme", corps(call(ajax_get_users)) == [])
r = call(ajax_get_user, user=AnonymousUser(), user_id=admin.id)
line("Fiche utilisateur : refusée à l'anonyme", r.status_code == 403, f"HTTP {r.status_code}")
line("Commandes : rien pour l'anonyme", corps(call(ajax_get_order_data)) == [])

# Le hash du mot de passe ne doit sortir pour personne, admin compris.
r = call(ajax_get_user, user=admin, user_id=admin.id)
d = corps(r) or {}
line("Fiche utilisateur : l'admin la consulte", r.status_code == 200 and d.get("id") == admin.id)
line("…sans jamais exposer le hash du mot de passe", "password" not in d, str(sorted(d.keys())))

# Création de compte administrateur.
r = call(admin_new_user_view, "post", user=AnonymousUser(), data={"username": "x"})
line("Création de compte admin : refusée à l'anonyme", r.status_code == 403, f"HTTP {r.status_code}")
if teacher:
    r = call(admin_new_user_view, "post", user=teacher, data={"username": "x"})
    line("…refusée au formateur également", r.status_code == 403, f"HTTP {r.status_code}")
line("Aucun groupe « None_Admin » n'existe en base",
     not Group.objects.filter(name__icontains="None_").exists())

# Destruction d'événement.
ev = Event.objects.create(user=admin, title="e2e-securite-jetable", description="",
                          start_time=timezone.now(), end_time=timezone.now())
r = call(delete_event, "post", user=AnonymousUser(), event_id=ev.id)
line("Suppression d'événement : refusée à l'anonyme", r.status_code == 403, f"HTTP {r.status_code}")
line("…et l'événement est intact", Event.objects.filter(pk=ev.id).exists())
r = call(delete_event, "post", user=admin, event_id=ev.id)
line("L'administrateur supprime toujours",
     r.status_code == 200 and not Event.objects.filter(pk=ev.id).exists(), f"HTTP {r.status_code}")
Event.objects.filter(pk=ev.id).delete()

# Encaissement : un POST anonyme marquait une commande payée sans paiement.
order = Order.objects.create(buyer=admin, status=Order.PENDING, total_amount=Decimal("50000"))
avant = PaiementEntrant.objects.count()
r = call(paiement_entrant, "post", user=AnonymousUser(),
         data={"payerId": admin.id, "orderId": order.id, "tranche_name": "0"})
order.refresh_from_db()
line("Encaissement : refusé à l'anonyme", r.status_code == 403, f"HTTP {r.status_code}")
line("…la commande reste impayée", order.status == Order.PENDING, f"statut={order.status}")
line("…et aucun paiement n'a été fabriqué", PaiementEntrant.objects.count() == avant)
if teacher:
    r = call(paiement_entrant, "post", user=teacher,
             data={"payerId": admin.id, "orderId": order.id, "tranche_name": "0"})
    order.refresh_from_db()
    line("…refusé au formateur également", r.status_code == 403 and order.status == Order.PENDING,
         f"HTTP {r.status_code}")
PaiementEntrant.objects.filter(order=order).delete()
order.delete()

# ── 4. Les accès légitimes ne sont pas cassés ───────────────────────────
print("\n── 4. L'administrateur garde ses accès ──")
line("Annuaire complet", len(corps(call(ajax_get_users, user=admin)) or []) > 0,
     f"{len(corps(call(ajax_get_users, user=admin)) or [])} compte(s)")
line("Commandes complètes", len(corps(call(ajax_get_order_data, user=admin)) or []) > 0,
     f"{len(corps(call(ajax_get_order_data, user=admin)) or [])} commande(s)")
if client:
    d = corps(call(ajax_get_order_data, user=client)) or []
    autres = [o for o in d if o.get("created_by_id") != client.id]
    line("Un client ne voit aucune commande d'autrui", not autres, f"{len(autres)} fuite(s)")
    line("…et n'obtient pas l'annuaire", corps(call(ajax_get_users, user=client)) == [])

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
