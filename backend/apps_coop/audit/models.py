"""Modèles du journal d'audit.

`AuditLog` est un journal **append-only** : chaque ligne enregistre une action
sensible (qui / quoi / quand + un `details` JSON pour l'avant→après). On
n'altère ni ne supprime jamais une ligne existante — c'est ce qui fait la valeur
probante d'un journal d'audit. L'écriture passe toujours par `services.record()`,
qui est défensif (ne lève jamais) : tracer ne doit pas casser un flux métier.

`AppSetting` matérialise les réglages ajustables (seuils d'alerte, destinataires…)
que `services.get_int_setting/get_str_setting` renvoyaient jusqu'ici en dur.
"""
from __future__ import annotations

from django.db import models


class AuditLog(models.Model):
    """Une action sensible, journalisée de façon immuable."""

    # Verbe d'action normalisé, ex. "payment.confirmed",
    # "application.status_changed", "role.granted". Point-séparé domaine.action.
    action = models.CharField("Action", max_length=120, db_index=True)
    # Entité concernée : type (nom de modèle) + identifiant libre (str pour
    # rester agnostique du type de clé).
    entite_type = models.CharField("Type d'entité", max_length=80, blank=True, default="")
    entite_id = models.CharField("Identifiant", max_length=64, blank=True, default="")
    # Acteur : l'utilisateur à l'origine (nullable : webhook, tâche cron, public).
    user = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_entries", verbose_name="Acteur",
    )
    # Contexte structuré (avant→après, montants, raison de rejet…).
    details = models.JSONField("Détails", default=dict, blank=True)
    ip = models.CharField("IP", max_length=64, blank=True, default="")
    user_agent = models.TextField("User-Agent", blank=True, default="")
    created_at = models.DateTimeField("Horodatage", auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Entrée d'audit"
        verbose_name_plural = "Journal d'audit"
        indexes = [
            models.Index(fields=["entite_type", "entite_id"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.action} · {self.entite_type}#{self.entite_id or '—'}"

    def save(self, *args, **kwargs):
        # Journal append-only : une ligne existante ne se modifie jamais.
        if self.pk is not None:
            raise ValueError("AuditLog est immuable (append-only) — modification interdite.")
        super().save(*args, **kwargs)


class AppSetting(models.Model):
    """Réglage ajustable clé/valeur (seuils, destinataires d'alerte…).

    Valeur stockée en texte ; les accesseurs typés (`get_int_setting`) parsent
    à la lecture et retombent sur un défaut en cas d'absence ou d'erreur.
    """

    key = models.CharField("Clé", max_length=120, unique=True)
    value = models.TextField("Valeur", blank=True, default="")
    description = models.CharField("Description", max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]
        verbose_name = "Réglage"
        verbose_name_plural = "Réglages"

    def __str__(self):
        return self.key
