"""Routes du journal d'audit, montées sous /api/v1/."""
from rest_framework.routers import DefaultRouter

from .api import AuditLogViewSet

router = DefaultRouter()
router.register("audit/journal", AuditLogViewSet, basename="audit-journal")

urlpatterns = router.urls
