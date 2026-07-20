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
    """Vue publique d'une offre — filtrée par les règles d'affichage.

    On ne sérialise QUE ce qui est montrable : un champ désactivé, vide, ou
    réservé au premium (identité de l'entreprise) n'apparaît pas du tout dans
    la réponse. L'anonymat est ainsi garanti côté serveur, pas seulement
    masqué à l'affichage.
    """

    headline = serializers.CharField(read_only=True)
    company = serializers.SerializerMethodField()
    contract_label = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    salary = serializers.SerializerMethodField()
    closing_date = serializers.SerializerMethodField()
    apply = serializers.SerializerMethodField()

    class Meta:
        model = JobOffer
        fields = [
            "id", "title", "slug", "headline", "company",
            "department", "location", "contract_label", "salary",
            "description", "profile", "closing_date",
            "is_featured", "apply", "created_at",
        ]

    def _vis(self, obj):
        # Calculé une fois par objet plutôt qu'à chaque champ.
        if not hasattr(obj, "_vis_cache"):
            obj._vis_cache = obj.visible_fields()
        return obj._vis_cache

    def get_company(self, obj):
        nom = obj.company_display
        if not nom:
            return None  # offre anonyme : rien ne filtre, pas même le logo
        request = self.context.get("request")
        logo = None
        if obj.company_logo:
            try:
                logo = obj.company_logo.url
                if request:
                    logo = request.build_absolute_uri(logo)
            except ValueError:
                logo = None
        return {"name": nom, "logo": logo, "website": obj.company_website or None}

    def get_contract_label(self, obj):
        return self._vis(obj)["contract"]

    def get_department(self, obj):
        return self._vis(obj)["department"]

    def get_location(self, obj):
        return self._vis(obj)["location"]

    def get_salary(self, obj):
        return self._vis(obj)["salary"]

    def get_closing_date(self, obj):
        return self._vis(obj)["closing_date"]

    def get_apply(self, obj):
        """Où postuler : formulaire plateforme, ou directement chez le client."""
        return {"mode": obj.apply_mode, "target": obj.apply_target}


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
            # Une offre en candidature directe ne passe pas par la plateforme :
            # sans ce garde-fou, un POST forgé déposerait chez nous un dossier
            # que le client attend dans sa propre boîte.
            if offer.apply_mode == "direct":
                raise serializers.ValidationError(
                    {"offer_slug": "Cette offre se postule directement auprès de l'entreprise."}
                )
            attrs["offer"] = offer
        return attrs


# ---------------------------------------------------------------------------
# Throttle anti-abus
# ---------------------------------------------------------------------------
class CandidatureThrottle(AnonRateThrottle):
    scope = "candidature"
    rate = "10/hour"


def _published_qs():
    # Les offres « mises en avant » (premium) remontent en tête de liste.
    return JobOffer.objects.filter(is_published=True).order_by("-is_featured", "-created_at")


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
