"""Vues API du CMS.

- Endpoints **publics** (vitrine) : nav, page par slug (nested visible), réglages.
- **CRUD dashboard** (ViewSets) : pages, sections, cards, médias, réglages.
- **Contact** : POST → e-mail (réutilise la config SMTP du projet).
"""

import requests
from django.conf import settings
from django.core.mail import send_mail
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from calendarapp.models import Event, Meeting
from lessonapp.models import Theme, Session, Sequence, Categorie, Classe
from contents.models import Publication, Category, Tags, Space
from paiement.models import Paiement
from bucket.models import Inscription, Order
from chat.models import Project, ChatMessage
from .roles import is_admin, module_is_accessible, has_app_write, profile_payload, MODULES
from .serializers_modules import (
    EventSerializer,
    MeetingSerializer,
    ProfileTokenSerializer,
    ThemeSerializer,
    SessionMiniSerializer,
    SequenceMiniSerializer,
    CategorieMiniSerializer,
    ClasseMiniSerializer,
    PublicationSerializer,
    CategoryMiniSerializer,
    TagsMiniSerializer,
    PaiementSerializer,
    PAIEMENT_STATUS,
    PAIEMENT_METHOD,
    InscriptionSerializer,
    OrderSerializer,
    INSCRIPTION_STATUS,
    ORDER_STATUS,
    ChatProjectSerializer,
    ChatMessageSerializer,
)
from .models import Article, Card, MediaAsset, Page, Section, SiteSettings
from .serializers import (
    ArticleDetailSerializer,
    ArticleListSerializer,
    ArticleSerializer,
    CardSerializer,
    ContactSerializer,
    MediaAssetSerializer,
    NavItemSerializer,
    PagePublicSerializer,
    PageSerializer,
    SectionSerializer,
    SiteSettingsSerializer,
    SiteSettingsWriteSerializer,
)


class IsStaffOrReadOnly(permissions.BasePermission):
    """Lecture pour tous, écriture réservée aux profils **admin** (Admin/Second_Admin)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_admin(request.user)


class HasModuleAccess(permissions.BasePermission):
    """Accès à un module selon le profil, en respectant lecture vs écriture.

    - Lecture (GET/HEAD/OPTIONS) : le module doit être accessible (perm `view_*`).
    - Écriture : requiert une perm add/change/delete sur l'app (ou profil admin).
    Le module ciblé est lu sur la vue via l'attribut `module_key`.
    """

    def has_permission(self, request, view):
        key = getattr(view, "module_key", None)
        module = next((m for m in MODULES if m["key"] == key), None)
        if module is None:
            return False
        if not module_is_accessible(request.user, module):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if module.get("admin_only"):
            return is_admin(request.user)
        app = module.get("app")
        return has_app_write(request.user, app) if app else is_admin(request.user)


# ---------------------------------------------------------------------------
# Endpoints publics (vitrine)
# ---------------------------------------------------------------------------
class _LangContextMixin:
    """Ajoute `lang` (fr|en) au contexte du serializer depuis ?lang=."""

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["lang"] = "en" if self.request.query_params.get("lang") == "en" else "fr"
        return ctx


class NavView(_LangContextMixin, ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = NavItemSerializer

    def get_queryset(self):
        return Page.objects.filter(is_active=True, is_deleted=False, show_in_nav=True).order_by("order", "id")


class PageContentView(_LangContextMixin, RetrieveAPIView):
    """GET /site/pages/<slug>/ → page + sections + cards visibles, ordonnés."""

    permission_classes = [permissions.AllowAny]
    serializer_class = PagePublicSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Page.objects.filter(is_active=True, is_deleted=False)


class SiteSettingsPublicView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        obj = SiteSettings.load()
        lang = "en" if request.query_params.get("lang") == "en" else "fr"
        return Response(SiteSettingsSerializer(obj, context={"request": request, "lang": lang}).data)


class ArticleListView(_LangContextMixin, ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ArticleListSerializer

    def get_queryset(self):
        return Article.objects.filter(is_active=True, is_deleted=False)


class ArticleDetailView(_LangContextMixin, RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ArticleDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Article.objects.filter(is_active=True, is_deleted=False)


# ---------------------------------------------------------------------------
# CRUD dashboard
# ---------------------------------------------------------------------------
class _BaseCmsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffOrReadOnly]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class PageViewSet(_BaseCmsViewSet):
    serializer_class = PageSerializer

    def get_queryset(self):
        qs = Page.objects.filter(is_deleted=False)
        if not is_admin(self.request.user):
            qs = qs.filter(is_active=True)
        return qs.order_by("order", "id")


class SectionViewSet(_BaseCmsViewSet):
    serializer_class = SectionSerializer

    def get_queryset(self):
        qs = Section.objects.filter(is_deleted=False)
        page = self.request.query_params.get("page")
        if page:
            qs = qs.filter(page_id=page)
        if not is_admin(self.request.user):
            qs = qs.filter(is_active=True)
        return qs.order_by("order", "id")


class CardViewSet(_BaseCmsViewSet):
    serializer_class = CardSerializer

    def get_queryset(self):
        qs = Card.objects.filter(is_deleted=False)
        section = self.request.query_params.get("section")
        if section:
            qs = qs.filter(section_id=section)
        if not is_admin(self.request.user):
            qs = qs.filter(is_active=True)
        return qs.order_by("order", "id")


class MediaAssetViewSet(_BaseCmsViewSet):
    serializer_class = MediaAssetSerializer
    queryset = MediaAsset.objects.filter(is_deleted=False).order_by("order", "-created_at")


class ArticleViewSet(_BaseCmsViewSet):
    serializer_class = ArticleSerializer

    def get_queryset(self):
        qs = Article.objects.filter(is_deleted=False)
        if not is_admin(self.request.user):
            qs = qs.filter(is_active=True)
        return qs


class SiteSettingsViewSet(viewsets.ViewSet):
    """Singleton : GET / PUT / PATCH sur l'unique enregistrement."""

    permission_classes = [IsStaffOrReadOnly]

    def list(self, request):
        obj = SiteSettings.load()
        # Le dashboard édite les champs bruts (y compris *_en) → write serializer.
        return Response(SiteSettingsWriteSerializer(obj).data)

    def update(self, request, pk=None):
        obj = SiteSettings.load()
        ser = SiteSettingsWriteSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(SiteSettingsWriteSerializer(obj).data)

    partial_update = update


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------
class ContactView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = ContactSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        cfg = SiteSettings.load()
        to_email = cfg.email or getattr(settings, "EMAIL_HOST_USER", "") or "recrutementhbcrh@gmail.com"
        subject = f"[Site HBC-RH] Demande de {d['name']} {d.get('firstname', '')}".strip()
        lines = [
            f"Nom       : {d['name']} {d.get('firstname', '')}",
            f"Entreprise: {d.get('company', '')}",
            f"Email     : {d['email']}",
            f"Téléphone : {d.get('phone', '')}",
            f"Service   : {d.get('service', '')}",
            "",
            "Message :",
            d["message"],
        ]
        try:
            send_mail(
                subject,
                "\n".join(lines),
                getattr(settings, "EMAIL_HOST_USER", "") or to_email,
                [to_email],
                fail_silently=False,
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": "Envoi impossible pour le moment.", "error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": "Message envoyé. Nous vous recontactons sous 24h."}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Chatbot (proxy OpenRouter — la clé ne quitte jamais le serveur)
# ---------------------------------------------------------------------------
class ChatView(APIView):
    permission_classes = [permissions.AllowAny]

    def _system_prompt(self):
        s = SiteSettings.load()
        phones = ", ".join(p.strip() for p in (s.phones or "").split(",") if p.strip())
        return (
            "Tu es l'assistant virtuel de Human Brain Corporation-RH (HBC-RH), un cabinet "
            "d'accompagnement en ressources humaines basé à Douala, Cameroun. Slogan : "
            f"« {s.slogan} ». Nos 4 pôles : Recrutement local & international, Management des "
            "talents, Formation & coaching, Externalisation RH (droit social, conformité, paie). "
            f"Coordonnées : {s.address or ''} · {phones} · {s.email or ''}. "
            "Réponds de façon chaleureuse, concise et professionnelle, en français ou en anglais "
            "selon la langue de l'utilisateur. Oriente vers une prise de contact / rendez-vous quand "
            "c'est pertinent. Ne réponds qu'aux sujets liés aux RH et à HBC-RH ; pour le reste, "
            "invite poliment à contacter l'équipe."
        )

    def post(self, request):
        if not settings.OPENROUTER_API_KEY:
            return Response(
                {"detail": "Le chatbot n'est pas encore configuré (clé API manquante)."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        history = request.data.get("messages", [])
        if not isinstance(history, list):
            return Response({"detail": "messages doit être une liste."}, status=status.HTTP_400_BAD_REQUEST)
        # Ne garde que les 12 derniers tours, rôles autorisés.
        clean = [
            {"role": m.get("role"), "content": str(m.get("content", ""))[:4000]}
            for m in history[-12:]
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        messages = [{"role": "system", "content": self._system_prompt()}, *clean]

        try:
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "X-Title": "HBC-RH Assistant",
                },
                json={"model": settings.OPENROUTER_MODEL, "messages": messages, "max_tokens": 600, "temperature": 0.4},
                timeout=45,
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": "Le service de chat est momentanément indisponible.", "error": str(exc)[:200]},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"reply": reply})


# ---------------------------------------------------------------------------
# Auth enrichie (profil/rôles) + modules rapatriés
# ---------------------------------------------------------------------------
class ProfileTokenView(TokenObtainPairView):
    """POST /auth/token/ → tokens JWT + `profile` (rôle, groupes, modules)."""

    serializer_class = ProfileTokenSerializer


class MeView(APIView):
    """GET /auth/me/ → profil du compte connecté (rôle + modules accessibles)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(profile_payload(request.user))


class _ModuleViewSet(viewsets.ModelViewSet):
    """Base des modules rapatriés : accès gated par profil (comme le Django admin)."""

    permission_classes = [HasModuleAccess]


class EventViewSet(_ModuleViewSet):
    module_key = "agenda"
    serializer_class = EventSerializer

    def get_queryset(self):
        qs = Event.objects.filter(is_deleted=False).select_related("user")
        # Un profil non-admin ne voit que ses propres événements (logique de l'app de base).
        if not is_admin(self.request.user):
            qs = qs.filter(user=self.request.user)
        return qs.order_by("-start_time")

    def perform_create(self, serializer):
        serializer.save(user=serializer.validated_data.get("user") or self.request.user)


class MeetingViewSet(_ModuleViewSet):
    module_key = "agenda"
    serializer_class = MeetingSerializer

    def get_queryset(self):
        qs = Meeting.objects.filter(is_deleted=False).select_related("event")
        if not is_admin(self.request.user):
            qs = qs.filter(event__user=self.request.user)
        return qs.order_by("-created_at")


class ThemeViewSet(_ModuleViewSet):
    """Module Formations : les thèmes (Cours/Examen) = catalogue de formations."""

    module_key = "formations"
    serializer_class = ThemeSerializer

    def get_queryset(self):
        qs = Theme.objects.filter(is_deleted=False).select_related(
            "categorie", "sequence", "sequence__session"
        ).prefetch_related("classes")
        session = self.request.query_params.get("session")
        if session:
            qs = qs.filter(sequence__session_id=session)
        categorie = self.request.query_params.get("categorie")
        if categorie:
            qs = qs.filter(categorie_id=categorie)
        return qs.order_by("-id")


class FormationsOverviewView(APIView):
    """GET /modules/formations/overview/ → compteurs + listes pour filtres."""

    permission_classes = [HasModuleAccess]
    module_key = "formations"

    def get(self, request):
        ctx = {"request": request}
        return Response({
            "counts": {
                "themes": Theme.objects.filter(is_deleted=False).count(),
                "sessions": Session.objects.filter(is_deleted=False).count(),
                "sequences": Sequence.objects.filter(is_deleted=False).count(),
                "classes": Classe.objects.filter(is_deleted=False).count(),
                "categories": Categorie.objects.filter(is_deleted=False).count(),
            },
            "sessions": SessionMiniSerializer(Session.objects.filter(is_deleted=False).order_by("-year"), many=True, context=ctx).data,
            "sequences": SequenceMiniSerializer(Sequence.objects.filter(is_deleted=False), many=True, context=ctx).data,
            "categories": CategorieMiniSerializer(Categorie.objects.filter(is_deleted=False), many=True, context=ctx).data,
            "classes": ClasseMiniSerializer(Classe.objects.filter(is_deleted=False), many=True, context=ctx).data,
        })


class PublicationViewSet(_ModuleViewSet):
    """Module Publications : contenus (contents.Publication)."""

    module_key = "publications"
    serializer_class = PublicationSerializer

    def get_queryset(self):
        qs = Publication.objects.select_related("categorie").prefetch_related("liste_tags")
        categorie = self.request.query_params.get("categorie")
        if categorie:
            qs = qs.filter(categorie_id=categorie)
        visibility = self.request.query_params.get("visibility")
        if visibility == "public":
            qs = qs.filter(is_private=False)
        elif visibility == "private":
            qs = qs.filter(is_private=True)
        return qs.order_by("-date", "-id")


class PublicationsOverviewView(APIView):
    """GET /modules/publications/overview/ → compteurs + listes (catégories, tags)."""

    permission_classes = [HasModuleAccess]
    module_key = "publications"

    def get(self, request):
        ctx = {"request": request}
        return Response({
            "counts": {
                "publications": Publication.objects.count(),
                "public": Publication.objects.filter(is_private=False).count(),
                "categories": Category.objects.count(),
                "tags": Tags.objects.count(),
                "spaces": Space.objects.count(),
            },
            "categories": CategoryMiniSerializer(Category.objects.all(), many=True, context=ctx).data,
            "tags": TagsMiniSerializer(Tags.objects.all(), many=True, context=ctx).data,
        })


class PaiementViewSet(_ModuleViewSet):
    """Module Paiements (paiement.Paiement) — un non-admin ne voit que les siens."""

    module_key = "paiements"
    serializer_class = PaiementSerializer

    def get_queryset(self):
        qs = Paiement.objects.filter(is_deleted=False).select_related("owner")
        if not is_admin(self.request.user):
            qs = qs.filter(owner=self.request.user)
        status_q = self.request.query_params.get("status")
        if status_q:
            qs = qs.filter(status=status_q)
        return qs.order_by("-created_at", "-id")


class PaiementsOverviewView(APIView):
    """GET /modules/paiements/overview/ → compteurs par statut + total encaissé."""

    permission_classes = [HasModuleAccess]
    module_key = "paiements"

    def get(self, request):
        qs = Paiement.objects.filter(is_deleted=False)
        if not is_admin(request.user):
            qs = qs.filter(owner=request.user)
        total = 0.0
        for m in qs.filter(status=1).values_list("montant", flat=True):
            try:
                total += float(str(m).replace(" ", "").replace(",", "."))
            except (TypeError, ValueError):
                continue
        return Response({
            "counts": {
                "total": qs.count(),
                "success": qs.filter(status=1).count(),
                "failed": qs.filter(status=2).count(),
                "pending": qs.filter(status=3).count(),
            },
            "total_encaisse": round(total, 2),
            "statuses": [{"value": k, "label": v} for k, v in PAIEMENT_STATUS.items()],
            "methods": [{"value": k, "label": v} for k, v in PAIEMENT_METHOD.items()],
        })


class InscriptionViewSet(_ModuleViewSet):
    """Module Inscriptions & Paniers — inscriptions (bucket.Inscription)."""

    module_key = "inscriptions"
    serializer_class = InscriptionSerializer

    def get_queryset(self):
        qs = Inscription.objects.filter(is_deleted=False).select_related("participant", "publication")
        if not is_admin(self.request.user):
            qs = qs.filter(participant=self.request.user)
        status_q = self.request.query_params.get("status")
        if status_q:
            qs = qs.filter(status=status_q)
        return qs.order_by("-created_at", "-id")


class OrderViewSet(_ModuleViewSet):
    """Module Inscriptions & Paniers — commandes (bucket.Order)."""

    module_key = "inscriptions"
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = Order.objects.filter(is_deleted=False).select_related("buyer")
        if not is_admin(self.request.user):
            qs = qs.filter(buyer=self.request.user)
        return qs.order_by("-created_at", "-id")

    def _resolve_montant(self, order, raw_montant):
        """Montant du paiement : valeur fournie, sinon total de la commande."""
        if raw_montant in (None, ""):
            return Decimal(order.total_amount)
        return Decimal(str(raw_montant))

    @action(detail=True, methods=["post"], url_path="encaisser")
    def encaisser(self, request, pk=None):
        """Encaissement **manuel** (saisie agence) d'une commande.

        Crée un `apps_coop.payments.Payment` (source=manuel) et le confirme
        immédiatement → le hook métier passe la commande en payée, confirme les
        inscriptions, vide le panier et envoie l'e-mail `paiement.recu`.
        """
        order = self.get_object()
        from apps_coop.payments.models import Payment
        from apps_coop.payments.services import confirm_payment_manually

        try:
            montant = self._resolve_montant(order, request.data.get("montant"))
        except (InvalidOperation, TypeError):
            return Response({"detail": "Montant invalide."}, status=status.HTTP_400_BAD_REQUEST)

        payment = Payment.objects.create(
            member=order.buyer,
            montant=montant,
            type=Payment.Type.FRAIS_INSCRIPTION,
            source=Payment.Source.MANUEL,
            statut=Payment.Statut.EN_ATTENTE,
            order=order,
            date_versement=timezone.now(),
            validated_by=request.user,
        )
        confirm_payment_manually(payment)
        order.refresh_from_db()
        return Response({
            "detail": "Encaissement enregistré.",
            "payment_id": payment.id,
            "order_status": order.status,
        })

    @action(detail=True, methods=["post"], url_path="payer-en-ligne")
    def payer_en_ligne(self, request, pk=None):
        """Initie un paiement **mobile money Tara** (STK push) pour la commande.

        Crée un Payment EN_ATTENTE (source=mobile_money, provider=tara) et
        déclenche l'init Tara. La confirmation arrive ensuite via le webhook.
        En mode mock (pas de creds Tara), aucune transaction réelle n'est faite.
        """
        order = self.get_object()
        from apps_coop.payments.models import Payment
        from apps_coop.payments.services import init_payin_for_payment, notify_payment_initiated

        phone = (request.data.get("phone") or "").strip()
        network = (request.data.get("network") or "").strip().upper()
        if not phone:
            return Response({"detail": "Numéro de téléphone requis."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            montant = self._resolve_montant(order, request.data.get("montant"))
        except (InvalidOperation, TypeError):
            return Response({"detail": "Montant invalide."}, status=status.HTTP_400_BAD_REQUEST)

        payment = Payment.objects.create(
            member=order.buyer,
            montant=montant,
            type=Payment.Type.FRAIS_INSCRIPTION,
            source=Payment.Source.MOBILE_MONEY,
            statut=Payment.Statut.EN_ATTENTE,
            provider_code="tara",
            order=order,
            date_versement=timezone.now(),
        )
        try:
            payment_url, ref, raw = init_payin_for_payment(payment, phone=phone, network=network)
            payment.save(update_fields=["reference_externe", "gateway_initiated_at", "updated_at"])
        except Exception as exc:  # noqa: BLE001 — remonte l'échec provider au front
            payment.statut = Payment.Statut.REJETE
            payment.motif_rejet = str(exc)[:500]
            payment.save(update_fields=["statut", "motif_rejet", "updated_at"])
            return Response(
                {"detail": f"Échec de l'initiation du paiement : {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        notify_payment_initiated(payment)
        return Response({
            "detail": "Paiement initié. Validez la demande sur votre téléphone (MoMo / Orange Money).",
            "payment_id": payment.id,
            "reference": ref,
            "payment_url": payment_url,
            "provider": raw,
        })


class InscriptionsOverviewView(APIView):
    """GET /modules/inscriptions/overview/ → compteurs inscriptions + commandes."""

    permission_classes = [HasModuleAccess]
    module_key = "inscriptions"

    def get(self, request):
        ins = Inscription.objects.filter(is_deleted=False)
        orders = Order.objects.filter(is_deleted=False)
        if not is_admin(request.user):
            ins = ins.filter(participant=request.user)
            orders = orders.filter(buyer=request.user)
        total_orders = 0.0
        for a in orders.filter(status=2).values_list("total_amount", flat=True):
            try:
                total_orders += float(a)
            except (TypeError, ValueError):
                continue
        return Response({
            "counts": {
                "inscriptions": ins.count(),
                "confirmed": ins.filter(status=2).count(),
                "waiting": ins.filter(status=1).count(),
                "orders": orders.count(),
                "orders_paid": orders.filter(status=2).count(),
            },
            "total_orders_paid": round(total_orders, 2),
            "inscription_statuses": [{"value": k, "label": v} for k, v in INSCRIPTION_STATUS.items()],
            "order_statuses": [{"value": k, "label": v} for k, v in ORDER_STATUS.items()],
        })


class ChatProjectViewSet(_ModuleViewSet):
    """Module Messagerie — projets de conversation (chat.Project)."""

    module_key = "messagerie"
    serializer_class = ChatProjectSerializer

    def get_queryset(self):
        qs = Project.objects.select_related("user")
        if not is_admin(self.request.user):
            qs = qs.filter(user=self.request.user)
        return qs.order_by("-created_at", "-id")


class ChatMessageViewSet(_ModuleViewSet):
    """Module Messagerie — messages (chat.ChatMessage)."""

    module_key = "messagerie"
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        qs = ChatMessage.objects.select_related("user", "project")
        if not is_admin(self.request.user):
            qs = qs.filter(user=self.request.user)
        project = self.request.query_params.get("project")
        if project:
            qs = qs.filter(project_id=project)
        return qs.order_by("-timestamp", "-id")


class MessagerieOverviewView(APIView):
    """GET /modules/messagerie/overview/ → compteurs projets/messages."""

    permission_classes = [HasModuleAccess]
    module_key = "messagerie"

    def get(self, request):
        projects = Project.objects.all()
        messages = ChatMessage.objects.all()
        if not is_admin(request.user):
            projects = projects.filter(user=request.user)
            messages = messages.filter(user=request.user)
        return Response({
            "counts": {
                "projects": projects.count(),
                "messages": messages.count(),
                "answered": messages.exclude(response__isnull=True).exclude(response="").count(),
            },
        })
