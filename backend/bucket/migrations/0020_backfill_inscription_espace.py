"""Backfill de l'attribution tenant des souscriptions (étape 3).

Rattache chaque `Inscription` existante à l'espace de sa publication, afin que
le suivi des souscriptions et le calcul du chiffre d'affaires par espace portent
aussi sur l'historique. Idempotent (ne touche que les lignes à `espace` nul) et
réversible.

Dépend de `contents.0016_publication_espace` (la publication doit déjà porter
son espace) et du backfill maison mère (`espaces.0003`), qui a estampillé les
publications historiques.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Inscription = apps.get_model("bucket", "Inscription")
    # Réplique publication.espace sur les inscriptions non encore attribuées.
    for insc in (
        Inscription.objects.filter(espace__isnull=True)
        .exclude(publication__espace__isnull=True)
        .select_related("publication")
        .iterator()
    ):
        insc.espace_id = insc.publication.espace_id
        insc.save(update_fields=["espace"])


def unbackfill(apps, schema_editor):
    Inscription = apps.get_model("bucket", "Inscription")
    Inscription.objects.update(espace=None)


class Migration(migrations.Migration):

    dependencies = [
        ("bucket", "0019_inscription_espace"),
        ("contents", "0016_publication_espace"),
        ("espaces", "0003_backfill_maison_mere"),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
