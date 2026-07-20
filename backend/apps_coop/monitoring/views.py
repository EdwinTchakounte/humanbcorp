"""Monitoring — santé technique + activité métier.

Deux vues :
- `health` (publique, légère) : sonde de vivacité pour un load-balancer/nginx —
  ping DB, 200 si OK / 503 sinon.
- `MonitoringOverviewView` (super-admin) : tableau de bord unifié — état des
  services, paiements en attente/bloqués, erreurs webhook & e-mails (lues dans le
  journal d'audit et `EmailLog`), état de l'ordonnanceur, et flux d'activité récent.

Aucune donnée n'est écrite ; tout est lu de façon défensive.
"""
from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes as perm_cls
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from sitecms.roles import is_admin


def _db_ok() -> bool:
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
            c.fetchone()
        return True
    except Exception:  # noqa: BLE001
        return False


@api_view(["GET"])
@perm_cls([AllowAny])
def health(request):
    """Sonde de vivacité — DB + mode. 200 si OK, 503 si la base est injoignable."""
    ok = _db_ok()
    return Response(
        {"status": "ok" if ok else "degraded",
         "database": "ok" if ok else "down",
         "debug": settings.DEBUG},
        status=200 if ok else 503,
    )


class IsPlatformAdmin(BasePermission):
    message = "Réservé à l'administration de la plateforme."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_admin(request.user))


def _scheduler_state(now):
    """État de l'ordonnanceur django-q2 : tourne-t-il, planifications, dernier run."""
    state = {"running": False, "schedules": 0, "last_success": None}
    try:
        from django_q.status import Stat

        if Stat.get_all():
            state["running"] = True
    except Exception:  # noqa: BLE001
        pass
    try:
        from django_q.models import Schedule, Success

        state["schedules"] = Schedule.objects.count()
        last = Success.objects.order_by("-stopped").first()
        if last and last.stopped:
            state["last_success"] = last.stopped.isoformat()
            # Indice de vivacité : une tâche réussie dans l'heure = cluster actif.
            if not state["running"] and (now - last.stopped).total_seconds() < 3600:
                state["running"] = True
    except Exception:  # noqa: BLE001
        pass
    return state


class MonitoringOverviewView(APIView):
    """GET /monitoring/overview/ → santé technique + activité (super-admin)."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        from apps_coop.audit.models import AuditLog
        from apps_coop.audit.services import get_int_setting
        from apps_coop.notifications.models import EmailLog
        from apps_coop.payments.models import Payment

        now = timezone.now()
        day_ago = now - timedelta(hours=24)
        stuck_after = get_int_setting("payments.alert.stuck_after_minutes", 60)
        stuck_cutoff = now - timedelta(minutes=stuck_after)

        pending = Payment.objects.filter(statut=Payment.Statut.EN_ATTENTE)
        stuck = pending.filter(gateway_initiated_at__isnull=False, gateway_initiated_at__lte=stuck_cutoff)
        pending_n, stuck_n = pending.count(), stuck.count()

        wh_errors = AuditLog.objects.filter(
            created_at__gte=day_ago,
            action__in=[
                "payment.webhook.rejected",
                "payment.webhook.handler_error",
                "payment.webhook.unknown_payment",
            ],
        ).count()
        mail_echec = EmailLog.objects.filter(statut=EmailLog.Statut.ECHEC, created_at__gte=day_ago).count()

        db_ok = _db_ok()
        scheduler = _scheduler_state(now)

        # Synthèse : une alerte = un point d'attention à afficher en tête.
        alertes = []
        if not db_ok:
            alertes.append("Base de données injoignable")
        if stuck_n:
            alertes.append(f"{stuck_n} paiement(s) bloqué(s) depuis plus de {stuck_after} min")
        if not scheduler["running"]:
            alertes.append("Ordonnanceur (qcluster) inactif — réconciliation et alertes de paiement non exécutées")
        if wh_errors:
            alertes.append(f"{wh_errors} erreur(s) de webhook paiement sur 24 h")
        if mail_echec:
            alertes.append(f"{mail_echec} e-mail(s) en échec sur 24 h")

        # Gravité : critique si un service est en panne, sinon attention, sinon OK.
        critique = (not db_ok) or stuck_n > 0 or (not scheduler["running"])
        statut = "ok" if not alertes else ("critique" if critique else "attention")

        recent = list(
            AuditLog.objects.select_related("user").order_by("-created_at")[:15].values(
                "id", "action", "entite_type", "entite_id", "user__username", "created_at"
            )
        )
        for r in recent:
            r["created_at"] = r["created_at"].isoformat()
            r["user"] = r.pop("user__username", None)

        return Response({
            "statut": statut,
            "alertes": alertes,
            "genere_le": now.isoformat(),
            "services": {"database": "ok" if db_ok else "down", "scheduler": scheduler},
            "paiements": {
                "en_attente": pending_n,
                "bloques": stuck_n,
                "seuil_minutes": stuck_after,
                "valides_24h": Payment.objects.filter(
                    statut=Payment.Statut.VALIDE, updated_at__gte=day_ago
                ).count(),
            },
            "webhooks_erreurs_24h": wh_errors,
            "emails_echec_24h": mail_echec,
            "activite_recente": recent,
        })
