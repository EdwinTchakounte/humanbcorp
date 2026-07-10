"""Serializers DRF du CMS.

Deux familles :
  - **publiques** (vitrine) : lecture, nested, ne renvoient que le contenu *visible*
    (`is_active=True`, `is_deleted=False`), ordonné.
  - **dashboard** (CRUD) : à plat, tous les champs, tous les objets non supprimés.
"""

from rest_framework import serializers

from .models import Article, Card, MediaAsset, Page, Section, SiteSettings


# ---------------------------------------------------------------------------
# Média
# ---------------------------------------------------------------------------
class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = ["id", "title", "url", "alt", "caption", "tags", "width", "height", "order", "is_active"]

    def get_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


# ---------------------------------------------------------------------------
# Lecture publique (vitrine) — nested, filtré visible, sensible à la langue
# ---------------------------------------------------------------------------
class LangMixin:
    """Remplace les champs traduisibles par leur variante `_en` si lang == 'en'
    et que la traduction existe (sinon on garde le français)."""

    translatable: list[str] = []

    def to_representation(self, instance):
        data = super().to_representation(instance)  # type: ignore[misc]
        lang = self.context.get("lang", "fr")  # type: ignore[attr-defined]
        if lang == "en":
            for field in self.translatable:
                en = getattr(instance, f"{field}_en", "")
                if en:
                    data[field] = en
        return data


class CardPublicSerializer(LangMixin, serializers.ModelSerializer):
    image = MediaAssetSerializer(read_only=True)
    translatable = ["title", "text", "link_label"]

    class Meta:
        model = Card
        fields = ["id", "order", "title", "text", "icon", "image", "link", "link_label", "extra"]


class SectionPublicSerializer(LangMixin, serializers.ModelSerializer):
    cards = serializers.SerializerMethodField()
    bg_image = MediaAssetSerializer(read_only=True)
    translatable = ["eyebrow", "title", "subtitle", "body"]

    class Meta:
        model = Section
        fields = [
            "id", "type", "anchor", "order", "eyebrow", "title", "subtitle", "body",
            "bg_color", "bg_image", "parallax", "wave", "options", "cards",
        ]

    def get_cards(self, obj):
        qs = obj.cards.filter(is_active=True, is_deleted=False).order_by("order", "id")
        return CardPublicSerializer(qs, many=True, context=self.context).data


class PagePublicSerializer(LangMixin, serializers.ModelSerializer):
    sections = serializers.SerializerMethodField()
    og_image = MediaAssetSerializer(read_only=True)
    translatable = ["title", "nav_label", "meta_title", "meta_description"]

    class Meta:
        model = Page
        fields = [
            "id", "slug", "title", "nav_label", "meta_title", "meta_description",
            "og_image", "sections",
        ]

    def get_sections(self, obj):
        qs = obj.sections.filter(is_active=True, is_deleted=False).order_by("order", "id")
        return SectionPublicSerializer(qs, many=True, context=self.context).data


class NavItemSerializer(LangMixin, serializers.ModelSerializer):
    translatable = ["title", "nav_label"]

    class Meta:
        model = Page
        fields = ["slug", "title", "nav_label", "order"]


class SiteSettingsSerializer(LangMixin, serializers.ModelSerializer):
    logo = MediaAssetSerializer(read_only=True)
    logo_white = MediaAssetSerializer(read_only=True)
    default_og_image = MediaAssetSerializer(read_only=True)
    phones_list = serializers.SerializerMethodField()
    translatable = ["slogan", "tagline"]

    class Meta:
        model = SiteSettings
        fields = [
            "brand_name", "slogan", "tagline", "address", "phones", "phones_list",
            "email", "city", "whatsapp", "facebook", "linkedin", "instagram", "twitter",
            "logo", "logo_white", "default_meta_title", "default_meta_description", "default_og_image",
        ]

    def get_phones_list(self, obj):
        return [p.strip() for p in (obj.phones or "").split(",") if p.strip()]


# ---------------------------------------------------------------------------
# Dashboard CRUD — à plat
# ---------------------------------------------------------------------------
class CardSerializer(serializers.ModelSerializer):
    image_detail = MediaAssetSerializer(source="image", read_only=True)

    class Meta:
        model = Card
        fields = [
            "id", "section", "order", "title", "title_en", "text", "text_en", "icon",
            "image", "image_detail", "link", "link_label", "link_label_en", "extra", "is_active",
        ]


class SectionSerializer(serializers.ModelSerializer):
    cards = CardSerializer(many=True, read_only=True)
    bg_image_detail = MediaAssetSerializer(source="bg_image", read_only=True)

    class Meta:
        model = Section
        fields = [
            "id", "page", "type", "anchor", "order",
            "eyebrow", "eyebrow_en", "title", "title_en", "subtitle", "subtitle_en", "body", "body_en",
            "bg_color", "bg_image", "bg_image_detail", "parallax", "wave", "options",
            "is_active", "cards",
        ]


class PageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = [
            "id", "slug", "title", "title_en", "nav_label", "nav_label_en", "show_in_nav", "order",
            "meta_title", "meta_title_en", "meta_description", "meta_description_en",
            "og_image", "is_active",
        ]


class SiteSettingsWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        exclude = ["is_deleted", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Articles (blog)
# ---------------------------------------------------------------------------
class ArticleListSerializer(LangMixin, serializers.ModelSerializer):
    cover = MediaAssetSerializer(read_only=True)
    translatable = ["title", "excerpt"]

    class Meta:
        model = Article
        fields = ["id", "slug", "title", "excerpt", "cover", "author", "category", "published_at"]


class ArticleDetailSerializer(LangMixin, serializers.ModelSerializer):
    cover = MediaAssetSerializer(read_only=True)
    translatable = ["title", "excerpt", "body"]

    class Meta:
        model = Article
        fields = ["id", "slug", "title", "excerpt", "body", "cover", "author", "category", "published_at"]


class ArticleSerializer(serializers.ModelSerializer):
    """CRUD dashboard — à plat, tous champs."""

    cover_detail = MediaAssetSerializer(source="cover", read_only=True)

    class Meta:
        model = Article
        fields = [
            "id", "slug", "title", "title_en", "excerpt", "excerpt_en", "body", "body_en",
            "cover", "cover_detail", "author", "category", "published_at", "order", "is_active",
        ]
        extra_kwargs = {"slug": {"required": False}}


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------
class ContactSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    firstname = serializers.CharField(max_length=160, required=False, allow_blank=True)
    company = serializers.CharField(max_length=200, required=False, allow_blank=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=60, required=False, allow_blank=True)
    service = serializers.CharField(max_length=160, required=False, allow_blank=True)
    message = serializers.CharField()
