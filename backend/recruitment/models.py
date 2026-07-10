"""Domaine recrutement : offres d'emploi (`JobOffer`) et candidatures publiques
(`Application`).

Le modèle est **autonome** (aucune dépendance au reste du projet) et les
candidatures sont ouvertes aux visiteurs non authentifiés : une `Application`
n'est donc PAS rattachée à un `User`, seulement à des coordonnées libres + un CV.
"""
from __future__ import annotations

from django.db import models
from django.utils.text import slugify


class JobOffer(models.Model):
    """Offre d'emploi publiée sur la vitrine."""

    class Contract(models.TextChoices):
        CDI = "CDI", "CDI"
        CDD = "CDD", "CDD"
        STAGE = "STAGE", "Stage"
        ALTERNANCE = "ALTERNANCE", "Alternance"
        FREELANCE = "FREELANCE", "Freelance / Mission"

    title = models.CharField("Intitulé du poste", max_length=200)
    slug = models.SlugField("Slug", max_length=220, unique=True, blank=True)
    department = models.CharField("Département / Pôle", max_length=120, blank=True)
    location = models.CharField("Lieu", max_length=120, blank=True, default="Douala — Cameroun")
    contract_type = models.CharField(
        "Type de contrat", max_length=20, choices=Contract.choices, default=Contract.CDI
    )
    description = models.TextField("Description du poste")
    profile = models.TextField("Profil recherché", blank=True)
    is_published = models.BooleanField("Publiée", default=True)
    closing_date = models.DateField("Date de clôture", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Offre d'emploi"
        verbose_name_plural = "Offres d'emploi"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or "offre"
            slug = base
            i = 2
            while JobOffer.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)


def cv_upload_to(instance, filename):
    # cv/2026/07/<slug-ou-spontanee>-<nom>.<ext>
    from django.utils import timezone  # import local (Date.now indispo côté script)

    now = timezone.now()
    return f"cv/{now:%Y/%m}/{filename}"


class Application(models.Model):
    """Candidature déposée par un visiteur (sur une offre ou spontanée)."""

    class Status(models.IntegerChoices):
        NEW = 0, "Nouvelle"
        REVIEWED = 1, "Vue"
        SHORTLISTED = 2, "Présélectionnée"
        REJECTED = 3, "Rejetée"

    offer = models.ForeignKey(
        JobOffer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
        help_text="Vide = candidature spontanée.",
    )
    first_name = models.CharField("Prénom", max_length=100)
    last_name = models.CharField("Nom", max_length=100, blank=True)
    email = models.EmailField("Email")
    phone = models.CharField("Téléphone", max_length=30, blank=True)
    cover_letter = models.TextField("Lettre de motivation", blank=True)
    cv = models.FileField("CV", upload_to=cv_upload_to)
    status = models.IntegerField("Statut", choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Candidature"
        verbose_name_plural = "Candidatures"

    def __str__(self):
        cible = self.offer.title if self.offer else "Candidature spontanée"
        return f"{self.full_name} — {cible}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()
