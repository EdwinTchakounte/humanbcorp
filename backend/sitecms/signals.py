"""Bump de `Theme.content_updated_at` dès qu'un élément de contenu change.

`Theme.updated_at` (auto_now) ne bouge qu'à la sauvegarde du Theme lui-même.
Or l'apprenant doit voir un badge « mis à jour » quand une **séance, activité,
question, composant ou document** est ajouté/modifié/supprimé. Ces signaux
résolvent le Theme parent et horodatent son contenu, quelle que soit la voie de
modification (API d'authoring, admin Django, shell).

On utilise `Theme.objects.filter(...).update(...)` : écriture ciblée, pas de
récursion de signaux et sans toucher `Theme.updated_at`.
"""
from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone


def _touch(theme_id):
    if not theme_id:
        return
    from lessonapp.models import Theme
    Theme.objects.filter(pk=theme_id).update(content_updated_at=timezone.now())


def _theme_of_seance(seance_id):
    if not seance_id:
        return None
    from lessonapp.models import Seance
    return (
        Seance.objects.filter(pk=seance_id).values_list("theme_id", flat=True).first()
    )


def _theme_of_activity(activity_id):
    if not activity_id:
        return None
    from lessonapp.models import Activity
    seance_id = (
        Activity.objects.filter(pk=activity_id).values_list("seance_id", flat=True).first()
    )
    return _theme_of_seance(seance_id)


def register():
    """Connecte les récepteurs. Appelé depuis `SitecmsConfig.ready()`."""
    from lessonapp.models import Activity, Activityquestion, Question, Seance
    from material.models import ActivityComponent, MaterialActivityDoc

    @receiver(post_save, sender=Seance, weak=False)
    @receiver(post_delete, sender=Seance, weak=False)
    def _seance_changed(sender, instance, **kwargs):
        _touch(getattr(instance, "theme_id", None))

    @receiver(post_save, sender=Activity, weak=False)
    @receiver(post_delete, sender=Activity, weak=False)
    def _activity_changed(sender, instance, **kwargs):
        _touch(_theme_of_seance(getattr(instance, "seance_id", None)))

    @receiver(post_save, sender=Activityquestion, weak=False)
    @receiver(post_delete, sender=Activityquestion, weak=False)
    def _aq_changed(sender, instance, **kwargs):
        _touch(_theme_of_activity(getattr(instance, "activity_id", None)))

    # Édition d'une question (titre, type, options) : le Theme est retrouvé via
    # l'Activityquestion qui la relie à l'activité.
    @receiver(post_save, sender=Question, weak=False)
    def _question_changed(sender, instance, **kwargs):
        activity_id = (
            Activityquestion.objects.filter(question=instance)
            .values_list("activity_id", flat=True)
            .first()
        )
        _touch(_theme_of_activity(activity_id))

    @receiver(post_save, sender=ActivityComponent, weak=False)
    @receiver(post_delete, sender=ActivityComponent, weak=False)
    def _component_changed(sender, instance, **kwargs):
        _touch(_theme_of_activity(getattr(instance, "activity_id", None)))

    @receiver(post_save, sender=MaterialActivityDoc, weak=False)
    @receiver(post_delete, sender=MaterialActivityDoc, weak=False)
    def _doc_changed(sender, instance, **kwargs):
        _touch(_theme_of_activity(getattr(instance, "activity_id", None)))
