"""Enregistre (idempotent) les tâches planifiées django-q2 de suivi des paiements.

À lancer une fois après déploiement :  ``python manage.py setup_payment_crons``

Deux planifications :
  - réconciliation des paiements EN_ATTENTE toutes les 10 minutes
    (``reconcile_pending_payments_scheduled``) — repêche via ``check_status`` Tara ;
  - alerte des paiements bloqués, toutes les heures (``alert_stuck_payments``).

Les tâches ne s'exécutent réellement que si un cluster tourne : ``python manage.py qcluster``.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand


SCHEDULES = [
    {
        "name": "payments.reconcile_pending",
        "func": "apps_coop.payments.tasks.reconcile_pending_payments_scheduled",
        "minutes": 10,
        "hourly": False,
    },
    {
        "name": "payments.alert_stuck",
        "func": "apps_coop.payments.tasks.alert_stuck_payments",
        "minutes": None,
        "hourly": True,
    },
]


class Command(BaseCommand):
    help = "Enregistre les schedules django-q2 de réconciliation/alerte des paiements (idempotent)."

    def handle(self, *args, **options):
        from django_q.models import Schedule

        created = existed = 0
        for spec in SCHEDULES:
            defaults = {
                "func": spec["func"],
                "repeats": -1,  # infini
            }
            if spec["hourly"]:
                defaults["schedule_type"] = Schedule.HOURLY
            else:
                defaults["schedule_type"] = Schedule.MINUTES
                defaults["minutes"] = spec["minutes"]

            obj, was_created = Schedule.objects.get_or_create(
                name=spec["name"],
                defaults=defaults,
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  + {spec['name']} → {spec['func']}"))
            else:
                existed += 1
                self.stdout.write(f"  · {spec['name']} (déjà planifié)")

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{created} planification(s) créée(s), {existed} inchangée(s). "
                "Lancez `python manage.py qcluster` pour les exécuter."
            )
        )
