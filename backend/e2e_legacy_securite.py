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

print("\n" + "=" * 72)
print(f"  RÉSULTAT : {step - fails}/{step} étapes OK" + ("" if not fails else f"  ({fails} échec(s))"))
print("=" * 72 + "\n")
raise SystemExit(1 if fails else 0)
