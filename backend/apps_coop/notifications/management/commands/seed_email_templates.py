"""Seed idempotent des EmailTemplate transactionnels HBC-RH.

``python manage.py seed_email_templates`` (idempotent via get_or_create).
Ajouter ``--force`` pour réécrire les templates existants après un changement
de contenu.

Le wrapper visuel (header + footer charte HBC) est appliqué à l'envoi par
``services._wrap_layout`` — ici on ne définit que le ``corps_html`` central,
composé avec les blocs de ``email_blocks``. Les placeholders ``{clé}`` sont
injectés par ``str.format(**context)`` au moment de l'envoi.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps_coop.notifications.email_blocks import (
    amount,
    callout,
    closing,
    cta,
    hi,
    info_card,
    lead,
    p,
    title,
)
from apps_coop.notifications.models import EmailTemplate


def _join(*parts: str) -> str:
    return "".join(parts)


TEMPLATES = [
    # ────────────────────────────────────────────────────────────────────
    # Compte
    # ────────────────────────────────────────────────────────────────────
    {
        "code": "compte.bienvenue",
        "objet": "Bienvenue chez HBC-RH, {nom} !",
        "corps_html": _join(
            hi("{nom}"),
            title("Votre compte HBC-RH est créé"),
            lead(
                "Bienvenue ! Votre espace vous permet de suivre vos inscriptions, "
                "vos formations et vos paiements en toute simplicité."
            ),
            cta("Accéder à mon espace", "{portal_url}"),
            closing(),
        ),
        "variables": ["nom", "portal_url"],
    },
    # ────────────────────────────────────────────────────────────────────
    # Inscriptions & réservations
    # ────────────────────────────────────────────────────────────────────
    {
        "code": "reservation.creee",
        "objet": "Votre réservation est enregistrée",
        "corps_html": _join(
            hi("{nom}"),
            title("Réservation enregistrée"),
            lead("Nous avons bien reçu votre réservation. Voici le récapitulatif :"),
            info_card(
                [
                    ("Formation", "<strong>{formation}</strong>"),
                    ("Séance", "{date}"),
                ],
                tone="info",
            ),
            p("Notre équipe vous recontacte pour confirmer les détails."),
            closing(),
        ),
        "variables": ["nom", "formation", "date", "portal_url"],
    },
    {
        "code": "inscription.confirmee",
        "objet": "Votre inscription est confirmée",
        "corps_html": _join(
            hi("{nom}"),
            title("Inscription confirmée"),
            lead(
                "Votre inscription à <strong>{formation}</strong> est confirmée. "
                "Nous avons hâte de vous accueillir."
            ),
            cta("Voir mes inscriptions", "{portal_url}"),
            closing(),
        ),
        "variables": ["nom", "formation", "portal_url"],
    },
    # ────────────────────────────────────────────────────────────────────
    # Paiement
    # ────────────────────────────────────────────────────────────────────
    {
        "code": "paiement.recu",
        "objet": "Paiement reçu — commande #{commande_id}",
        "corps_html": _join(
            hi("{nom}"),
            title("Nous avons bien reçu votre paiement"),
            amount("{montant}", label="Montant reçu (FCFA)"),
            info_card(
                [
                    ("Commande", "<strong>#{commande_id}</strong>"),
                    ("Statut", "{statut}"),
                    ("Reste à payer", "{reste} FCFA"),
                ],
                tone="success",
            ),
            p("Un reçu détaillé est disponible dans votre espace."),
            cta("Voir ma commande", "{portal_url}"),
            closing(),
        ),
        "variables": ["nom", "montant", "commande_id", "statut", "reste", "portal_url"],
    },
    # ────────────────────────────────────────────────────────────────────
    # Contact (notification interne à l'équipe HBC-RH)
    # ────────────────────────────────────────────────────────────────────
    {
        "code": "contact.recu",
        "objet": "Nouvelle demande de contact — {nom}",
        "corps_html": _join(
            title("Nouvelle demande de contact"),
            info_card(
                [
                    ("Nom", "<strong>{nom}</strong>"),
                    ("Email", "{email}"),
                ],
                tone="info",
            ),
            callout("{message}", tone="info"),
            closing(),
        ),
        "variables": ["nom", "email", "message"],
    },
    # ────────────────────────────────────────────────────────────────────
    # Recrutement
    # ────────────────────────────────────────────────────────────────────
    {
        "code": "candidature.recue",
        "objet": "Votre candidature a bien été reçue",
        "corps_html": _join(
            hi("{nom}"),
            title("Candidature reçue"),
            lead(
                "Merci pour votre intérêt. Nous avons bien reçu votre candidature "
                "pour <strong>{poste}</strong>."
            ),
            p(
                "Notre équipe recrutement étudie votre profil et vous recontactera "
                "si celui-ci correspond à nos besoins."
            ),
            closing(),
        ),
        "variables": ["nom", "poste"],
    },
    {
        "code": "candidature.equipe",
        "objet": "Nouvelle candidature — {poste}",
        "corps_html": _join(
            title("Nouvelle candidature reçue"),
            info_card(
                [
                    ("Poste", "<strong>{poste}</strong>"),
                    ("Candidat", "{nom}"),
                    ("Email", "{email}"),
                    ("Téléphone", "{telephone}"),
                ],
                tone="info",
            ),
            callout("{message}", tone="info"),
            p("Le CV est disponible dans l'administration (module Candidatures)."),
            closing(),
        ),
        "variables": ["poste", "nom", "email", "telephone", "message"],
    },
]


class Command(BaseCommand):
    help = "Seed idempotent des templates d'emails transactionnels HBC-RH."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Réécrit les templates déjà présents (sujet + corps + variables).",
        )

    def handle(self, *args, **options):
        force = options.get("force", False)
        created = updated = existed = 0
        for spec in TEMPLATES:
            obj, was_created = EmailTemplate.objects.get_or_create(
                code=spec["code"],
                defaults={
                    "objet": spec["objet"],
                    "corps_html": spec["corps_html"],
                    "variables": spec["variables"],
                    "actif": True,
                },
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  + {obj.code}"))
            elif force:
                obj.objet = spec["objet"]
                obj.corps_html = spec["corps_html"]
                obj.variables = spec["variables"]
                obj.save(update_fields=["objet", "corps_html", "variables", "updated_at"])
                updated += 1
                self.stdout.write(self.style.WARNING(f"  ↻ {obj.code} (réécrit)"))
            else:
                existed += 1
                self.stdout.write(f"  · {obj.code} (déjà présent)")
        self.stdout.write(
            self.style.SUCCESS(f"\n{created} créé(s), {updated} réécrit(s), {existed} inchangé(s).")
        )
