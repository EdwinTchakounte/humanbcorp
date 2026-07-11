"""Routes de l'API CMS, montées sous /api/v1/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import public_catalog
from . import learner
from .api import (
    ArticleDetailView,
    ArticleListView,
    ArticleViewSet,
    CardViewSet,
    ChatMessageViewSet,
    ChatProjectViewSet,
    ChatView,
    ContactView,
    EventViewSet,
    FormationsOverviewView,
    InscriptionViewSet,
    InscriptionsOverviewView,
    MediaAssetViewSet,
    MeetingViewSet,
    MessagerieOverviewView,
    MeView,
    NavView,
    PageContentView,
    PageViewSet,
    OrderViewSet,
    PaiementViewSet,
    PaiementsOverviewView,
    ProfileTokenView,
    PublicationViewSet,
    PublicationsOverviewView,
    SectionViewSet,
    SiteSettingsPublicView,
    SiteSettingsViewSet,
    ThemeViewSet,
)

router = DefaultRouter()
router.register("cms/pages", PageViewSet, basename="cms-pages")
router.register("cms/sections", SectionViewSet, basename="cms-sections")
router.register("cms/cards", CardViewSet, basename="cms-cards")
router.register("cms/media", MediaAssetViewSet, basename="cms-media")
router.register("cms/articles", ArticleViewSet, basename="cms-articles")
router.register("cms/settings", SiteSettingsViewSet, basename="cms-settings")

# Modules rapatriés (gated par profil)
router.register("modules/events", EventViewSet, basename="mod-events")
router.register("modules/meetings", MeetingViewSet, basename="mod-meetings")
router.register("modules/themes", ThemeViewSet, basename="mod-themes")
router.register("modules/publications", PublicationViewSet, basename="mod-publications")
router.register("modules/paiements", PaiementViewSet, basename="mod-paiements")
router.register("modules/inscriptions", InscriptionViewSet, basename="mod-inscriptions")
router.register("modules/orders", OrderViewSet, basename="mod-orders")
router.register("modules/projects", ChatProjectViewSet, basename="mod-projects")
router.register("modules/messages", ChatMessageViewSet, basename="mod-messages")

urlpatterns = [
    # Auth JWT (dashboard) — token enrichi du profil + /me
    path("auth/token/", ProfileTokenView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("modules/formations/overview/", FormationsOverviewView.as_view(), name="mod-formations-overview"),
    path("modules/publications/overview/", PublicationsOverviewView.as_view(), name="mod-publications-overview"),
    path("modules/paiements/overview/", PaiementsOverviewView.as_view(), name="mod-paiements-overview"),
    path("modules/inscriptions/overview/", InscriptionsOverviewView.as_view(), name="mod-inscriptions-overview"),
    path("modules/messagerie/overview/", MessagerieOverviewView.as_view(), name="mod-messagerie-overview"),

    # Public (vitrine)
    path("site/nav/", NavView.as_view(), name="site-nav"),
    path("site/settings/", SiteSettingsPublicView.as_view(), name="site-settings"),
    path("site/pages/<slug:slug>/", PageContentView.as_view(), name="site-page"),
    path("site/articles/", ArticleListView.as_view(), name="site-articles"),
    path("site/articles/<slug:slug>/", ArticleDetailView.as_view(), name="site-article"),
    # Catalogue + inscription/paiement publics (visiteur non connecté)
    path("site/formations/", public_catalog.formations_list, name="site-formations"),
    path("site/formations/<int:pk>/", public_catalog.formation_detail, name="site-formation"),
    path("site/inscription/", public_catalog.inscription_create, name="site-inscription"),
    path("site/inscription/<str:token>/", public_catalog.inscription_status, name="site-inscription-status"),
    path("site/inscription/<str:token>/payer/", public_catalog.inscription_pay, name="site-inscription-pay"),
    path("site/documents/", public_catalog.documents_list, name="site-documents"),
    # Espace apprenant (accès par lien magique signé)
    path("site/mon-espace/<str:token>/", learner.my_space, name="site-mon-espace"),
    path("site/mon-espace/<str:token>/formation/<int:publication_id>/", learner.my_formation, name="site-mon-espace-formation"),
    path("site/mon-espace/<str:token>/quiz/<int:activity_id>/", learner.submit_quiz, name="site-mon-espace-quiz"),
    path("contact/", ContactView.as_view(), name="contact"),
    path("chat/", ChatView.as_view(), name="chat"),

    # CRUD dashboard
    path("", include(router.urls)),
]
