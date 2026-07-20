from django.contrib import admin
from django.utils.html import format_html

from .models import Application, ApplicationNote, JobOffer


class ApplicationNoteInline(admin.TabularInline):
    model = ApplicationNote
    extra = 0
    readonly_fields = ("author", "created_at")


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ("title", "contract_type", "department", "location", "is_published", "closing_date", "created_at")
    list_filter = ("is_published", "contract_type", "department")
    search_fields = ("title", "description", "profile")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("full_name", "offer", "email", "phone", "status", "rating", "assigned_to", "cv_link", "created_at")
    list_filter = ("status", "offer", "assigned_to")
    search_fields = ("first_name", "last_name", "email", "phone")
    list_editable = ("status", "rating", "assigned_to")
    autocomplete_fields = ("assigned_to",)
    readonly_fields = ("created_at", "updated_at", "cv_link")
    date_hierarchy = "created_at"
    inlines = [ApplicationNoteInline]

    def save_formset(self, request, form, formset, change):
        # L'auteur d'une note ajoutée depuis l'admin = l'utilisateur courant.
        instances = formset.save(commit=False)
        for obj in instances:
            if isinstance(obj, ApplicationNote) and obj.author_id is None:
                obj.author = request.user
            obj.save()
        formset.save_m2m()
        for obj in formset.deleted_objects:
            obj.delete()

    @admin.display(description="CV")
    def cv_link(self, obj):
        if not obj.cv:
            return "—"
        return format_html('<a href="{}" target="_blank" rel="noopener">Télécharger</a>', obj.cv.url)
