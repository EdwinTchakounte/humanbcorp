from django.contrib import admin

from .models import Espace, Membership


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ("user",)
    fields = ("user", "role", "is_active", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Espace)
class EspaceAdmin(admin.ModelAdmin):
    list_display = ("nom", "slug", "responsable", "date_debut", "date_fin", "is_active", "est_actif")
    list_filter = ("is_active",)
    search_fields = ("nom", "slug", "responsable__username", "responsable__email")
    prepopulated_fields = {"slug": ("nom",)}
    autocomplete_fields = ("responsable",)
    date_hierarchy = "created_at"
    inlines = (MembershipInline,)

    @admin.display(boolean=True, description="Accès ouvert")
    def est_actif(self, obj):
        return obj.est_actif()


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "espace", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "espace")
    search_fields = ("user__username", "user__email", "espace__nom")
    autocomplete_fields = ("user", "espace")
    date_hierarchy = "created_at"
