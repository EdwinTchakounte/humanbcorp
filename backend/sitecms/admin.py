"""Admin Django — filet de secours superuser (le CMS principal est le dashboard Next)."""

from django.contrib import admin

from .models import Article, Card, Document, MediaAsset, Page, Section, SiteSettings


class CardInline(admin.TabularInline):
    model = Card
    extra = 0
    fields = ["order", "is_active", "title", "icon", "image", "link"]
    ordering = ["order"]


class SectionInline(admin.TabularInline):
    model = Section
    extra = 0
    fields = ["order", "is_active", "type", "title", "anchor"]
    ordering = ["order"]
    show_change_link = True


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ["title", "slug", "order", "show_in_nav", "is_active"]
    list_editable = ["order", "show_in_nav", "is_active"]
    prepopulated_fields = {"slug": ("title",)}
    inlines = [SectionInline]


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["__str__", "page", "type", "order", "is_active"]
    list_filter = ["type", "page", "is_active"]
    list_editable = ["order", "is_active"]
    inlines = [CardInline]


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ["__str__", "tags", "width", "height", "order", "is_active"]
    search_fields = ["title", "alt", "tags"]


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "author", "published_at", "is_active"]
    list_filter = ["category", "is_active"]
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ["title", "excerpt", "body"]


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ["brand_name", "email", "city"]

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "order", "is_active", "created_at"]
    list_editable = ["order", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["title", "description", "category"]
