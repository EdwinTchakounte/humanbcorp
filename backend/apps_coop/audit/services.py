"""Service d'écriture du journal d'audit pour HBC-RH.

Contrat consommé par `notifications`, `payments`, `recruitment`, `sitecms`. Règle
d'or : **l'audit ne doit JAMAIS casser un flux métier**. Toutes les fonctions
sont donc défensives — elles avalent leurs erreurs et retombent sur un défaut.

`record()` écrit désormais une vraie ligne `AuditLog` (l'app était auparavant un
stub no-op). Les ~15 points d'appel existants s'« allument » sans changement.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def record(*, action, entite_type="", entite_id=None, user=None, details=None, ip=None, user_agent=""):
    """Écrit une ligne d'audit. Ne lève jamais (défensif).

    `user` peut être un `AnonymousUser` (webhook, endpoint public) ou None → on
    n'attache alors aucun acteur. `details` est un dict libre (avant→après, etc.).
    """
    try:
        from .models import AuditLog

        acteur = user if (user is not None and getattr(user, "pk", None)) else None
        AuditLog.objects.create(
            action=str(action or "")[:120],
            entite_type=str(entite_type or "")[:80],
            entite_id="" if entite_id is None else str(entite_id)[:64],
            user=acteur,
            details=details or {},
            ip=str(ip or "")[:64],
            user_agent=user_agent or "",
        )
    except Exception:  # noqa: BLE001 — tracer ne doit jamais casser le métier
        logger.exception("record_audit a échoué (action=%r)", action)
    return None


def client_ip(request):
    """Renvoie l'IP client en tenant compte d'un éventuel proxy."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


def get_int_setting(key, default):
    """Réglage entier ajustable (`AppSetting`) — défaut si absent/illisible."""
    try:
        from .models import AppSetting

        raw = AppSetting.objects.filter(key=key).values_list("value", flat=True).first()
        return int(str(raw).strip()) if raw not in (None, "") else default
    except Exception:  # noqa: BLE001
        return default


def get_str_setting(key, default):
    """Réglage texte ajustable (`AppSetting`) — défaut si absent/illisible."""
    try:
        from .models import AppSetting

        raw = AppSetting.objects.filter(key=key).values_list("value", flat=True).first()
        return raw if raw not in (None, "") else default
    except Exception:  # noqa: BLE001
        return default


# --- Temps de session (Point 10) -------------------------------------------
PAS_ECRITURE_SECONDES = 60


def source_de(request):
    """Déduit l'origine de l'appel du chemin — plus fiable qu'un en-tête d'origine.

    L'espace apprenant vit sous /api/v1/site/, le back-office consomme le reste.
    """
    from .models import SessionUtilisateur

    chemin = getattr(request, "path", "") or ""
    if "/api/v1/site/" in chemin:
        return SessionUtilisateur.ESPACE
    return SessionUtilisateur.DASHBOARD


def toucher_session(request, user, source=None):
    """Prolonge la session d'activité en cours, ou en ouvre une nouvelle.

    Défensif comme le reste de l'audit : mesurer ne doit jamais casser un flux.
    """
    try:
        from datetime import timedelta

        from django.utils import timezone

        from .models import SessionUtilisateur

        if not (user is not None and getattr(user, "pk", None)):
            return None
        source = source or source_de(request)
        maintenant = timezone.now()
        seuil = maintenant - timedelta(minutes=SessionUtilisateur.INACTIVITE_MINUTES)

        session = (
            SessionUtilisateur.objects
            .filter(user=user, source=source, derniere_activite__gte=seuil)
            .order_by("-derniere_activite").first()
        )
        if session is None:
            return SessionUtilisateur.objects.create(
                user=user, source=source, debut=maintenant, derniere_activite=maintenant,
                minutes_actives=1, ip=str(client_ip(request) or "")[:64],
                user_agent=(request.META.get("HTTP_USER_AGENT", "") if hasattr(request, "META") else ""),
            )
        # Écriture paresseuse : on ne repousse la borne qu'une fois par minute.
        if (maintenant - session.derniere_activite).total_seconds() < PAS_ECRITURE_SECONDES:
            return session
        session.derniere_activite = maintenant
        session.minutes_actives += 1
        session.save(update_fields=["derniere_activite", "minutes_actives"])
        return session
    except Exception:  # noqa: BLE001 — mesurer ne doit jamais casser le métier
        logger.exception("toucher_session a échoué")
        return None
