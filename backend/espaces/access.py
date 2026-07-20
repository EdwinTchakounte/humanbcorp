"""Helpers d'accès multi-tenant — calqués sur le style de ``sitecms/roles.py``.

Ces fonctions résolvent, pour un utilisateur donné, les espaces auxquels il
appartient et son rôle, et exposent le *gate de durée*. Le super-admin (au sens
``sitecms.roles.is_admin``) transcende les espaces : il les voit tous.

À l'étape 1 ces helpers ne filtrent encore aucune donnée métier : ils sont la
brique de base que les viewsets/scoping consommeront aux étapes suivantes.
"""

from espaces.models import Espace, Membership


def _is_superadmin(user):
    """Super-admin plateforme : superuser ou groupe Admin/Second_Admin."""
    # Import local : évite un cycle d'import au chargement des apps.
    from sitecms.roles import is_admin

    return is_admin(user)


def active_memberships(user):
    """QuerySet des rattachements actifs de l'utilisateur, vers des espaces actifs."""
    if not (user and user.is_authenticated):
        return Membership.objects.none()
    return (
        Membership.objects.filter(user=user, is_active=True, espace__is_active=True)
        .select_related("espace")
    )


def espaces_for(user):
    """Espaces visibles par l'utilisateur.

    - Super-admin plateforme → tous les espaces actifs.
    - Autre → les espaces où il a un rattachement actif.
    """
    if not (user and user.is_authenticated):
        return Espace.objects.none()
    if _is_superadmin(user):
        return Espace.objects.filter(is_active=True)
    ids = active_memberships(user).values_list("espace_id", flat=True)
    return Espace.objects.filter(id__in=ids, is_active=True)


def roles_in(user, espace):
    """Ensemble des rôles de l'utilisateur dans cet espace (vide si aucun)."""
    if not (user and user.is_authenticated and espace):
        return set()
    return set(
        active_memberships(user).filter(espace=espace).values_list("role", flat=True)
    )


def is_responsable(user, espace):
    """Vrai si l'utilisateur est responsable de cet espace (ou super-admin)."""
    if _is_superadmin(user):
        return True
    return Membership.Role.RESPONSABLE in roles_in(user, espace)


def can_access_espace(user, espace):
    """Gate complet : appartenance active **et** espace dans sa fenêtre de durée.

    Le super-admin plateforme n'est pas soumis au gate de durée.
    """
    if not espace:
        return False
    if _is_superadmin(user):
        return True
    if not espace.est_actif():
        return False
    return active_memberships(user).filter(espace=espace).exists()


def current_espace(user, espace_id=None):
    """Espace « courant » pour estampiller une création.

    Résolution (en attendant l'adressage par sous-domaine) :
    - `espace_id` fourni et accessible → cet espace ;
    - sinon, l'espace de rattachement de l'utilisateur (1er membership actif) ;
    - sinon (super-admin sans rattachement) → la maison mère par défaut.
    """
    if espace_id:
        esp = Espace.objects.filter(id=espace_id, is_active=True).first()
        if esp and can_access_espace(user, esp):
            return esp
    mem = active_memberships(user).first()
    if mem:
        return mem.espace
    return default_espace()


def default_espace():
    """L'espace « maison mère » par défaut (créé par migration de données).

    Sert de tenant de repli pour rattacher le contenu global historique à
    l'étape 2. Renvoie None s'il n'existe pas encore.
    """
    return Espace.objects.filter(slug=DEFAULT_ESPACE_SLUG).first()


DEFAULT_ESPACE_SLUG = "hbc"
