"""Routes du recrutement, montées sous /api/v1/.

Deux faces : public (visiteur, `public.py`) et gestion RH réservée au super-admin
plateforme (`admin_api.py`, préfixe `rh/`, aucun rattachement à un espace).
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import admin_api, public, recruiter_api

router = DefaultRouter()
# Gestion RH (super-admin plateforme)
router.register("rh/offres", admin_api.JobOfferAdminViewSet, basename="rh-offres")
router.register("rh/candidatures", admin_api.ApplicationAdminViewSet, basename="rh-candidatures")
router.register("rh/overview", admin_api.RecruitmentOverviewView, basename="rh-overview")
router.register("rh/recruteurs", admin_api.RecruiterAccountsView, basename="rh-recruteurs")
# Espace recruteur (lecture seule, cloisonné par owner)
router.register("rh/espace/offres", recruiter_api.RecruiterOfferViewSet, basename="rh-espace-offres")
router.register("rh/espace/candidatures", recruiter_api.RecruiterApplicationViewSet, basename="rh-espace-candidatures")
router.register("rh/espace/overview", recruiter_api.RecruiterOverviewView, basename="rh-espace-overview")

urlpatterns = [
    # Public (vitrine)
    path("site/offres/", public.offers_list, name="site-offres"),
    path("site/offres/<slug:slug>/", public.offer_detail, name="site-offre"),
    path("site/candidature/", public.application_create, name="site-candidature"),
    # Gestion RH (super-admin)
    path("", include(router.urls)),
]
