"""Crée l'espace « maison mère » par défaut (tenant de repli).

Cet espace sert de rattachement au contenu global historique à l'étape 2.
Il est illimité dans le temps et sans responsable défini (à assigner par le
super-admin depuis le Django admin).
"""

from django.db import migrations

DEFAULT_SLUG = "hbc"
DEFAULT_NOM = "Maison mère HBC"


def creer_espace_defaut(apps, schema_editor):
    Espace = apps.get_model("espaces", "Espace")
    Espace.objects.get_or_create(
        slug=DEFAULT_SLUG,
        defaults={"nom": DEFAULT_NOM, "is_active": True},
    )


def supprimer_espace_defaut(apps, schema_editor):
    Espace = apps.get_model("espaces", "Espace")
    Espace.objects.filter(slug=DEFAULT_SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("espaces", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(creer_espace_defaut, supprimer_espace_defaut),
    ]
