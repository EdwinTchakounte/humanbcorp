"""Stub d'audit minimal pour HBC-RH.

Le module d'audit d'origine (apps_coop.audit) écrivait des lignes de journal et
lisait des réglages ajustables (AppSettings). Ici on fournit le contrat minimal
attendu par `notifications` et `payments`. L'audit ne doit JAMAIS casser un flux
métier : toutes ces fonctions sont donc défensives / no-op.
"""
from __future__ import annotations


def record(*, action, entite_type="", entite_id=None, user=None, details=None, ip=None, user_agent=""):
    """Écrit une ligne d'audit — no-op ici (ne lève jamais)."""
    return None


def client_ip(request):
    """Renvoie l'IP client en tenant compte d'un éventuel proxy."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


def get_int_setting(key, default):
    """Réglage entier ajustable — retourne le défaut (pas de table AppSettings)."""
    return default


def get_str_setting(key, default):
    """Réglage texte ajustable — retourne le défaut."""
    return default
