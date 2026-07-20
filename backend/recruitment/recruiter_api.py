"""Espace recruteur — suivi en **lecture seule**, réservé au groupe `Recruiter`.

Étape intermédiaire du recrutement : une entreprise cliente dispose d'un compte
qui lui donne une **fenêtre de suivi sur SES offres** (celles dont elle est
`owner`) et les candidatures reçues, **dossier complet + CV**. Elle ne publie
rien, ne fait pas avancer le pipeline et ne voit pas les notes internes HBC — la
publication et le suivi restent la main du super-admin (`admin_api.py`).

Toutes les vues sont donc :
- gated par `IsRecruiter` (membre du groupe Recruiter, authentifié) ;
- **strictement cloisonnées** par `owner == request.user` — un recruteur ne voit
  jamais ni les offres ni les candidatures d'un autre ;
- en lecture seule (`ReadOnlyModelViewSet`, aucune écriture exposée).
"""
from __future__ import annotations

import os

from django.db.models import Count
from django.http import FileResponse, Http404
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from sitecms.roles import is_recruiter

from .models import Application, JobOffer


class IsRecruiter(BasePermission):
    """Réservé à un compte recruteur (groupe Recruiter, authentifié)."""

    message = "Réservé aux comptes recruteurs."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_recruiter(request.user))


# ---------------------------------------------------------------------------
# Serializers (lecture seule)
# ---------------------------------------------------------------------------
class RecruiterOfferSerializer(serializers.ModelSerializer):
    contract_label = serializers.CharField(source="get_contract_type_display", read_only=True)
    applications_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = JobOffer
        fields = [
            "id", "title", "slug", "department", "location",
            "contract_type", "contract_label", "salary",
            "is_published", "closing_date", "applications_count",
            "plan", "is_featured", "created_at",
        ]


class RecruiterApplicationSerializer(serializers.ModelSerializer):
    """Dossier complet du candidat — SANS les notes internes HBC."""

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    offer_title = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)
    cv_url = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "offer", "offer_title", "first_name", "last_name", "full_name",
            "email", "phone", "cover_letter", "cv_url",
            "status", "status_label", "rating", "created_at", "updated_at",
        ]

    def get_offer_title(self, obj):
        return obj.offer.title if obj.offer else "Candidature spontanée"

    def get_cv_url(self, obj):
        if not obj.cv:
            return None
        # Endpoint contrôlé et cloisonné (jamais l'URL média brute).
        request = self.context.get("request")
        url = f"/api/v1/rh/espace/candidatures/{obj.pk}/cv/"
        return request.build_absolute_uri(url) if request else url


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------
class RecruiterOfferViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /rh/espace/offres/ → les offres du recruteur connecté."""

    permission_classes = [IsRecruiter]
    serializer_class = RecruiterOfferSerializer

    def get_queryset(self):
        return (
            JobOffer.objects.filter(owner=self.request.user)
            .annotate(applications_count=Count("applications"))
            .order_by("-created_at")
        )


class RecruiterApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /rh/espace/candidatures/ → candidatures sur SES offres (dossier + CV).

    Filtres : `offer`, `status`, recherche `q` (nom/prénom/email). Lecture seule.
    """

    permission_classes = [IsRecruiter]
    serializer_class = RecruiterApplicationSerializer

    def get_queryset(self):
        # Cloisonnement fondamental : uniquement les candidatures dont l'offre
        # appartient au recruteur. Les spontanées (offer=null) n'appartiennent à
        # personne → jamais visibles ici.
        qs = (
            Application.objects.filter(offer__owner=self.request.user)
            .select_related("offer")
            .order_by("-created_at")
        )
        p = self.request.query_params
        offer = p.get("offer")
        if offer:
            qs = qs.filter(offer_id=offer)
        st = p.get("status")
        if st not in (None, ""):
            qs = qs.filter(status=st)
        q = (p.get("q") or "").strip()
        if q:
            from django.db.models import Q

            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q)
            )
        return qs

    @action(detail=True, methods=["get"])
    def cv(self, request, pk=None):
        """GET → télécharge le CV, uniquement si l'offre appartient au recruteur."""
        application = self.get_object()  # get_queryset borne déjà à owner=self
        if not application.cv:
            raise Http404("Aucun CV.")
        try:
            fh = application.cv.open("rb")
        except (FileNotFoundError, ValueError):
            raise Http404("CV introuvable.")
        return FileResponse(fh, as_attachment=True, filename=os.path.basename(application.cv.name))


class RecruiterOverviewView(viewsets.ViewSet):
    """GET /rh/espace/overview/ → pipeline restreint aux offres du recruteur."""

    permission_classes = [IsRecruiter]

    def list(self, request):
        base = Application.objects.filter(offer__owner=request.user)
        by_status = {
            row["status"]: row["n"]
            for row in base.values("status").annotate(n=Count("id"))
        }
        pipeline = [
            {"value": int(s), "label": s.label, "count": by_status.get(int(s), 0)}
            for s in Application.PIPELINE_ORDER
        ]
        rejected = Application.Status.REJECTED
        return Response({
            "offers": {
                "total": JobOffer.objects.filter(owner=request.user).count(),
                "published": JobOffer.objects.filter(owner=request.user, is_published=True).count(),
            },
            "applications": {
                "total": sum(by_status.values()),
                "rejected": by_status.get(int(rejected), 0),
            },
            "pipeline": pipeline,
            "statuses": [{"value": int(v), "label": l} for v, l in Application.Status.choices],
        })
