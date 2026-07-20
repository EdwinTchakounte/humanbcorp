"""Admin Django du journal d'audit — lecture seule (append-only)."""
from __future__ import annotations

from django.contrib import admin

from .models import AppSetting, AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "entite_type", "entite_id", "user", "ip")
    list_filter = ("action", "entite_type", "created_at")
    search_fields = ("action", "entite_type", "entite_id", "user__username", "ip")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    # Journal immuable : aucune création/modification/suppression via l'admin.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AppSetting)
class AppSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "description", "updated_at")
    search_fields = ("key", "description")
