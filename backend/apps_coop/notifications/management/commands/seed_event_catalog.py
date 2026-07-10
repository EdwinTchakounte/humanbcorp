"""Seed du catalogue d'événements métier HBC-RH (EXT-5).

Crée un ``EventConfig`` par événement émis par l'application, et pour chacun un
``EventHook`` EMAIL ciblant le template du même code. Idempotent : ne touche
jamais une ligne déjà éditée par l'admin (statut, active, sensitive).

Rappel : même sans ce seed, ``emit_event`` retombe sur ``send_template`` direct.
Ce catalogue sert surtout à donner à l'admin le kill-switch et la config par
événement depuis le dashboard.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from apps_coop.notifications.models import EventConfig, EventHook


# (code, label, description, sensitive)
EVENTS: list[tuple[str, str, str, bool]] = [
    (
        "compte.bienvenue",
        "Bienvenue (compte créé)",
        "Email envoyé juste après la création du compte utilisateur.",
        False,
    ),
    (
        "reservation.creee",
        "Réservation enregistrée",
        "Accusé de réception d'une réservation de séance / formation.",
        False,
    ),
    (
        "inscription.confirmee",
        "Inscription confirmée",
        "L'inscription à une formation/publication est confirmée.",
        False,
    ),
    (
        "paiement.recu",
        "Paiement reçu",
        "Reçu de paiement (encaissement manuel ou mobile money Tara) rattaché à une commande.",
        True,
    ),
    (
        "contact.recu",
        "Demande de contact reçue",
        "Notification interne à l'équipe HBC-RH lors d'une nouvelle demande de contact.",
        False,
    ),
    (
        "candidature.recue",
        "Candidature reçue (accusé candidat)",
        "Accusé de réception envoyé au candidat après le dépôt de sa candidature.",
        False,
    ),
    (
        "candidature.equipe",
        "Candidature reçue (notification équipe)",
        "Notification interne à l'équipe recrutement HBC-RH lors d'une nouvelle candidature.",
        False,
    ),
]


class Command(BaseCommand):
    help = (
        "Seed le catalogue EventConfig + EventHook (1 hook EMAIL par "
        "événement, ciblant le template du même code). Idempotent."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        created_cfg = 0
        created_hook = 0
        for code, label, description, sensitive in EVENTS:
            cfg, was_created = EventConfig.objects.get_or_create(
                code=code,
                defaults={
                    "label": label,
                    "description": description,
                    "status": EventConfig.Status.OPTIONAL,
                    "active": True,
                    "sensitive": sensitive,
                },
            )
            if was_created:
                created_cfg += 1
                flag = " [SENSITIVE]" if sensitive else ""
                self.stdout.write(self.style.SUCCESS(f"  ✓ Event   {code:<24} {label}{flag}"))
            else:
                self.stdout.write(f"  · Event   {code} (déjà en base — non modifié)")

            hook, hook_was_created = EventHook.objects.get_or_create(
                event=cfg,
                action_type=EventHook.ActionType.EMAIL,
                defaults={
                    "target_template_code": "",  # vide → fallback sur event.code
                    "active": True,
                    "ordering": 100,
                },
            )
            if hook_was_created:
                created_hook += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{created_cfg} événement(s) créé(s), {created_hook} hook(s) EMAIL créé(s)."
            )
        )
