"""
URL configuration for meetasa project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

# ---------------------------------------------------------------------------
# Backend découplé : ce projet n'expose plus que l'API. La vitrine et le
# back-office sont servis par les applications Next.js (web/ et dashboard/).
#
# L'ancienne application Django à templates (bucket, lessonapp, calendarapp,
# material, contents, chat, paiement, registration, homepage) a été DÉBRANCHÉE.
# Elle a été écrite sans modèle d'autorisation : les droits s'y déduisaient de
# l'appartenance à un groupe, avec une branche « else » réservée aux
# administrateurs — où tout visiteur anonyme atterrissait. Sept failles
# exploitables sans session en sont sorties (prise de contrôle administrateur,
# hash des mots de passe, annuaire des comptes, commandes, réservations, fraude
# au paiement, destruction d'événements), et 18 vues en écriture non protégées
# n'ont jamais été vérifiées. Colmater vue par vue ne pouvait rien garantir ;
# débrancher ferme la classe entière.
#
# Le code reste en place : réactiver une route se fait en la décommentant.
# Voir e2e_legacy_securite.py pour les non-régressions correspondantes.
# ---------------------------------------------------------------------------
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('sitecms.urls')),
    path('api/v1/', include('recruitment.urls')),
    path('api/v1/payments/', include('apps_coop.payments.urls')),
    path('api/v1/notifications/', include('apps_coop.notifications.urls')),
    path('api/v1/', include('apps_coop.audit.urls')),
    path('api/v1/', include('apps_coop.monitoring.urls')),
    # --- Application historique (débranchée) --------------------------------
    # path('administration/', views.administration),
    # path('', views.homepage),
    # path('about/', views.about),
    # path('bucket/', include('bucket.urls')),
    # path('registration/', include('registration.urls')),
    # path('spaces/', include('contents.urls.spaces')),
    # path('publications/', include('contents.urls.publications')),
    # path('relations/', include('contents.urls.relations')),
    # path("d/", DashboardView.as_view(), name="dashboard"),
    # path("", include("calendarapp.urls")),
    # path('material/', include('material.urls')),
    # path('lessonapp/', include('lessonapp.urls')),
    # path('chat/', include('chat.urls')),
    # path('accounts/', include('allauth.urls')),
    # path('paiement/', include('paiement.urls')),
    # path("calendarapp/", include("calendarapp.urls")),
    ]
    

from django.conf.urls.static import static
from django.conf import settings
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

