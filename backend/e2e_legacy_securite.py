"""E2E de non-régression : l'application historique ne fuit pas de données.

L'ancienne app Django (templates) est toujours routée à côté de l'API. Ses vues
décidaient des droits par appartenance à un groupe, avec une branche « else »
réservée aux administrateurs — or un visiteur ANONYME n'appartient à aucun
groupe et tombait donc dans cette branche : il obtenait toutes les réservations
(e-mails et téléphones des parents), marqué `admin=True`, sans authentification.

Le privilège doit être accordé explicitement, jamais obtenu par défaut.

Lancer : POSTGRES_DB= DEBUG=True ../.venv_local/bin/python e2e_legacy_securite.py
"""
import json
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Algomaat.settings")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
from django.contrib.auth.models import Group, User
from django.test import Client

OK, KO = "\033[92mOK\033[0m", "\033[91mKO\033[0m"
step = fails = 0


def line(label, ok, extra=""):
    global step, fails
    step += 1
    if not ok:
        fails += 1
    print(f"  [{step:02d}] {OK if ok else KO}  {label}" + (f"  — {extra}" if extra else ""))
    return ok


def get(url, user=None):
    c = Client()
    if user:
        c.force_login(user)
    r = c.get(url)
    try:
        data = json.loads(r.content)
    except Exception:  # noqa: BLE001 — page HTML (erreur) plutôt que JSON
        data = None
    return r, data


print("\n" + "=" * 72)
print("  E2E SÉCURITÉ DE L'APP HISTORIQUE — HBC-RH")
print("=" * 72)

URL_RES = "/bucket/ajax_get_reservations"
URL_USERS = "/bucket/ajax_get_reservated_users"

# ── 1. Anonyme : rien, jamais ────────────────────────────────────────────
print("\n── 1. Un visiteur anonyme n'obtient aucune donnée ──")
r, data = get(URL_RES)
line("Réservations : réponse servie sans erreur", r.status_code == 200, f"{r.status_code}")
line("Réservations : aucune donnée pour l'anonyme", data == [], str(data)[:60])

r, data = get(URL_USERS)
line("Utilisateurs réservataires : pas de 500 sur l'anonyme", r.status_code == 200, f"{r.status_code}")
line("Utilisateurs réservataires : liste vide", data == [], str(data)[:60])

# Le cœur du sujet : aucune donnée personnelle ne doit sortir sans session.
r, data = get(URL_RES)
brut = r.content.decode(errors="ignore")
line("Aucun e-mail exposé à l'anonyme", "@" not in brut, brut[:60])
line("L'anonyme n'est jamais marqué admin", '"admin": true' not in brut.lower())

# ── 2. L'usage légitime reste intact ────────────────────────────────────
print("\n── 2. Les accès légitimes ne sont pas cassés ──")
admin = User.objects.filter(is_superuser=True).first()
r, data = get(URL_RES, admin)
line("L'administrateur voit toujours les réservations", r.status_code == 200 and isinstance(data, list),
     f"{r.status_code} / {len(data) if isinstance(data, list) else '-'} enr.")
if data:
    line("…et il est bien marqué admin", data[0].get("admin") is True)

# ── 3. Un profil non-admin n'hérite pas des droits admin ────────────────
print("\n── 3. Aucun profil n'obtient « admin » par défaut ──")
teacher = User.objects.filter(username="formateur1").first()
if teacher:
    r, data = get(URL_RES, teacher)
    # Avant : le formateur n'étant ni Simple_Customer ni Parent, il tombait dans
    # la branche « else » et voyait TOUTES les réservations.
    line("Le formateur ne récupère pas toutes les réservations",
         isinstance(data, list) and not any(d.get("admin") for d in data),
         f"{len(data) if isinstance(data, list) else '-'} enr.")

cust = Group.objects.filter(name="Simple_Customer").first()
u = cust.user_set.first() if cust else None
if u:
    r, data = get(URL_RES, u)
    line("Un client ne voit que son propre périmètre",
         isinstance(data, list) and not any(d.get("admin") for d in data),
         f"{len(data) if isinstance(data, list) else '-'} enr.")

# ── 4. Annuaire des comptes ─────────────────────────────────────────────
print("\n── 4. L'annuaire des comptes n'est pas public ──")
r, data = get("/registration/ajax_get_users/")
line("Anonyme : aucun compte listé", data == [], f"{len(data) if isinstance(data, list) else data}")
line("Aucun e-mail dans la réponse", "@" not in r.content.decode(errors="ignore"))
r, data = get("/registration/ajax_get_users/", admin)
line("L'administrateur garde l'annuaire", isinstance(data, list) and len(data) > 0,
     f"{len(data) if isinstance(data, list) else '-'} compte(s)")
if u:
    r, data = get("/registration/ajax_get_users/", u)
    line("Un client n'obtient pas l'annuaire", data == [], str(data)[:40])

# ── 4bis. Fiche utilisateur : jamais le hash du mot de passe ────────────
print("\n── 4bis. La fiche d'un compte n'expose pas son mot de passe ──")
r, data = get(f"/registration/ajax_get_user/{admin.id}")
line("Anonyme : fiche utilisateur refusée", r.status_code == 403, f"HTTP {r.status_code}")
line("Aucun hash dans la réponse", "pbkdf2" not in r.content.decode(errors="ignore"))
r, data = get(f"/registration/ajax_get_user/{admin.id}", admin)
line("L'administrateur garde la fiche", r.status_code == 200 and (data or {}).get("id") == admin.id,
     f"HTTP {r.status_code}")
line("…mais le hash n'y figure plus (aucun écran n'en a l'usage)",
     "password" not in (data or {}), str(sorted((data or {}).keys())))
if u:
    r, _ = get(f"/registration/ajax_get_user/{admin.id}", u)
    line("Un client ne consulte pas la fiche d'autrui", r.status_code == 403, f"HTTP {r.status_code}")

# ── 5. Commandes ────────────────────────────────────────────────────────
print("\n── 5. Les commandes ne sont pas publiques ──")
r, data = get("/paiement/ajax_get_order_data")
line("Anonyme : aucune commande", data == [], f"{len(data) if isinstance(data, list) else data}")
r, data = get("/paiement/ajax_get_order_data", admin)
line("L'administrateur garde toutes les commandes", isinstance(data, list) and len(data) > 0,
     f"{len(data) if isinstance(data, list) else '-'} commande(s)")
if u:
    r, data = get("/paiement/ajax_get_order_data", u)
    autres = [o for o in data if o.get("created_by_id") != u.id] if isinstance(data, list) else []
    line("Un client ne voit aucune commande d'autrui", not autres, f"{len(autres)} fuite(s)")

# ── 6. Création de compte administrateur ────────────────────────────────
print("\n── 6. Personne ne se fabrique un compte admin ──")
# La vue créait le compte DANS le groupe demandé puis ouvrait une session
# dessus ; `group_type` valait « Admin » par défaut pour un anonyme, et le
# groupe généré (« None_Admin ») était reconnu par is_admin (name__icontains).
from django.contrib.auth.models import Group as _G

_USERNAME = "e2e_intrus_zz"
User.objects.filter(username=_USERNAME).delete()
groupes_avant = set(_G.objects.values_list("name", flat=True))
grp = _G.objects.filter(name__iexact="Admin").first()

c_anon = Client()
r = c_anon.post("/registration/admin_new_user/", {
    "firstname": "Intrus", "username": _USERNAME, "email": "intrus@evil.test",
    "password1": "Intrus@2026xyz", "password2": "Intrus@2026xyz",
    "group": grp.id if grp else "",
})
line("Anonyme : création de compte admin refusée", r.status_code == 403, f"HTTP {r.status_code}")
line("…et aucun compte n'a été créé", not User.objects.filter(username=_USERNAME).exists())
line("…ni aucun groupe fabriqué au passage",
     set(_G.objects.values_list("name", flat=True)) == groupes_avant)

if teacher:
    c_t = Client()
    c_t.force_login(teacher)
    r = c_t.post("/registration/admin_new_user/", {
        "firstname": "T", "username": _USERNAME, "email": "t@evil.test",
        "password1": "Tt@2026abcd", "password2": "Tt@2026abcd", "group": grp.id if grp else "",
    })
    line("Un formateur non plus", r.status_code == 403, f"HTTP {r.status_code}")

r = Client()
r.force_login(admin)
line("L'administrateur garde l'accès au formulaire",
     r.get("/registration/admin_new_user/").status_code == 200)

# Nettoyage (le test ne doit rien laisser derrière lui).
User.objects.filter(username=_USERNAME).delete()
for nom in set(_G.objects.values_list("name", flat=True)) - groupes_avant:
    _G.objects.filter(name=nom).delete()

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
