"""
Modèles du CMS de la vitrine HBC-RH.

Architecture de contenu (éditable depuis le dashboard Next) :

    SiteSettings (singleton)  — coordonnées, réseaux, SEO global
    Page  ──< Section ──< Card
    MediaAsset  — bibliothèque d'images réutilisables

Tous les modèles de contenu héritent de `abstracts.Abstract` :
  - `is_active`  → sert de bascule **Visible / masqué**
  - `is_deleted` → soft-delete
  - `created_at` / `updated_at` → horodatage
On ajoute `order` (position) + `Meta.ordering` pour le réordonnancement.
"""

from django.db import models
from django.utils.text import slugify

from abstracts.models import Abstract


# ---------------------------------------------------------------------------
# Bibliothèque de médias
# ---------------------------------------------------------------------------
class MediaAsset(Abstract):
    """Image réutilisable dans n'importe quelle carte / section / page."""

    title = models.CharField(max_length=160, blank=True)
    image = models.ImageField(upload_to="sitecms/media/")
    alt = models.CharField(max_length=200, blank=True, help_text="Texte alternatif (SEO / accessibilité).")
    caption = models.CharField(max_length=255, blank=True)
    tags = models.CharField(max_length=255, blank=True, help_text="Mots-clés séparés par des virgules.")
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.title or self.alt or (self.image.name if self.image else f"MediaAsset #{self.pk}")

    def save(self, *args, **kwargs):
        # Renseigne width/height depuis le fichier si disponible.
        try:
            if self.image and (not self.width or not self.height):
                self.width, self.height = self.image.width, self.image.height
        except Exception:
            pass
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Réglages globaux du site (singleton)
# ---------------------------------------------------------------------------
class SiteSettings(Abstract):
    """Un unique enregistrement : coordonnées, réseaux sociaux, SEO par défaut."""

    brand_name = models.CharField(max_length=120, default="Human Brain Corporation-RH")
    slogan = models.CharField(max_length=200, default="Libérer le potentiel humain")
    slogan_en = models.CharField(max_length=200, blank=True)
    tagline = models.CharField(max_length=255, blank=True)
    tagline_en = models.CharField(max_length=255, blank=True)

    # Coordonnées
    address = models.CharField(max_length=255, blank=True)
    phones = models.CharField(max_length=255, blank=True, help_text="Numéros séparés par des virgules.")
    email = models.EmailField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    whatsapp = models.CharField(max_length=40, blank=True, help_text="Numéro international sans '+' pour wa.me.")

    # Réseaux sociaux
    facebook = models.URLField(blank=True)
    linkedin = models.URLField(blank=True)
    instagram = models.URLField(blank=True)
    twitter = models.URLField(blank=True)

    # Logos
    logo = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    logo_white = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    # SEO par défaut
    default_meta_title = models.CharField(max_length=200, blank=True)
    default_meta_description = models.TextField(blank=True)
    default_og_image = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        verbose_name = "Réglages du site"
        verbose_name_plural = "Réglages du site"

    def __str__(self):
        return self.brand_name

    def save(self, *args, **kwargs):
        # Force le singleton (pk=1).
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------
class Page(Abstract):
    """Une page du site (Accueil, À propos, Services, ...)."""

    slug = models.SlugField(max_length=120, unique=True, help_text="Identifiant d'URL. « accueil » = page d'accueil (/).")
    title = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200, blank=True)
    nav_label = models.CharField(max_length=120, blank=True, help_text="Libellé dans le menu (défaut : titre).")
    nav_label_en = models.CharField(max_length=120, blank=True)
    show_in_nav = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    # SEO propre à la page
    meta_title = models.CharField(max_length=200, blank=True)
    meta_title_en = models.CharField(max_length=200, blank=True)
    meta_description = models.TextField(blank=True)
    meta_description_en = models.TextField(blank=True)
    og_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        if not self.nav_label:
            self.nav_label = self.title
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Section
# ---------------------------------------------------------------------------
class Section(Abstract):
    """Bloc d'une page, rendu par un composant React selon `type`."""

    class Type(models.TextChoices):
        HERO = "hero", "Hero"
        STATS = "stats", "Statistiques"
        ABOUT = "about", "À propos"
        SERVICES = "services", "Services / cartes"
        GALLERY = "gallery", "Galerie"
        MILESTONE = "milestone", "Chiffres-clés (bandeau)"
        FEATURES = "features", "Pourquoi nous / atouts"
        CONTACT = "contact", "Contact"
        CTA = "cta", "Appel à l'action"
        RICHTEXT = "richtext", "Texte riche"

    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name="sections")
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.RICHTEXT)
    anchor = models.SlugField(max_length=60, blank=True, help_text="Ancre HTML (#services…).")
    order = models.PositiveIntegerField(default=0)

    # Contenu
    eyebrow = models.CharField(max_length=160, blank=True, help_text="Sur-titre.")
    eyebrow_en = models.CharField(max_length=160, blank=True)
    title = models.CharField(max_length=255, blank=True)
    title_en = models.CharField(max_length=255, blank=True)
    subtitle = models.CharField(max_length=500, blank=True)
    subtitle_en = models.CharField(max_length=500, blank=True)
    body = models.TextField(blank=True)
    body_en = models.TextField(blank=True)

    # Apparence / fond
    bg_color = models.CharField(max_length=30, blank=True, help_text="Couleur de fond (hex ou token).")
    bg_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    parallax = models.BooleanField(default=False)
    wave = models.BooleanField(default=False, help_text="Séparateur en vague en bas de section.")

    # Options libres spécifiques au type (colonnes, variantes de layout…)
    options = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.page.slug} · {self.get_type_display()} ({self.title or self.eyebrow or self.pk})"


# ---------------------------------------------------------------------------
# Card (élément répétable d'une section)
# ---------------------------------------------------------------------------
class Card(Abstract):
    """Élément d'une section : carte service, stat, photo de galerie, atout…"""

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="cards")
    order = models.PositiveIntegerField(default=0)

    title = models.CharField(max_length=255, blank=True)
    title_en = models.CharField(max_length=255, blank=True)
    text = models.TextField(blank=True)
    text_en = models.TextField(blank=True)
    icon = models.CharField(max_length=80, blank=True, help_text="Nom d'icône Boxicon (ex: bx-target-lock).")
    image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="cards")
    link = models.CharField(max_length=300, blank=True)
    link_label = models.CharField(max_length=120, blank=True)
    link_label_en = models.CharField(max_length=120, blank=True)

    # Champs libres selon le type de section (valeur d'une stat, span galerie, badge…)
    extra = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title or self.text[:40] or f"Card #{self.pk}"


# ---------------------------------------------------------------------------
# Document téléchargeable (public)
# ---------------------------------------------------------------------------
class Document(Abstract):
    """Fichier téléchargeable depuis la vitrine (brochure, catalogue, fiche…).

    `is_active` (hérité d'Abstract) sert de bascule **Publié / masqué**.
    """

    title = models.CharField(max_length=200)
    description = models.CharField(max_length=300, blank=True)
    category = models.CharField(max_length=120, blank=True, help_text="Regroupement (ex: Brochures, Catalogues).")
    file = models.FileField(upload_to="documents/%Y/%m/")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.title


# ---------------------------------------------------------------------------
# Article de blog
# ---------------------------------------------------------------------------
class Article(Abstract):
    """Article du blog / actualités (géré depuis le dashboard)."""

    slug = models.SlugField(max_length=160, unique=True)
    title = models.CharField(max_length=220)
    title_en = models.CharField(max_length=220, blank=True)
    excerpt = models.TextField(blank=True, help_text="Résumé affiché dans la liste.")
    excerpt_en = models.TextField(blank=True)
    body = models.TextField(blank=True, help_text="Corps de l'article (paragraphes séparés par une ligne vide).")
    body_en = models.TextField(blank=True)
    cover = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    author = models.CharField(max_length=120, blank=True, default="Équipe HBC-RH")
    category = models.CharField(max_length=120, blank=True)
    published_at = models.DateField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-published_at", "order", "-created_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:160]
        super().save(*args, **kwargs)
