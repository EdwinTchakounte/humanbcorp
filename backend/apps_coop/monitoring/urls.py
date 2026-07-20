"""Routes du monitoring, montées sous /api/v1/."""
from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("monitoring/overview/", views.MonitoringOverviewView.as_view(), name="monitoring-overview"),
]
