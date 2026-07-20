"""Socle multi-tenant — Étape 1 du chantier SaaS.

Un **Espace** est l'unité d'isolement : une « école » / organisation que le
super-admin crée pour un responsable, pour une **durée bornée**. Chaque espace
possède ses propres formations, apprenants, inscriptions et suivi RH (le
cloisonnement effectif des données est branché aux étapes suivantes).

Le rattachement d'un utilisateur à un espace passe par **Membership**, qui porte
le rôle de l'utilisateur *dans cet espace* (responsable, formateur, apprenant,
RH). Un même utilisateur peut être membre de plusieurs espaces avec des rôles
distincts (ex. apprenant dans deux écoles).

Cette étape n'ajoute encore aucune FK `espace` sur les modèles de contenu : elle
pose seulement l'entité tenant, l'appartenance et le gate de durée. Le contenu
global existant sera rattaché à un espace « maison mère » par défaut à l'étape 2.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Espace(models.Model):
    """Un tenant : une école / organisation isolée, à durée définie."""

    nom = models.CharField(max_length=180, verbose_name="Nom de l'espace")
    # Réservé au futur adressage par sous-domaine (ecole.hbc-rh.…).
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="espaces_diriges",
        verbose_name="Responsable de l'espace",
    )
    # Durée de vie de l'espace. date_debut nulle = actif immédiatement ;
    # date_fin nulle = durée illimitée.
    date_debut = models.DateField(null=True, blank=True, verbose_name="Début d'accès")
    date_fin = models.DateField(null=True, blank=True, verbose_name="Fin d'accès")
    is_active = models.BooleanField(default=True, verbose_name="Actif")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Espace"
        verbose_name_plural = "Espaces"
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.nom) or "espace"
            slug, i = base, 2
            while Espace.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def est_actif(self, at=None):
        """Vrai si l'espace est actif ET dans sa fenêtre de validité.

        C'est le *gate de durée* : quand la période est écoulée (ou l'espace
        désactivé par le super-admin), l'accès doit être refusé.
        """
        if not self.is_active:
            return False
        today = at or timezone.localdate()
        if self.date_debut and today < self.date_debut:
            return False
        if self.date_fin and today > self.date_fin:
            return False
        return True

    @property
    def est_expire(self):
        return bool(self.date_fin and timezone.localdate() > self.date_fin)


class Membership(models.Model):
    """Rattachement d'un utilisateur à un espace, avec son rôle dans cet espace."""

    class Role(models.TextChoices):
        RESPONSABLE = "responsable", "Responsable"
        FORMATEUR = "formateur", "Formateur"
        APPRENANT = "apprenant", "Apprenant"
        RH = "rh", "RH / Recrutement"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    espace = models.ForeignKey(
        Espace,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.APPRENANT)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Rattachement"
        verbose_name_plural = "Rattachements"
        # Un utilisateur ne porte qu'une fois un rôle donné dans un espace.
        constraints = [
            models.UniqueConstraint(
                fields=["user", "espace", "role"], name="uniq_membership_user_espace_role"
            )
        ]
        indexes = [
            models.Index(fields=["espace", "role"]),
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user} — {self.get_role_display()} @ {self.espace}"
