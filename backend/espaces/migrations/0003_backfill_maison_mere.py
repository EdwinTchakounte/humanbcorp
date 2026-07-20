"""Backfill de la bascule multi-tenant (étape 2).

1. Rattache tout le contenu global historique (Theme, Publication, Session,
   Sequence, Categorie, Classe sans espace) à l'espace « Maison mère HBC ».
2. Crée un rattachement (Membership) « formateur » vers la maison mère pour
   chaque utilisateur du groupe Teacher ou déjà instructeur d'un contenu, afin
   que le scoping par espace ne les prive pas de leurs formations.

Idempotent : ne touche que les lignes à `espace` nul et utilise get_or_create
pour les rattachements. Reversible (retire seulement ce qu'il a posé sur la
maison mère).
"""

from django.db import migrations

DEFAULT_SLUG = "hbc"


def backfill(apps, schema_editor):
    Espace = apps.get_model("espaces", "Espace")
    Membership = apps.get_model("espaces", "Membership")
    maison = Espace.objects.filter(slug=DEFAULT_SLUG).first()
    if maison is None:
        return

    # 1) Rattacher le contenu orphelin à la maison mère.
    for app_label, model_name in [
        ("lessonapp", "Theme"),
        ("lessonapp", "Session"),
        ("lessonapp", "Sequence"),
        ("lessonapp", "Categorie"),
        ("lessonapp", "Classe"),
        ("contents", "Publication"),
    ]:
        Model = apps.get_model(app_label, model_name)
        Model.objects.filter(espace__isnull=True).update(espace=maison)

    # 2) Rattacher les formateurs (groupe Teacher + instructeurs) à la maison mère.
    User = apps.get_model("auth", "User")
    Theme = apps.get_model("lessonapp", "Theme")
    Publication = apps.get_model("contents", "Publication")

    ids = set(
        User.objects.filter(groups__name__iexact="Teacher").values_list("id", flat=True)
    )
    ids |= set(Theme.objects.values_list("instructors__id", flat=True))
    ids |= set(Publication.objects.values_list("instructors__id", flat=True))
    ids.discard(None)

    for uid in ids:
        Membership.objects.get_or_create(
            user_id=uid,
            espace=maison,
            role="formateur",
            defaults={"is_active": True},
        )


def unbackfill(apps, schema_editor):
    Espace = apps.get_model("espaces", "Espace")
    Membership = apps.get_model("espaces", "Membership")
    maison = Espace.objects.filter(slug=DEFAULT_SLUG).first()
    if maison is None:
        return
    for app_label, model_name in [
        ("lessonapp", "Theme"),
        ("lessonapp", "Session"),
        ("lessonapp", "Sequence"),
        ("lessonapp", "Categorie"),
        ("lessonapp", "Classe"),
        ("contents", "Publication"),
    ]:
        Model = apps.get_model(app_label, model_name)
        Model.objects.filter(espace=maison).update(espace=None)
    Membership.objects.filter(espace=maison, role="formateur").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("espaces", "0002_espace_maison_mere"),
        ("lessonapp", "0047_categorie_espace_classe_espace_sequence_espace_and_more"),
        ("contents", "0016_publication_espace"),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
