"""Permissions DRF attendues par les modules greffés (payments/notifications).

Mappées sur la logique de rôles HBC-RH (`sitecms.roles.is_admin` = superuser ou
membre d'un groupe « admin »). L'app d'origine distinguait Member/Staff/Admin ;
ici :
- IsMember : tout utilisateur authentifié (un « membre » = un compte).
- IsStaff / IsAdmin : profils administrateurs (Admin/Second_Admin ou superuser).
"""
from __future__ import annotations

from rest_framework.permissions import BasePermission

from sitecms.roles import is_admin


class IsMember(BasePermission):
    """Utilisateur authentifié."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsStaff(BasePermission):
    """Profil administrateur (gère les paiements/annonces côté back-office)."""

    def has_permission(self, request, view):
        return is_admin(request.user)


class IsAdmin(BasePermission):
    """Profil administrateur (mêmes droits que IsStaff pour HBC-RH)."""

    def has_permission(self, request, view):
        return is_admin(request.user)
