"""Backfill du montant figé des souscriptions existantes.

Pour l'historique, on fige `Inscription.montant` depuis le prix courant de la
publication — meilleure approximation disponible. Les nouvelles souscriptions
le figent automatiquement via `Inscription.save()`.
"""
from django.db import migrations


def backfill(apps, schema_editor):
    Inscription = apps.get_model("bucket", "Inscription")
    a_sauver = []
    for insc in (
        Inscription.objects.filter(montant__isnull=True)
        .select_related("publication")
    ):
        insc.montant = getattr(insc.publication, "price", None) or 0
        a_sauver.append(insc)
    if a_sauver:
        Inscription.objects.bulk_update(a_sauver, ["montant"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("bucket", "0021_inscription_montant")]
    operations = [migrations.RunPython(backfill, noop)]
