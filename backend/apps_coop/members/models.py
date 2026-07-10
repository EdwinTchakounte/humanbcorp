"""Adaptateur `Member` pour HBC-RH.

Les modules `payments` et `notifications` référencent `apps_coop.members.models.Member`
comme « modèle utilisateur métier ». HBC-RH n'a pas de modèle Member séparé : on
utilise directement le `User` Django. On expose donc `Member` comme alias de `User`
pour que les FK `ForeignKey(Member)` pointent sur `auth.User` sans réécriture.
"""
from __future__ import annotations

from django.contrib.auth.models import User as Member  # noqa: F401  (alias volontaire)

__all__ = ["Member"]
