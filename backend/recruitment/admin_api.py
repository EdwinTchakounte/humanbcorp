"""API de gestion RH — réservée au **super-admin plateforme**.

Le recrutement n'est PAS multi-tenant : il n'appartient à aucun espace/école,
c'est un outil global du super-admin. Toutes les vues ci-dessous sont donc gated
par `IsPlatformAdmin` (superuser ou groupe Admin/Second_Admin), sans aucun
filtrage par espace.

Côté candidat (dépôt public, liste des offres) → voir `recruitment/public.py`.
"""
from __future__ import annotations

from django.db.models import Count
from django.http import FileResponse, Http404
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from sitecms.roles import is_admin

from .models import Application, ApplicationNote, JobOffer


class IsPlatformAdmin(BasePermission):
    """Réservé au super-admin plateforme (transverse, hors espaces)."""

    message = "Réservé à l'administration de la plateforme."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_admin(request.user))


def _audit(request, action, entite_type, entite_id, details):
    """Trace une action RH dans le journal d'audit (défensif — ne casse rien)."""
    from apps_coop.audit.services import client_ip, record

    record(
        action=action, entite_type=entite_type, entite_id=entite_id,
        user=getattr(request, "user", None), details=details,
        ip=client_ip(request), user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class JobOfferAdminSerializer(serializers.ModelSerializer):
    contract_label = serializers.CharField(source="get_contract_type_display", read_only=True)
    applications_count = serializers.IntegerField(read_only=True)
    # Aperçu des règles calculées : le dashboard affiche exactement ce que
    # verra le public, sans réimplémenter la logique côté front.
    headline = serializers.CharField(read_only=True)
    apply_mode = serializers.CharField(read_only=True)
    company_logo_url = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = JobOffer
        fields = [
            "id", "title", "slug", "department", "location",
            "contract_type", "contract_label", "salary",
            "description", "profile",
            "is_published", "closing_date", "applications_count",
            # Compte recruteur de suivi (lecture seule côté recruteur)
            "owner", "owner_name",
            # Entreprise
            "company_name", "company_logo", "company_logo_url", "company_website",
            # Formule commerciale
            "plan", "is_featured",
            # Candidature directe
            "apply_email", "apply_url", "apply_mode",
            # Bascules d'affichage
            "show_company", "show_salary", "show_location",
            "show_contract", "show_department", "show_closing_date",
            "headline", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]
        extra_kwargs = {"company_logo": {"write_only": True, "required": False}}

    def get_company_logo_url(self, obj):
        if not obj.company_logo:
            return None
        request = self.context.get("request")
        try:
            url = obj.company_logo.url
        except ValueError:
            return None
        return request.build_absolute_uri(url) if request else url

    def get_owner_name(self, obj):
        u = obj.owner
        if not u:
            return None
        return u.get_full_name() or u.username

    def validate(self, attrs):
        """Garde-fou : la candidature directe est une contrepartie du premium."""
        plan = attrs.get("plan", getattr(self.instance, "plan", JobOffer.Plan.CLASSIC))
        if plan != JobOffer.Plan.PREMIUM:
            for champ in ("apply_email", "apply_url"):
                if attrs.get(champ):
                    raise serializers.ValidationError(
                        {champ: "La candidature directe requiert la formule Premium."}
                    )
            if attrs.get("is_featured"):
                raise serializers.ValidationError(
                    {"is_featured": "La mise en avant requiert la formule Premium."}
                )
        return attrs


class ApplicationNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationNote
        fields = ["id", "body", "author_name", "created_at"]
        read_only_fields = ["id", "author_name", "created_at"]

    def get_author_name(self, obj):
        u = obj.author
        return (u.get_full_name() or u.username) if u else "—"


class ApplicationAdminSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    offer_title = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    cv_url = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Application
        fields = [
            "id", "offer", "offer_title", "first_name", "last_name", "full_name",
            "email", "phone", "cover_letter", "cv_url",
            "status", "status_label", "rating", "assigned_to", "assigned_to_name",
            "created_at", "updated_at",
        ]
        # Les coordonnées et le CV viennent du dépôt public : le suivi RH ne
        # modifie que l'avancement (statut/évaluation/affectation).
        read_only_fields = [
            "id", "offer", "offer_title", "first_name", "last_name", "full_name",
            "email", "phone", "cover_letter", "cv_url", "status_label",
            "assigned_to_name", "created_at", "updated_at",
        ]

    def get_offer_title(self, obj):
        return obj.offer.title if obj.offer else "Candidature spontanée"

    def get_assigned_to_name(self, obj):
        u = obj.assigned_to
        return (u.get_full_name() or u.username) if u else None

    def get_cv_url(self, obj):
        if not obj.cv:
            return None
        # On sert le CV par un endpoint contrôlé (pas l'URL média brute).
        request = self.context.get("request")
        url = f"/api/v1/rh/candidatures/{obj.pk}/cv/"
        return request.build_absolute_uri(url) if request else url

    def validate_rating(self, v):
        if v is not None and not (0 <= v <= 5):
            raise serializers.ValidationError("L'évaluation doit être comprise entre 0 et 5.")
        return v


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------
class JobOfferAdminViewSet(viewsets.ModelViewSet):
    """CRUD des offres d'emploi (super-admin)."""

    permission_classes = [IsPlatformAdmin]
    serializer_class = JobOfferAdminSerializer
    # Multipart : nécessaire pour téléverser le logo de l'entreprise.
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return (
            JobOffer.objects.annotate(applications_count=Count("applications"))
            .order_by("-is_featured", "-created_at")
        )

    def perform_create(self, serializer):
        offer = serializer.save()
        _audit(self.request, "offer.created", "JobOffer", offer.pk,
               {"title": offer.title, "plan": offer.plan})

    def perform_update(self, serializer):
        avant = {"is_published": serializer.instance.is_published,
                 "plan": serializer.instance.plan, "owner": serializer.instance.owner_id}
        offer = serializer.save()
        apres = {"is_published": offer.is_published, "plan": offer.plan, "owner": offer.owner_id}
        change = {k: [avant[k], apres[k]] for k in avant if avant[k] != apres[k]}
        _audit(self.request, "offer.updated", "JobOffer", offer.pk, change or {"touched": True})

    def perform_destroy(self, instance):
        pk, title = instance.pk, instance.title
        _audit(self.request, "offer.deleted", "JobOffer", pk, {"title": title})
        instance.delete()


class ApplicationAdminViewSet(viewsets.ModelViewSet):
    """Pipeline des candidatures (super-admin) : filtrer, faire avancer, noter, affecter.

    Pas de création ici (les candidatures naissent du dépôt public). On autorise
    la mise à jour partielle (statut/évaluation/affectation), la suppression, et
    des actions dédiées : notes internes + téléchargement du CV.
    """

    permission_classes = [IsPlatformAdmin]
    serializer_class = ApplicationAdminSerializer
    http_method_names = ["get", "patch", "delete", "post", "head", "options"]

    def get_queryset(self):
        qs = Application.objects.select_related("offer", "assigned_to").order_by("-created_at")
        p = self.request.query_params
        offer = p.get("offer")
        if offer:
            qs = qs.filter(offer_id=offer)
        st = p.get("status")
        if st not in (None, ""):
            qs = qs.filter(status=st)
        spontaneous = p.get("spontaneous")
        if spontaneous == "true":
            qs = qs.filter(offer__isnull=True)
        q = (p.get("q") or "").strip()
        if q:
            from django.db.models import Q

            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q)
            )
        return qs

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Les candidatures se déposent depuis la vitrine."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def perform_update(self, serializer):
        inst = serializer.instance
        avant = {"status": inst.status, "rating": inst.rating, "assigned_to": inst.assigned_to_id}
        obj = serializer.save()
        apres = {"status": obj.status, "rating": obj.rating, "assigned_to": obj.assigned_to_id}
        change = {k: [avant[k], apres[k]] for k in avant if avant[k] != apres[k]}
        if change:
            _audit(self.request, "application.updated", "Application", obj.pk, change)

    @action(detail=True, methods=["get", "post"])
    def notes(self, request, pk=None):
        """GET → fil des notes ; POST {body} → ajoute une note (auteur = requêteur)."""
        application = self.get_object()
        if request.method == "POST":
            body = (request.data.get("body") or "").strip()
            if not body:
                return Response({"detail": "Note vide."}, status=status.HTTP_400_BAD_REQUEST)
            note = ApplicationNote.objects.create(
                application=application, author=request.user, body=body
            )
            _audit(request, "application.note_added", "Application", application.pk,
                   {"note_id": note.pk})
            return Response(ApplicationNoteSerializer(note).data, status=status.HTTP_201_CREATED)
        notes = application.notes.select_related("author")
        return Response(ApplicationNoteSerializer(notes, many=True).data)

    @action(detail=True, methods=["get"])
    def cv(self, request, pk=None):
        """GET → télécharge le CV (accès contrôlé, réservé au super-admin)."""
        application = self.get_object()
        if not application.cv:
            raise Http404("Aucun CV.")
        try:
            fh = application.cv.open("rb")
        except (FileNotFoundError, ValueError):
            raise Http404("CV introuvable.")
        import os

        return FileResponse(fh, as_attachment=True, filename=os.path.basename(application.cv.name))


class RecruitmentOverviewView(viewsets.ViewSet):
    """Vue d'ensemble RH : compteurs par étape + pipeline (super-admin)."""

    permission_classes = [IsPlatformAdmin]

    def list(self, request):
        by_status = {
            row["status"]: row["n"]
            for row in Application.objects.values("status").annotate(n=Count("id"))
        }
        pipeline = [
            {"value": int(s), "label": s.label, "count": by_status.get(int(s), 0)}
            for s in Application.PIPELINE_ORDER
        ]
        rejected = Application.Status.REJECTED
        return Response({
            "offers": {
                "total": JobOffer.objects.count(),
                "published": JobOffer.objects.filter(is_published=True).count(),
            },
            "applications": {
                "total": sum(by_status.values()),
                "rejected": by_status.get(int(rejected), 0),
            },
            "pipeline": pipeline,
            "statuses": [{"value": int(v), "label": l} for v, l in Application.Status.choices],
        })


class RecruiterAccountsView(viewsets.ViewSet):
    """GET /rh/recruteurs/ → comptes recruteurs, pour attribuer une offre.

    Alimente la liste déroulante « Recruteur (compte de suivi) » du dashboard
    super-admin. Ne renvoie que l'indispensable (id + libellé + email).
    """

    permission_classes = [IsPlatformAdmin]

    def list(self, request):
        from django.contrib.auth.models import User

        from sitecms.roles import RECRUITER_GROUP

        users = (
            User.objects.filter(groups__name__iexact=RECRUITER_GROUP)
            .distinct()
            .order_by("username")
        )
        return Response([
            {
                "id": u.id,
                "label": u.get_full_name() or u.username,
                "email": u.email,
            }
            for u in users
        ])
