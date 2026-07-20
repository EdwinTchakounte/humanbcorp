"""Vues API du CMS.

- Endpoints **publics** (vitrine) : nav, page par slug (nested visible), réglages.
- **CRUD dashboard** (ViewSets) : pages, sections, cards, médias, réglages.
- **Contact** : POST → e-mail (réutilise la config SMTP du projet).
"""

import requests
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from calendarapp.models import Event, Meeting
from lessonapp.models import Theme, Session, Sequence, Categorie, Classe, Seance, Activity
from contents.models import Publication, Category, Tags, Space
from paiement.models import Paiement
from bucket.models import Inscription, Order
from chat.models import Project, ChatMessage
from .roles import is_admin, is_teacher, module_is_accessible, module_can_write, profile_payload, MODULES
from espaces.access import espaces_for, is_responsable, current_espace
from .serializers_modules import (
    EventSerializer,
    MeetingSerializer,
    ProfileTokenSerializer,
    ThemeSerializer,
    SeanceSerializer,
    ActivitySerializer,
    ActivityComponentSerializer,
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
        return module_can_write(request.user, module)


# ---------------------------------------------------------------------------
# Périmètre « formateur » (auteur limité) : un Teacher ne voit / n'édite que les
# formations (Theme) où il est affecté ; un admin voit tout.
# ---------------------------------------------------------------------------
def _espaces_filter(qs, user):
    """Restreint un queryset aux espaces de l'utilisateur (admin plateforme = tout).

    Pour la taxonomie partagée (sessions/séquences/catégories/classes) : chaque
    espace a la sienne, sans distinction responsable/formateur.
    """
    if is_admin(user):
        return qs
    espaces = espaces_for(user)
    if not espaces.exists():
        return qs.none()
    return qs.filter(espace__in=espaces)


def _scope_by_espace_role(qs, user):
    """Isolation multi-tenant + distinction responsable / formateur rattaché.

    S'applique à un queryset portant un champ `espace` et un M2M `instructors` :
    - un **responsable** d'espace voit tout le contenu de ses espaces ;
    - un **formateur** voit le contenu où il est instructeur — l'affectation
      comme instructeur vaut périmètre à elle seule (arête strictement plus
      étroite qu'un espace : il ne voit jamais le reste de l'espace), donc on ne
      le conditionne pas à un rattachement d'espace explicite ni à l'estampille
      `espace` du contenu. On ne prive jamais un formateur de ce qu'il anime.
    Le super-admin plateforme est traité en amont (il voit tout, hors espace).
    """
    espaces = espaces_for(user)
    resp_ids = [e.id for e in espaces if is_responsable(user, e)]
    conds = Q()
    if resp_ids:
        conds |= Q(espace_id__in=resp_ids)
    if is_teacher(user):
        conds |= Q(instructors=user)
    if not conds:
        return qs.none()
    return qs.filter(conds).distinct()


def themes_for(user):
    """Queryset des thèmes accessibles à ce profil.

    Admin plateforme → tout ; sinon isolation par espace, puis périmètre
    responsable (tout l'espace) ou formateur (ses formations) — cf.
    `_scope_by_espace_role`.
    """
    qs = Theme.objects.filter(is_deleted=False)
    if is_admin(user):
        return qs
    return _scope_by_espace_role(qs, user)


def can_edit_theme(user, theme):
    """Droit d'édition sur une formation (et son contenu) pour ce profil."""
    if theme is None:
        return False
    if is_admin(user):
        return True
    return is_teacher(user) and theme.instructors.filter(pk=user.pk).exists()


def _assert_theme_access(user, theme):
    """Lève 403 si le profil n'a pas le droit d'éditer le contenu de cette formation."""
    if not can_edit_theme(user, theme):
        raise PermissionDenied("Formation hors de votre périmètre.")


def publications_for(user):
    """Sessions (cohortes) **animées** par ce profil.

    À distinguer de `themes_for`, qui répond « quels programmes peut-il
    éditer ? ». Ici la question est « quelles cohortes anime-t-il ? » — c'est
    elle qui gouverne l'accès aux apprenants (suivi) et au calendrier : deux
    sessions d'une même formation peuvent avoir deux animateurs différents.
    """
    qs = Publication.objects.all()
    if is_admin(user):
        return qs
    return _scope_by_espace_role(qs, user)


def _assert_publication_access(user, publication):
    if publication is None:
        raise PermissionDenied("Session introuvable.")
    if is_admin(user):
        return
    if not publications_for(user).filter(pk=publication.pk).exists():
        raise PermissionDenied("Session hors de votre périmètre.")


def _next_order(model, **parent):
    """Rang à attribuer à un nouvel élément : à la suite de ses frères."""
    from django.db.models import Max

    last = model.objects.filter(is_deleted=False, **parent).aggregate(m=Max("order"))["m"]
    return (last or 0) + 1


def _learners_impacted(activities):
    """Nombre d'apprenants distincts ayant déjà travaillé sur ces activités."""
    from material.models import ActivityProgress, QuizAttempt

    ids = set(ActivityProgress.objects.filter(activity__in=activities).values_list("learner_id", flat=True))
    ids |= set(QuizAttempt.objects.filter(activity__in=activities).values_list("learner_id", flat=True))
    return len(ids)


def _protected_destroy(request, obj, activities, label):
    """Retire un élément du programme sans détruire le travail des apprenants.

    Le contenu est partagé entre toutes les cohortes d'une formation : une
    suppression frappe donc aussi les sessions passées, déjà payées. Et comme
    `QuizAttempt`/`ActivityProgress` pointent l'activité en CASCADE, une
    suppression sèche effacerait scores et progressions. On marque donc
    `is_deleted` (les lectures filtrent dessus) et on exige une confirmation
    explicite dès qu'un apprenant a déjà travaillé sur le contenu visé.
    """
    impacted = _learners_impacted(activities)
    if impacted and request.query_params.get("force") != "true":
        return Response(
            {
                "detail": f"{impacted} apprenant(s) ont déjà travaillé sur {label}. "
                          "Confirmez pour le retirer du programme (leurs scores sont conservés).",
                "learners_impacted": impacted,
                "requires_confirmation": True,
            },
            status=status.HTTP_409_CONFLICT,
        )
    obj.is_deleted = True
    obj.save(update_fields=["is_deleted"])
    return Response(status=status.HTTP_204_NO_CONTENT)


def _reorder_siblings(qs, pk, direction):
    """Échange le rang d'un élément avec celui de son voisin (`up` / `down`).

    Le swap se fait sur la fratrie **réellement triée** plutôt que sur `order ± 1`,
    ce qui reste correct même si les rangs comportent des trous (suppressions) ou
    des ex æquo hérités de données anciennes.
    """
    siblings = list(qs)
    idx = next((i for i, o in enumerate(siblings) if o.pk == pk), None)
    if idx is None:
        return False
    swap = idx - 1 if direction == "up" else idx + 1
    if swap < 0 or swap >= len(siblings):
        return False  # déjà en butée : rien à faire
    a, b = siblings[idx], siblings[swap]
    # Les rangs peuvent être égaux (données pré-migration) : on renumérote alors
    # la fratrie entière pour repartir sur une base saine.
    if a.order == b.order:
        for rank, obj in enumerate(siblings, start=1):
            type(obj).objects.filter(pk=obj.pk).update(order=rank)
        a.refresh_from_db(fields=["order"])
        b.refresh_from_db(fields=["order"])
    type(a).objects.filter(pk=a.pk).update(order=b.order)
    type(b).objects.filter(pk=b.pk).update(order=a.order)
    return True


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
def _audit_action(request, action, obj, details=None):
    """Trace une action sur le contenu/le back-office (défensif — ne casse rien)."""
    from apps_coop.audit.services import client_ip, record

    record(
        action=action, entite_type=type(obj).__name__, entite_id=getattr(obj, "pk", None),
        user=getattr(request, "user", None),
        details=details or {"repr": str(obj)[:120]},
        ip=client_ip(request), user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )


class _BaseCmsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffOrReadOnly]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    # Traçabilité du contenu du site : création / modification / suppression.
    def perform_create(self, serializer):
        obj = serializer.save()
        _audit_action(self.request, "cms.created", obj)

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit_action(self.request, "cms.updated", obj)

    def perform_destroy(self, instance):
        _audit_action(self.request, "cms.deleted", instance)
        instance.delete()


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
        # NB : filtrer par « page_id » et non « page » — « page » est le paramètre
        # réservé de la pagination DRF ; le réutiliser comme filtre provoquait une
        # 404 « Invalid page » dès que l'id de page dépassait le nb de pages paginées.
        page = self.request.query_params.get("page_id")
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
        _audit_action(request, "settings.updated", obj,
                      details={"champs": sorted(request.data.keys())})
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
        user = self.request.user
        if not is_admin(user):
            if is_teacher(user):
                # Le formateur voit ses propres créneaux + ceux des cohortes
                # qu'il ANIME (pas de toutes celles qui vendent son programme :
                # il n'a rien à faire dans le planning de la session d'un autre).
                qs = qs.filter(Q(user=user) | Q(publication__in=publications_for(user))).distinct()
            else:
                qs = qs.filter(user=user)
        return qs.order_by("-start_time")

    def _assert_event_theme_access(self, serializer):
        """La cohorte rattachée à un créneau doit être dans le périmètre de l'auteur.

        Sans ce contrôle, un formateur pourrait rattacher un créneau à la cohorte
        d'un confrère, puis lire via `/participants/` les nom+e-mail de ses
        apprenants (le créneau devient visible dans son agenda).
        """
        publication_id = serializer.validated_data.get("publication")
        if not publication_id:
            return
        _assert_publication_access(
            self.request.user, Publication.objects.filter(pk=publication_id).first()
        )

    def perform_create(self, serializer):
        self._assert_event_theme_access(serializer)
        serializer.save(user=serializer.validated_data.get("user") or self.request.user)

    def perform_update(self, serializer):
        self._assert_event_theme_access(serializer)
        serializer.save()

    @action(detail=True, methods=["get"], url_path="participants")
    def participants(self, request, pk=None):
        """Liste des apprenants inscrits (CONFIRMED) à la cohorte de ce créneau."""
        event = self.get_object()
        from bucket.models import Inscription

        pub = event.publication_set.first()
        if not pub:
            return Response([])
        seen, out = set(), []
        qs = (
            Inscription.objects.filter(
                publication=pub, status=Inscription.CONFIRMED, is_deleted=False
            )
            .select_related("participant")
            .order_by("participant__first_name")
        )
        for ins in qs:
            u = ins.participant
            if not u or u.id in seen:
                continue
            seen.add(u.id)
            out.append({
                "id": u.id,
                "name": u.get_full_name() or u.first_name or u.username,
                "email": u.email,
            })
        return Response(out)


class MeetingViewSet(_ModuleViewSet):
    module_key = "agenda"
    serializer_class = MeetingSerializer

    def get_queryset(self):
        qs = Meeting.objects.filter(is_deleted=False).select_related("event")
        user = self.request.user
        if not is_admin(user):
            if is_teacher(user):
                # Périmètre aligné sur EventViewSet : sans cette branche, le
                # formateur voit un créneau de sa cohorte mais pas les
                # rendez-vous (visio) qui y sont attachés par un admin.
                qs = qs.filter(
                    Q(event__user=user) | Q(event__publication__in=publications_for(user))
                ).distinct()
            else:
                qs = qs.filter(event__user=user)
        return qs.order_by("-created_at")


class ThemeViewSet(_ModuleViewSet):
    """Module Formations : les thèmes (Cours/Examen) = catalogue de formations."""

    module_key = "formations"
    serializer_class = ThemeSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = themes_for(self.request.user).select_related(
            "categorie", "sequence", "sequence__session"
        ).prefetch_related("classes", "instructors")
        session = self.request.query_params.get("session")
        if session:
            qs = qs.filter(sequence__session_id=session)
        categorie = self.request.query_params.get("categorie")
        if categorie:
            qs = qs.filter(categorie_id=categorie)
        return qs.order_by("-id")

    def perform_create(self, serializer):
        # L'affectation des formateurs (instructors) est réservée aux admins.
        if not is_admin(self.request.user):
            serializer.validated_data.pop("instructors", None)
        # Estampille l'espace (tenant) propriétaire de la formation.
        theme = serializer.save(espace=current_espace(self.request.user))
        # Un formateur qui crée une formation s'y affecte pour la retrouver dans son périmètre.
        if is_teacher(self.request.user) and not is_admin(self.request.user):
            theme.instructors.add(self.request.user)

    def perform_update(self, serializer):
        # Un formateur ne peut pas réaffecter/retirer les formateurs de sa formation.
        if not is_admin(self.request.user):
            serializer.validated_data.pop("instructors", None)
        serializer.save()

    @action(detail=True, methods=["get"], url_path="apercu")
    def apercu(self, request, pk=None):
        """GET /modules/themes/<id>/apercu/ → le contenu tel que l'apprenant le verra.

        On appelle **le même constructeur** que l'espace apprenant
        (`build_theme_content`) : un aperçu qui reconstruirait l'arbre de son
        côté finirait par diverger du rendu réel, et ne servirait plus à rien.

        Différence unique : les bonnes réponses du quiz sont marquées, pour que
        l'auteur puisse vérifier son corrigé. L'accès est déjà restreint à son
        périmètre (`get_queryset` → `themes_for`).
        """
        from .learner import build_theme_content

        theme = self.get_object()
        return Response({
            "theme": build_theme_content(theme, request, user=None, reveal_answers=True),
            "titre": theme.title,
        })


# --- Hiérarchie des formations : axes de classement (CRUD léger) ----------
class _HierarchyViewSet(_ModuleViewSet):
    """Base commune Session/Séquence/Catégorie/Classe (taxonomie PARTAGÉE).

    Création autorisée à tout profil ayant le module (dont les formateurs, pour
    l'ajout inline). En revanche l'édition/suppression est réservée aux **admins** :
    ces objets sont partagés entre formations, et un `delete` cascaderait sur les
    Themes d'autres formateurs (Theme.sequence/categorie = CASCADE).
    """

    module_key = "formations"

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            espace=current_espace(self.request.user),
        )

    def _admin_only(self):
        if not is_admin(self.request.user):
            raise PermissionDenied("Édition/suppression réservée aux administrateurs (élément partagé).")

    def update(self, request, *args, **kwargs):
        self._admin_only()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._admin_only()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._admin_only()
        return super().destroy(request, *args, **kwargs)


class SessionViewSet(_HierarchyViewSet):
    serializer_class = SessionMiniSerializer

    def get_queryset(self):
        qs = _espaces_filter(Session.objects.filter(is_deleted=False), self.request.user)
        return qs.order_by("-year", "-id")


class SequenceViewSet(_HierarchyViewSet):
    serializer_class = SequenceMiniSerializer

    def get_queryset(self):
        qs = _espaces_filter(
            Sequence.objects.filter(is_deleted=False).select_related("session"),
            self.request.user,
        )
        session = self.request.query_params.get("session")
        if session:
            qs = qs.filter(session_id=session)
        return qs.order_by("session_id", "numero")


class FormationCategorieViewSet(_HierarchyViewSet):
    """Catégorie pédagogique (lessonapp.Categorie) rattachée aux thèmes."""

    serializer_class = CategorieMiniSerializer

    def get_queryset(self):
        qs = _espaces_filter(Categorie.objects.filter(is_deleted=False), self.request.user)
        return qs.order_by("name")


class ClasseViewSet(_HierarchyViewSet):
    serializer_class = ClasseMiniSerializer

    def get_queryset(self):
        qs = _espaces_filter(Classe.objects.filter(is_deleted=False), self.request.user)
        return qs.order_by("name")


class SeanceViewSet(_ModuleViewSet):
    """Module Formations : séances d'un thème (authoring). Filtre `?theme=`."""

    module_key = "formations"
    serializer_class = SeanceSerializer

    def get_queryset(self):
        qs = Seance.objects.filter(is_deleted=False, theme__in=themes_for(self.request.user))
        theme = self.request.query_params.get("theme")
        if theme:
            qs = qs.filter(theme_id=theme)
        return qs  # tri par Seance.Meta.ordering = ["order", "id"]

    def perform_create(self, serializer):
        theme = serializer.validated_data.get("theme")
        _assert_theme_access(self.request.user, theme)
        serializer.save(order=_next_order(Seance, theme=theme))

    def perform_update(self, serializer):
        theme = serializer.validated_data.get("theme") or serializer.instance.theme
        _assert_theme_access(self.request.user, theme)
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        seance = self.get_object()
        _assert_theme_access(request.user, seance.theme)
        return _protected_destroy(
            request, seance,
            Activity.objects.filter(seance=seance),
            f"la séance « {seance.title} »",
        )

    @action(detail=True, methods=["post"], url_path="reorder")
    def reorder(self, request, pk=None):
        """POST /modules/seances/<id>/reorder/ {"direction": "up"|"down"}."""
        seance = self.get_object()  # get_queryset() ⇒ périmètre déjà appliqué
        _assert_theme_access(request.user, seance.theme)
        moved = _reorder_siblings(
            Seance.objects.filter(is_deleted=False, theme=seance.theme),
            seance.pk,
            request.data.get("direction"),
        )
        return Response({"moved": moved})


class ActivityViewSet(_ModuleViewSet):
    """Module Formations : activités d'une séance (authoring). Filtre `?seance=`."""

    module_key = "formations"
    serializer_class = ActivitySerializer

    def get_queryset(self):
        qs = Activity.objects.filter(
            is_deleted=False, seance__theme__in=themes_for(self.request.user)
        )
        seance = self.request.query_params.get("seance")
        if seance:
            qs = qs.filter(seance_id=seance)
        return qs  # tri par Activity.Meta.ordering = ["order", "id"]

    def perform_create(self, serializer):
        seance = serializer.validated_data.get("seance")
        _assert_theme_access(self.request.user, getattr(seance, "theme", None))
        self._create_with_bloc(serializer)

    def perform_update(self, serializer):
        seance = serializer.validated_data.get("seance") or serializer.instance.seance
        _assert_theme_access(self.request.user, getattr(seance, "theme", None))
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        activity = self.get_object()
        _assert_theme_access(request.user, getattr(activity.seance, "theme", None))
        return _protected_destroy(
            request, activity,
            Activity.objects.filter(pk=activity.pk),
            f"l'activité « {activity.title} »",
        )

    @action(detail=True, methods=["post"], url_path="reorder")
    def reorder(self, request, pk=None):
        """POST /modules/activities/<id>/reorder/ {"direction": "up"|"down"}."""
        activity = self.get_object()
        _assert_theme_access(request.user, getattr(activity.seance, "theme", None))
        moved = _reorder_siblings(
            Activity.objects.filter(is_deleted=False, seance=activity.seance),
            activity.pk,
            request.data.get("direction"),
        )
        return Response({"moved": moved})

    def _create_with_bloc(self, serializer):
        # Le modèle Activity exige un Bloc ; on en crée un discret par activité
        # pour masquer cette complexité héritée à l'éditeur.
        from lessonapp.models.bloc import Bloc

        bloc = Bloc.objects.create(
            title=serializer.validated_data.get("title", "Activité"),
            created_by=self.request.user,
            categorie=Bloc.ACTIVITY,
        )
        serializer.save(
            bloc=bloc,
            order=_next_order(Activity, seance=serializer.validated_data.get("seance")),
        )


class ActivityComponentViewSet(_ModuleViewSet):
    """Module Formations : blocs de contenu (texte + vidéo + image) d'une activité. Filtre `?activity=`."""

    module_key = "formations"
    serializer_class = ActivityComponentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        from material.models import ActivityComponent

        qs = ActivityComponent.objects.filter(
            activity__seance__theme__in=themes_for(self.request.user)
        )
        activity = self.request.query_params.get("activity")
        if activity:
            qs = qs.filter(activity_id=activity)
        return qs.order_by("number", "id")

    def perform_create(self, serializer):
        from material.models import ActivityComponent

        activity = serializer.validated_data.get("activity")
        _assert_theme_access(self.request.user, getattr(getattr(activity, "seance", None), "theme", None))
        n = ActivityComponent.objects.filter(activity=activity).count() + 1
        serializer.save(number=n)


class ActivityDocViewSet(viewsets.ViewSet):
    """Documents (liens) d'une activité. Crée un Link + MaterialActivityDoc.

    Upload de fichier non géré ici (passe par l'admin) — on référence une URL.
    """

    permission_classes = [HasModuleAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    module_key = "formations"

    def list(self, request):
        from material.models import MaterialActivityDoc

        qs = MaterialActivityDoc.objects.filter(activity__seance__theme__in=themes_for(request.user))
        activity = request.query_params.get("activity")
        if activity:
            qs = qs.filter(activity_id=activity)
        out = []
        for d in qs:
            try:
                url = d.doc_link()
            except Exception:  # noqa: BLE001
                url = None
            if url and url.startswith("/"):
                url = request.build_absolute_uri(url)
            out.append({
                "id": d.id, "title": d.title, "url": url, "m_type": d.m_type,
                "activity": d.activity_id, "mime_type": getattr(d.document, "mime_type", "") or "",
            })
        return Response(out)

    def create(self, request):
        """Document par **fichier uploadé** (`file`) ou par **lien** (`url`)."""
        from lessonapp.models import Activity
        from material.models import File, Link, MaterialActivityDoc

        activity_id = request.data.get("activity")
        url = (request.data.get("url") or "").strip()
        title = (request.data.get("title") or "").strip()
        upload = request.FILES.get("file")
        if not activity_id or (not url and not upload):
            return Response({"detail": "activity et (url ou file) requis."}, status=status.HTTP_400_BAD_REQUEST)
        activity = Activity.objects.filter(pk=activity_id).first()
        if activity is None:
            return Response({"detail": "Activité introuvable."}, status=status.HTTP_404_NOT_FOUND)
        _assert_theme_access(request.user, getattr(getattr(activity, "seance", None), "theme", None))
        try:
            m_type = int(request.data.get("m_type", 1) or 1)
        except (TypeError, ValueError):
            m_type = 1

        if upload:
            document = File.objects.create(
                title=title or upload.name,
                document=upload,
                mime_type=getattr(upload, "content_type", "") or "",
                hash_value="",
                filename=upload.name,
                size=upload.size,
            )
            rel_url = document.document.url
        else:
            document = Link.objects.create(title=title or url, url=url)
            rel_url = document.url

        doc = MaterialActivityDoc.objects.create(
            title=title or (upload.name if upload else "Document"),
            description=request.data.get("description", "") or "",
            document=document,
            m_type=m_type,
            owner=request.user,
            activity=activity,
        )
        abs_url = request.build_absolute_uri(rel_url) if rel_url.startswith("/") else rel_url
        return Response(
            {"id": doc.id, "title": doc.title, "url": abs_url, "m_type": doc.m_type, "activity": activity.id},
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, pk=None):
        from material.models import MaterialActivityDoc

        d = MaterialActivityDoc.objects.filter(pk=pk).first()
        if d is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        _assert_theme_access(request.user, getattr(getattr(d.activity, "seance", None), "theme", None))
        doc = d.document
        d.delete()
        if doc:
            try:
                doc.delete()
            except Exception:  # noqa: BLE001
                pass
        return Response(status=status.HTTP_204_NO_CONTENT)


def _quiz_question_payload(question, aq):
    """Sérialise une question de quiz + ses options (pour l'authoring)."""
    from material.models import InputQuestionBox

    options = list(InputQuestionBox.objects.filter(question=question).order_by("id"))
    input_type = options[0].input_type if options else 2
    return {
        "id": question.id,
        "title": question.title,
        "description": question.description,
        "points": aq.points if aq else 1,
        "number": aq.number if aq else 0,
        "input_type": input_type,  # 1=checkbox 2=radio
        "options": [{"id": o.id, "title": o.title, "is_answer": o.is_answer} for o in options],
    }


class QuizQuestionViewSet(viewsets.ViewSet):
    """Authoring des questions d'un quiz (Bloc + Question + Activityquestion + options).

    list ?activity= ; create/update/destroy exposent une question « à plat »
    (titre, description, points, input_type, options[{title,is_answer}]).
    """

    permission_classes = [HasModuleAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    module_key = "formations"

    def _question_theme(self, question):
        from lessonapp.models import Activityquestion

        aq = Activityquestion.objects.filter(question=question).select_related("activity__seance__theme").first()
        return getattr(getattr(getattr(aq, "activity", None), "seance", None), "theme", None) if aq else None

    def list(self, request):
        from lessonapp.models import Activity, Activityquestion

        activity = request.query_params.get("activity")
        if not activity:
            return Response([])
        act = Activity.objects.filter(pk=activity).first()
        if act is None or not can_edit_theme(request.user, getattr(getattr(act, "seance", None), "theme", None)):
            return Response([])
        aqs = (
            Activityquestion.objects.filter(activity_id=activity)
            .select_related("question")
            .order_by("number", "id")
        )
        return Response([_quiz_question_payload(aq.question, aq) for aq in aqs])

    def _write_options(self, question, input_type, options):
        from material.models import InputQuestionBox

        InputQuestionBox.objects.filter(question=question).delete()
        for o in options or []:
            title = (o.get("title") or "").strip()
            if not title:
                continue
            InputQuestionBox.objects.create(
                title=title, is_answer=bool(o.get("is_answer")), input_type=input_type, question=question
            )

    def _persist_question(self, activity, data, user):
        """Crée Bloc + Question + Activityquestion + options depuis un dict à plat."""
        from lessonapp.models import Question, Activityquestion
        from lessonapp.models.bloc import Bloc

        title = (data.get("title") or "").strip()
        bloc = Bloc.objects.create(title=title[:400], created_by=user, categorie=Bloc.QUESTION)
        q = Question.objects.create(title=title, description=(data.get("description") or ""), bloc=bloc)
        n = Activityquestion.objects.filter(activity=activity).count() + 1
        try:
            points = int(data.get("points", 1) or 1)
        except (TypeError, ValueError):
            points = 1
        aq = Activityquestion.objects.create(activity=activity, question=q, points=points, number=n)
        try:
            input_type = int(data.get("input_type", 2) or 2)
        except (TypeError, ValueError):
            input_type = 2
        self._write_options(q, input_type, data.get("options"))
        return q, aq

    def create(self, request):
        from lessonapp.models import Activity

        d = request.data
        activity = Activity.objects.filter(pk=d.get("activity")).first()
        if activity is None:
            return Response({"detail": "Activité introuvable."}, status=status.HTTP_404_NOT_FOUND)
        _assert_theme_access(request.user, getattr(getattr(activity, "seance", None), "theme", None))
        if not (d.get("title") or "").strip():
            return Response({"detail": "Intitulé de la question requis."}, status=status.HTTP_400_BAD_REQUEST)
        q, aq = self._persist_question(activity, d, request.user)
        return Response(_quiz_question_payload(q, aq), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="template")
    def template(self, request):
        """GET .../quiz-questions/template/?fmt=csv|xlsx → gabarit d'import prérempli."""
        from django.http import HttpResponse
        from .quiz_import import build_template

        fmt = "xlsx" if request.query_params.get("fmt") == "xlsx" else "csv"
        data, ctype, fname = build_template(fmt)
        resp = HttpResponse(data, content_type=ctype)
        resp["Content-Disposition"] = f'attachment; filename="{fname}"'
        return resp

    @action(detail=False, methods=["post"], url_path="import")
    def import_file(self, request):
        """POST .../quiz-questions/import/ (multipart: activity, file) → import en masse.

        Formats : CSV, Excel (.xlsx), JSON. Renvoie le nombre importé + les erreurs par ligne.
        """
        from lessonapp.models import Activity
        from .quiz_import import parse_quiz_file

        activity = Activity.objects.filter(pk=request.data.get("activity")).first()
        if activity is None:
            return Response({"detail": "Activité introuvable."}, status=status.HTTP_404_NOT_FOUND)
        _assert_theme_access(request.user, getattr(getattr(activity, "seance", None), "theme", None))
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "Fichier requis (champ « file »)."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            questions, errors = parse_quiz_file(upload.name, upload.read())
        except Exception as exc:  # noqa: BLE001 — fichier corrompu / format inattendu
            return Response({"detail": f"Fichier illisible : {exc}"}, status=status.HTTP_400_BAD_REQUEST)
        created = [
            _quiz_question_payload(*self._persist_question(activity, q, request.user))
            for q in questions
        ]
        return Response(
            {"imported": len(created), "errors": errors, "questions": created},
            status=status.HTTP_201_CREATED,
        )

    def _update(self, request, pk):
        from lessonapp.models import Question, Activityquestion

        q = Question.objects.filter(pk=pk).first()
        if q is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        _assert_theme_access(request.user, self._question_theme(q))
        d = request.data
        if "title" in d:
            q.title = (d.get("title") or "").strip() or q.title
        if "description" in d:
            q.description = d.get("description") or ""
        q.save()
        aq = Activityquestion.objects.filter(question=q).first()
        if aq and "points" in d:
            try:
                aq.points = int(d.get("points") or 1)
                aq.save(update_fields=["points"])
            except (TypeError, ValueError):
                pass
        if "options" in d:
            input_type = int(d.get("input_type", 2) or 2)
            self._write_options(q, input_type, d.get("options"))
        return Response(_quiz_question_payload(q, aq))

    def update(self, request, pk=None):
        return self._update(request, pk)

    def partial_update(self, request, pk=None):
        return self._update(request, pk)

    def destroy(self, request, pk=None):
        from lessonapp.models import Question

        q = Question.objects.filter(pk=pk).first()
        if q is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        _assert_theme_access(request.user, self._question_theme(q))
        bloc = q.bloc
        q.delete()  # cascade Activityquestion + InputQuestionBox
        if bloc:
            try:
                bloc.delete()
            except Exception:  # noqa: BLE001
                pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class FormationsOverviewView(APIView):
    """GET /modules/formations/overview/ → compteurs + listes pour filtres."""

    permission_classes = [HasModuleAccess]
    module_key = "formations"

    def get(self, request):
        ctx = {"request": request}
        # Le compteur de formations respecte le périmètre (un formateur ne voit
        # que les siennes) — cohérent avec la liste filtrée en dessous. La
        # taxonomie (sessions/séquences/catégories/classes) est cloisonnée par
        # espace comme le reste du contenu.
        sessions = _espaces_filter(Session.objects.filter(is_deleted=False), request.user)
        sequences = _espaces_filter(Sequence.objects.filter(is_deleted=False), request.user)
        categories = _espaces_filter(Categorie.objects.filter(is_deleted=False), request.user)
        classes = _espaces_filter(Classe.objects.filter(is_deleted=False), request.user)
        return Response({
            "counts": {
                "themes": themes_for(request.user).count(),
                "sessions": sessions.count(),
                "sequences": sequences.count(),
                "classes": classes.count(),
                "categories": categories.count(),
            },
            "sessions": SessionMiniSerializer(sessions.order_by("-year"), many=True, context=ctx).data,
            "sequences": SequenceMiniSerializer(sequences, many=True, context=ctx).data,
            "categories": CategorieMiniSerializer(categories, many=True, context=ctx).data,
            "classes": ClasseMiniSerializer(classes, many=True, context=ctx).data,
        })


class TeachersListView(APIView):
    """GET /modules/formations/teachers/ → formateurs (groupe Teacher) pour l'affectation."""

    permission_classes = [HasModuleAccess]
    module_key = "formations"

    def get(self, request):
        from django.contrib.auth.models import User

        # L'affectation des formateurs est un acte d'admin → liste réservée aux admins.
        if not is_admin(request.user):
            raise PermissionDenied("Réservé aux administrateurs.")
        users = (
            User.objects.filter(groups__name__iexact="Teacher")
            .distinct()
            .order_by("first_name", "username")
        )
        return Response([
            {"id": u.id, "name": (u.get_full_name() or u.username), "email": u.email}
            for u in users
        ])


class SuiviView(APIView):
    """GET /modules/suivi/ → progression + scores quiz des apprenants, par session.

    Le suivi est groupé par **cohorte**, pas par programme : une formation
    vendue en mars et en juin a deux groupes d'apprenants distincts, et deux
    animateurs potentiellement différents. Grouper par programme les aurait
    mélangés et aurait montré à chaque formateur les apprenants de l'autre.

    Admin : toutes les sessions. Formateur : les sessions qu'il anime.
    Filtre optionnel `?publication=<id>`.
    """

    permission_classes = [HasModuleAccess]
    module_key = "suivi"

    def get(self, request):
        from lessonapp.models import Activity
        from material.models import ActivityProgress, QuizAttempt

        publications = (
            publications_for(request.user).prefetch_related("themes").order_by("-id")
        )
        pub_filter = request.query_params.get("publication")
        if pub_filter:
            publications = publications.filter(pk=pub_filter)

        formations = []
        for pub in publications:
            themes = pub.themes.filter(is_deleted=False)
            activities = list(
                Activity.objects.filter(
                    seance__theme__in=themes, seance__is_deleted=False, is_deleted=False
                )
            )
            act_ids = [a.id for a in activities]
            quiz_ids = [a.id for a in activities if a.a_type == Activity.QUIZZ]
            act_titles = {a.id: a.title for a in activities}
            total = len(activities)

            # Apprenants confirmés sur CETTE session.
            learners = {}
            for ins in Inscription.objects.filter(
                publication=pub, status=Inscription.CONFIRMED, is_deleted=False
            ).select_related("participant"):
                u = ins.participant
                if u and u.id not in learners:
                    learners[u.id] = u
            lids = list(learners.keys())

            # Activités terminées par apprenant (1 requête).
            done_counts = {}
            if lids and act_ids:
                for lid, _aid in ActivityProgress.objects.filter(
                    learner_id__in=lids, activity_id__in=act_ids, completed=True
                ).values_list("learner_id", "activity_id"):
                    done_counts[lid] = done_counts.get(lid, 0) + 1

            # Dernière tentative de quiz par (apprenant, activité) — ordering -created_at.
            latest = {}
            if lids and quiz_ids:
                for att in QuizAttempt.objects.filter(
                    learner_id__in=lids, activity_id__in=quiz_ids
                ).order_by("activity_id", "-created_at"):
                    key = (att.learner_id, att.activity_id)
                    latest.setdefault(key, att)

            rows = []
            for lid, u in learners.items():
                done = done_counts.get(lid, 0)
                quizzes = []
                for qid in quiz_ids:
                    att = latest.get((lid, qid))
                    if att:
                        quizzes.append({
                            "activity_id": qid,
                            "title": act_titles.get(qid, "Quiz"),
                            "score": att.score,
                            "max_score": att.max_score,
                            "percent": round(100 * att.score / att.max_score) if att.max_score else 0,
                        })
                rows.append({
                    "id": u.id,
                    "name": u.get_full_name() or u.first_name or u.username,
                    "email": u.email,
                    "progress": {
                        "done": done, "total": total,
                        "percent": round(100 * done / total) if total else 0,
                    },
                    "quizzes": quizzes,
                })
            rows.sort(key=lambda r: (r["name"] or "").lower())
            formations.append({
                "id": pub.id,
                "title": pub.title,
                "mode": pub.mode,
                "date_debut": pub.date_debut,
                "date_fin": pub.date_fin,
                # Le programme derrière la session, pour situer le contenu suivi.
                "programmes": [t.title for t in themes],
                "activities_total": total,
                "quiz_count": len(quiz_ids),
                "learners_count": len(rows),
                "learners": rows,
            })
        return Response({"formations": formations})


class PublicationViewSet(_ModuleViewSet):
    """Module Publications : contenus (contents.Publication)."""

    module_key = "publications"
    serializer_class = PublicationSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = _espaces_filter(
            Publication.objects.select_related("categorie").prefetch_related("liste_tags", "themes"),
            self.request.user,
        )
        categorie = self.request.query_params.get("categorie")
        if categorie:
            qs = qs.filter(categorie_id=categorie)
        visibility = self.request.query_params.get("visibility")
        if visibility == "public":
            qs = qs.filter(is_private=False)
        elif visibility == "private":
            qs = qs.filter(is_private=True)
        return qs.order_by("-date", "-id")

    def perform_create(self, serializer):
        serializer.save(espace=current_espace(self.request.user))


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

    def _envoyer_lien(self, inscription):
        """Envoie à l'apprenant le lien de son espace (best-effort, ne lève jamais).

        Sans cet envoi, une inscription créée à la main serait inutilisable : le
        lien magique ne partait jusqu'ici que par l'événement « paiement reçu »,
        donc uniquement au bout d'un paiement.
        """
        from .learner import notifier_acces_apprenant

        return notifier_acces_apprenant(inscription)

    @action(detail=False, methods=["post"], url_path="inscrire")
    def inscrire(self, request):
        """Inscrit un apprenant à la main : place offerte, cohorte interne, correction.

        Le parcours normal passe par une commande et un paiement. Il n'existait
        aucune porte de sortie pour une inscription hors vente — le back-office
        était en lecture seule, et le Django admin, lui, n'envoie pas le lien.
        """
        if not is_admin(request.user):
            raise PermissionDenied("Réservé aux administrateurs.")

        d = request.data
        email = (d.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return Response({"detail": "Email valide requis."}, status=status.HTTP_400_BAD_REQUEST)
        pub = Publication.objects.filter(pk=d.get("publication")).first()
        if pub is None:
            return Response({"detail": "Session introuvable."}, status=status.HTTP_404_NOT_FOUND)

        from django.db import transaction

        from .public_catalog import _guest_user

        with transaction.atomic():
            # Verrou : deux ajouts simultanés ne doivent pas prendre la même place.
            pub = Publication.objects.select_for_update().get(pk=pub.pk)
            user = _guest_user(
                email=email,
                first_name=(d.get("first_name") or "").strip(),
                last_name=(d.get("last_name") or "").strip(),
            )
            existante = (
                Inscription.objects.filter(participant=user, publication=pub, is_deleted=False)
                .exclude(status=Inscription.CANCEL)
                .first()
            )
            if existante and existante.status == Inscription.CONFIRMED:
                return Response(
                    {"detail": "Cet apprenant est déjà inscrit à cette session.",
                     "inscription_id": existante.pk},
                    status=status.HTTP_409_CONFLICT,
                )
            if existante:
                # Paiement abandonné : on confirme l'inscription en attente plutôt
                # que d'en créer une seconde. La capacité n'est PAS revérifiée ici —
                # cette personne occupe déjà une place (places_restantes compte les
                # inscriptions en attente), la confirmer n'en consomme aucune autre.
                existante.status = Inscription.CONFIRMED
                existante.save(update_fields=["status"])
                inscription = existante
            else:
                # Nouvelle place : là, et seulement là, la capacité s'applique.
                # Plutôt qu'un contournement silencieux, la décision revient à
                # l'admin — augmenter la capacité est explicite et traçable.
                if pub.est_complete():
                    return Response(
                        {"detail": "Session complète. Augmentez la capacité pour ajouter une place.",
                         "complete": True},
                        status=status.HTTP_409_CONFLICT,
                    )
                inscription = Inscription.objects.create(
                    participant=user, publication=pub, status=Inscription.CONFIRMED
                )

        envoye = self._envoyer_lien(inscription)
        return Response(
            {
                "id": inscription.pk,
                "participant_name": user.get_full_name() or user.username,
                "publication_title": pub.title,
                "lien_envoye": envoye,
                "detail": "Apprenant inscrit. Le lien d'accès lui a été envoyé."
                if envoye else "Apprenant inscrit, mais l'envoi du lien a échoué.",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="renvoyer-lien")
    def renvoyer_lien(self, request, pk=None):
        """Renvoie le lien d'accès (e-mail perdu, adresse corrigée)."""
        if not is_admin(request.user):
            raise PermissionDenied("Réservé aux administrateurs.")
        inscription = self.get_object()
        if inscription.status != Inscription.CONFIRMED:
            return Response(
                {"detail": "Seule une inscription confirmée donne accès à un espace."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        envoye = self._envoyer_lien(inscription)
        return Response({"lien_envoye": envoye,
                         "detail": "Lien renvoyé." if envoye else "L'envoi a échoué."})


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
            payment.save(update_fields=["reference_externe", "gateway_initiated_at", "payer_phone", "updated_at"])
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


class EspacesCAView(APIView):
    """GET /modules/espaces/ca/ → suivi des souscriptions + chiffre d'affaires par espace.

    L'encaissement reste centralisé (portefeuille super-admin, un seul compte
    Tara), mais chaque école a son propre suivi : nombre de souscriptions par
    statut, apprenants distincts, et CA encaissé. L'attribution se fait au grain
    de la souscription (`Inscription.espace`), figé à la souscription — un panier
    mixte est ainsi ventilé correctement entre écoles.

    Périmètre : super-admin plateforme → tous les espaces ; sinon uniquement les
    espaces dont l'utilisateur est **responsable** (un formateur rattaché ne pilote
    pas le CA de l'école). Le CA encaissé = somme des prix des publications des
    souscriptions **confirmées** (order réglé) rattachées à l'espace.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Sum

        user = request.user
        espaces = espaces_for(user)
        if not is_admin(user):
            # Un responsable pilote le CA ; les autres rôles n'y ont pas accès.
            espaces = [e for e in espaces if is_responsable(user, e)]
        espaces = list(espaces)
        by_id = {e.id: e for e in espaces}

        rows = (
            Inscription.objects.filter(is_deleted=False, espace_id__in=by_id.keys())
            .values("espace")
            .annotate(
                total=Count("id"),
                confirmed=Count("id", filter=Q(status=Inscription.CONFIRMED)),
                waiting=Count("id", filter=Q(status=Inscription.WAITING)),
                cancel=Count("id", filter=Q(status=Inscription.CANCEL)),
                apprenants=Count("participant", distinct=True),
            )
        )
        agg = {r["espace"]: r for r in rows}

        # CA « réellement encaissé » : montant FIGÉ de la souscription (immunise
        # contre un changement de prix ultérieur), et UNIQUEMENT les inscriptions
        # confirmées rattachées à une commande RÉGLÉE (TOTAL_PAID). Les places
        # offertes (confirmées sans paiement) sont donc naturellement exclues.
        from bucket.models import Order, OrderInscription

        ca_rows = (
            OrderInscription.objects.filter(
                order__status=Order.TOTAL_PAID,
                inscription__status=Inscription.CONFIRMED,
                inscription__is_deleted=False,
                inscription__espace_id__in=by_id.keys(),
            )
            .values("inscription__espace")
            .annotate(ca=Sum("inscription__montant"))
        )
        ca_by_espace = {r["inscription__espace"]: r["ca"] for r in ca_rows}

        def _f(v):
            try:
                return round(float(v), 2)
            except (TypeError, ValueError):
                return 0.0

        items = []
        total_ca = 0.0
        total_souscriptions = 0
        for e in espaces:
            r = agg.get(e.id, {})
            ca = _f(ca_by_espace.get(e.id, 0))
            total_ca += ca
            total_souscriptions += r.get("total", 0)
            items.append({
                "id": e.id,
                "nom": e.nom,
                "slug": e.slug,
                "est_actif": e.est_actif(),
                "est_expire": e.est_expire,
                "date_fin": e.date_fin,
                "souscriptions": {
                    "total": r.get("total", 0),
                    "confirmed": r.get("confirmed", 0),
                    "waiting": r.get("waiting", 0),
                    "cancel": r.get("cancel", 0),
                },
                "apprenants": r.get("apprenants", 0),
                "ca_encaisse": ca,
            })

        return Response({
            "espaces": items,
            "totaux": {
                "ca_encaisse": round(total_ca, 2),
                "souscriptions": total_souscriptions,
                "espaces": len(items),
            },
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
