"""Endpoints **publics** (visiteur non connecté) du recrutement :
liste/détail des offres et dépôt de candidature avec upload de CV.
"""
from __future__ import annotations

import logging
import os

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.decorators import (
    api_view,
    parser_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Application, JobOffer

logger = logging.getLogger(__name__)

CV_ALLOWED_EXT = {".pdf", ".doc", ".docx"}
CV_MAX_BYTES = 5 * 1024 * 1024  # 5 Mo


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class JobOfferSerializer(serializers.ModelSerializer):
    contract_label = serializers.CharField(source="get_contract_type_display", read_only=True)

    class Meta:
        model = JobOffer
        fields = [
            "id", "title", "slug", "department", "location",
            "contract_type", "contract_label", "description", "profile",
            "closing_date", "created_at",
        ]


class ApplicationCreateSerializer(serializers.ModelSerializer):
    offer_slug = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Application
        fields = [
            "id", "offer_slug", "first_name", "last_name",
            "email", "phone", "cover_letter", "cv",
        ]
        read_only_fields = ["id"]

    def validate_cv(self, f):
        ext = os.path.splitext(f.name)[1].lower()
        if ext not in CV_ALLOWED_EXT:
            raise serializers.ValidationError(
                "Format de CV non accepté (PDF, DOC ou DOCX uniquement)."
            )
        if f.size > CV_MAX_BYTES:
            raise serializers.ValidationError("Le CV ne doit pas dépasser 5 Mo.")
        return f

    def validate(self, attrs):
        slug = (attrs.pop("offer_slug", "") or "").strip()
        attrs["offer"] = None
        if slug:
            offer = JobOffer.objects.filter(slug=slug, is_published=True).first()
            if not offer:
                raise serializers.ValidationError({"offer_slug": "Offre introuvable ou clôturée."})
            attrs["offer"] = offer
        return attrs


# ---------------------------------------------------------------------------
# Throttle anti-abus
# ---------------------------------------------------------------------------
class CandidatureThrottle(AnonRateThrottle):
    scope = "candidature"
    rate = "10/hour"


def _published_qs():
    return JobOffer.objects.filter(is_published=True)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def offers_list(request):
    """GET /api/v1/site/offres/ → offres publiées."""
    data = JobOfferSerializer(_published_qs(), many=True, context={"request": request}).data
    return Response({"results": data, "count": len(data)})


@api_view(["GET"])
@permission_classes([AllowAny])
def offer_detail(request, slug):
    """GET /api/v1/site/offres/<slug>/ → détail d'une offre publiée."""
    offer = _published_qs().filter(slug=slug).first()
    if not offer:
        return Response({"detail": "Offre introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(JobOfferSerializer(offer, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
@throttle_classes([CandidatureThrottle])
def application_create(request):
    """POST /api/v1/site/candidature/ → dépôt d'une candidature (multipart + CV).

    ``offer_slug`` vide ⇒ candidature spontanée. Envoie l'accusé au candidat et
    la notification à l'équipe RH (moteur d'événements Brevo, best-effort).
    """
    ser = ApplicationCreateSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    application = ser.save()

    _notify_candidate(application)
    _notify_team(application)

    return Response(
        {
            "detail": "Votre candidature a bien été envoyée. Nous vous recontacterons.",
            "application_id": application.id,
        },
        status=status.HTTP_201_CREATED,
    )


def _cible_label(application) -> str:
    return application.offer.title if application.offer else "Candidature spontanée"


def _notify_candidate(application):
    try:
        from apps_coop.notifications.events import emit_event

        emit_event(
            "candidature.recue",
            member=None,
            to_email=application.email,
            context={
                "nom": application.full_name,
                "poste": _cible_label(application),
            },
        )
    except Exception:  # noqa: BLE001 — notification best-effort
        logger.exception("Échec accusé candidature")


def _notify_team(application):
    to = getattr(settings, "CONTACT_NOTIFICATION_EMAIL", None)
    if not to:
        return
    try:
        from apps_coop.notifications.events import emit_event

        emit_event(
            "candidature.equipe",
            member=None,
            to_email=to,
            context={
                "nom": application.full_name,
                "poste": _cible_label(application),
                "email": application.email,
                "telephone": application.phone or "—",
                "message": application.cover_letter or "—",
            },
        )
    except Exception:  # noqa: BLE001 — notification best-effort
        logger.exception("Échec notification équipe candidature")
