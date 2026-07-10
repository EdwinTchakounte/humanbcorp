"""Routes publiques du recrutement, montées sous /api/v1/."""

from django.urls import path

from . import public

urlpatterns = [
    path("site/offres/", public.offers_list, name="site-offres"),
    path("site/offres/<slug:slug>/", public.offer_detail, name="site-offre"),
    path("site/candidature/", public.application_create, name="site-candidature"),
]
