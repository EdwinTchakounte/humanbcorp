from django.contrib import admin
from django.utils.html import format_html

from .models import Application, JobOffer


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ("title", "contract_type", "department", "location", "is_published", "closing_date", "created_at")
    list_filter = ("is_published", "contract_type", "department")
    search_fields = ("title", "description", "profile")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("full_name", "offer", "email", "phone", "status", "cv_link", "created_at")
    list_filter = ("status", "offer")
    search_fields = ("first_name", "last_name", "email", "phone")
    list_editable = ("status",)
    readonly_fields = ("created_at", "cv_link")
    date_hierarchy = "created_at"

    @admin.display(description="CV")
    def cv_link(self, obj):
        if not obj.cv:
            return "—"
        return format_html('<a href="{}" target="_blank" rel="noopener">Télécharger</a>', obj.cv.url)
