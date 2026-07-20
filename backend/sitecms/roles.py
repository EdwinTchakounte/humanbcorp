"""Logique de rôles/profils — calquée sur l'application de base.

L'app d'origine gère l'accès par **appartenance à un groupe** (Admin, Second_Admin,
Teacher, Parent, Author, Simple_Customer). Le helper historique `is_admin`
(context processor `registration.user_is_admin`) considère « admin » tout groupe
dont le nom contient « admin ».

On réutilise scrupuleusement cette logique pour :
- réserver le **CMS** aux profils admin (Admin + Second_Admin) ;
- exposer au dashboard la liste des **modules** accessibles selon le profil, chacun
  gated par les permissions Django de son app (comme le fait déjà le Django admin).
"""


import re

# Groupes conférant le rôle admin. Le préfixe numérique optionnel est un héritage
# de l'application historique, qui nommait ses groupes « {user_id}_{groupe} » —
# d'où « 2_Second_Admin » en base.
#
# La règle précédente (« le nom contient admin ») était trop large : elle
# reconnaissait n'importe quel groupe fabriqué, ce qui rendait exploitable la
# prise de contrôle par /registration/admin_new_user/ (groupe « None_Admin »).
# Le vecteur est fermé, mais un privilège ne doit pas tenir à une sous-chaîne.
_GROUPE_ADMIN = re.compile(r"^(?:\d+_)?(?:admin|second_admin)$", re.IGNORECASE)


def is_admin(user):
    """Vrai si superuser OU membre d'un groupe Admin / Second_Admin."""
    if not (user and user.is_authenticated):
        return False
    if user.is_superuser:
        return True
    # Filtrage en Python : la comparaison est exacte et identique quel que soit
    # le moteur de base (les regex SQL diffèrent entre SQLite et PostgreSQL).
    return any(_GROUPE_ADMIN.match(nom) for nom in user.groups.values_list("name", flat=True))


def is_teacher(user):
    """Vrai si membre du groupe « Teacher » (formateur). Un admin n'est pas un
    formateur au sens périmètre restreint, mais garde tous les droits par ailleurs."""
    if not (user and user.is_authenticated):
        return False
    return user.groups.filter(name__iexact="Teacher").exists()


# Groupe marquant un **apprenant** (a souscrit à une formation). Simple étiquette :
# il ne confère aucun accès dashboard (module_is_accessible le renvoie à False),
# il sert à distinguer un apprenant d'un membre du staff au login et à orienter
# l'interface (vitrine « mon espace » vs dashboard).
LEARNER_GROUP = "Learner"


def is_learner(user):
    """Vrai si membre du groupe « Learner » (apprenant ayant un espace)."""
    if not (user and user.is_authenticated):
        return False
    return user.groups.filter(name__iexact=LEARNER_GROUP).exists()


# Groupe marquant un **recruteur** : une entreprise cliente disposant d'un compte
# de suivi en LECTURE SEULE sur SES offres (celles dont il est `owner`). Il ne
# publie pas, ne fait pas avancer le pipeline et ne voit pas les notes internes
# HBC — la publication et le suivi restent la main du super-admin (étape
# intermédiaire, pas encore un tenant self-service).
RECRUITER_GROUP = "Recruiter"


def is_recruiter(user):
    """Vrai si membre du groupe « Recruiter » (entreprise avec espace de suivi)."""
    if not (user and user.is_authenticated):
        return False
    return user.groups.filter(name__iexact=RECRUITER_GROUP).exists()


def _has_app_access(user, app_label):
    """Lecture : au moins une permission sur cette app (comme le Django admin)."""
    if user.is_superuser:
        return True
    return any(perm.split(".")[0] == app_label for perm in user.get_all_permissions())


def has_app_write(user, app_label):
    """Écriture : au moins une perm add/change/delete sur cette app (ou admin)."""
    if is_admin(user):
        return True
    for perm in user.get_all_permissions():
        app, _, codename = perm.partition(".")
        if app == app_label and codename.split("_")[0] in ("add", "change", "delete"):
            return True
    return False


# Registre des modules du dashboard.
# - native=True  → écran dédié dans le dashboard Next (rapatrié).
# - native=False → pont vers le Django admin de l'app (gated par permissions).
# - admin_only=True → réservé aux profils « admin » (Admin/Second_Admin).
# - teacher=True → accessible aussi aux formateurs (groupe Teacher), avec un
#   périmètre restreint à leurs formations affecté au niveau des querysets.
MODULES = [
    {"key": "cms",         "label": "Contenu du site",       "icon": "bx-layout",       "native": True,  "path": "/",        "admin_only": True},
    {"key": "agenda",      "label": "Agenda & Événements",   "icon": "bx-calendar",     "native": True,  "path": "/agenda",  "app": "calendarapp", "teacher": True},
    {"key": "formations",  "label": "Formations",            "icon": "bx-book",         "native": True,  "path": "/formations", "app": "lessonapp", "teacher": True},
    {"key": "suivi",       "label": "Suivi apprenants",      "icon": "bx-line-chart",   "native": True,  "path": "/suivi",   "teacher": True},
    {"key": "publications","label": "Publications",          "icon": "bx-news",         "native": True,  "path": "/publications", "app": "contents"},
    {"key": "inscriptions","label": "Inscriptions & Paniers","icon": "bx-cart",         "native": True,  "path": "/inscriptions", "app": "bucket"},
    {"key": "paiements",   "label": "Paiements",             "icon": "bx-credit-card",  "native": True,  "path": "/paiements", "app": "paiement"},
    {"key": "messagerie",  "label": "Messagerie",            "icon": "bx-chat",         "native": True,  "path": "/messagerie", "app": "chat"},
    # RH / recrutement : outil PLATEFORME du super-admin, hors espaces (non-tenant).
    {"key": "rh",          "label": "RH & Recrutement",      "icon": "bx-briefcase",    "native": True,  "path": "/rh",      "admin_only": True},
    # Journal d'audit : traçabilité des actions sensibles, super-admin uniquement.
    {"key": "audit",       "label": "Journal d'audit",       "icon": "bx-history",      "native": True,  "path": "/journal", "admin_only": True},
    # Monitoring : santé technique + activité, super-admin uniquement.
    {"key": "monitoring",  "label": "Monitoring",            "icon": "bx-pulse",        "native": True,  "path": "/monitoring", "admin_only": True},
    # Espace recruteur : fenêtre de suivi en lecture seule, réservée au groupe
    # Recruiter et à LUI SEUL (le super-admin a déjà /rh). Périmètre = ses offres.
    {"key": "rh_espace",   "label": "Mes recrutements",      "icon": "bx-user-check",   "native": True,  "path": "/mes-recrutements", "recruiter": True},
]


def module_is_accessible(user, module):
    # Module recruteur : exclusif au groupe Recruiter (même un admin ne le voit
    # pas — il dispose de /rh). Testé en premier pour rester exclusif.
    if module.get("recruiter"):
        return is_recruiter(user)
    if module.get("admin_only"):
        return is_admin(user)
    if is_admin(user):
        return True
    # Formateur (auteur limité) : périmètre STRICT aux modules « teacher »
    # (formations/agenda/suivi), indépendamment des permissions Django héritées
    # du groupe Teacher — on ne veut pas lui exposer paiements/inscriptions/etc.
    if is_teacher(user):
        return bool(module.get("teacher"))
    # Recruteur (sans autre rôle) : aucun module de gestion, seulement le sien
    # (déjà traité ci-dessus) — on ne lui expose pas formations/paiements/etc.
    if is_recruiter(user):
        return False
    app = module.get("app")
    return _has_app_access(user, app) if app else False


def module_can_write(user, module):
    """Droit d'écriture (créer/éditer/supprimer) sur ce module pour ce profil."""
    # L'espace recruteur est en lecture seule : il consulte, il n'écrit jamais.
    if module.get("recruiter"):
        return False
    if module.get("admin_only"):
        return is_admin(user)
    if is_admin(user):
        return True
    if is_teacher(user):
        return bool(module.get("teacher"))
    app = module.get("app")
    return has_app_write(user, app) if app else False


def accessible_modules(user):
    """Modules visibles pour ce profil (avec href du pont admin pour les non-natifs)."""
    out = []
    for m in MODULES:
        if not module_is_accessible(user, m):
            continue
        item = {
            "key": m["key"],
            "label": m["label"],
            "icon": m["icon"],
            "native": m["native"],
            "can_write": module_can_write(user, m),
        }
        if m["native"]:
            item["path"] = m["path"]
        else:
            item["admin_path"] = f"/admin/{m['app']}/"
        out.append(item)
    return out


def profile_payload(user):
    """Charge utile renvoyée par /auth/me/ et incluse dans le JWT."""
    groups = list(user.groups.values_list("name", flat=True))
    return {
        "id": user.id,
        "username": user.username,
        "full_name": (user.get_full_name() or user.username),
        "email": user.email,
        "is_admin": is_admin(user),
        "is_teacher": is_teacher(user),
        "is_recruiter": is_recruiter(user),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "groups": groups,
        "modules": accessible_modules(user),
    }
