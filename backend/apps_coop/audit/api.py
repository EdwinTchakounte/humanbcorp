"""API du journal d'audit — réservée au super-admin plateforme, lecture seule.

Le journal est append-only : aucune écriture/suppression n'est exposée. On offre
la consultation filtrable (action, type d'entité, acteur, recherche, plage de
dates) + la liste des valeurs distinctes pour alimenter les filtres du dashboard.
"""
from __future__ import annotations

from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action as drf_action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from sitecms.roles import is_admin

from .models import AuditLog


class IsPlatformAdmin(BasePermission):
    message = "Réservé à l'administration de la plateforme."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_admin(request.user))


class AuditPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "action", "entite_type", "entite_id",
            "user", "user_name", "details", "ip", "created_at",
        ]

    def get_user_name(self, obj):
        u = obj.user
        if not u:
            return None
        return u.get_full_name() or u.username


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /audit/journal/ → journal filtrable (super-admin, lecture seule)."""

    permission_classes = [IsPlatformAdmin]
    serializer_class = AuditLogSerializer
    pagination_class = AuditPagination

    def get_queryset(self):
        qs = AuditLog.objects.select_related("user").all()
        p = self.request.query_params
        if p.get("action"):
            qs = qs.filter(action=p["action"])
        if p.get("entite_type"):
            qs = qs.filter(entite_type=p["entite_type"])
        if p.get("user"):
            qs = qs.filter(user_id=p["user"])
        if p.get("date_from"):
            qs = qs.filter(created_at__date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(created_at__date__lte=p["date_to"])
        q = (p.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(action__icontains=q) | Q(entite_type__icontains=q)
                | Q(entite_id__icontains=q) | Q(user__username__icontains=q)
                | Q(ip__icontains=q)
            )
        return qs

    @drf_action(detail=False, methods=["get"])
    def facets(self, request):
        """Valeurs distinctes pour peupler les filtres du dashboard."""
        actions = list(
            AuditLog.objects.order_by("action").values_list("action", flat=True).distinct()
        )
        types = list(
            AuditLog.objects.exclude(entite_type="")
            .order_by("entite_type").values_list("entite_type", flat=True).distinct()
        )
        return Response({"actions": actions, "entite_types": types, "total": AuditLog.objects.count()})
