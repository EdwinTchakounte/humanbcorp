"""Authentification instrumentée : mesurer le temps passé sans rien changer d'autre.

Pourquoi ici et pas dans un middleware : l'authentification par JWT a lieu DANS
la vue DRF, pas dans la pile middleware. Un middleware verrait donc un
`AnonymousUser` sur tout le trafic du dashboard — celui qu'on cherche justement à
mesurer. On se greffe au seul endroit qui connaît l'utilisateur au bon moment :
la classe d'authentification. Les deux classes ci-dessous n'ajoutent aucune règle
d'accès : elles délèguent au parent et se contentent d'un effet de bord tracé.
"""
from __future__ import annotations

from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication

from .services import toucher_session


class JWTAvecSuivi(JWTAuthentication):
    """JWT standard + relevé du temps de connexion."""

    def authenticate(self, request):
        resultat = super().authenticate(request)
        if resultat is not None:
            toucher_session(request, resultat[0])
        return resultat


class SessionAvecSuivi(SessionAuthentication):
    """Session Django standard (Django admin, API navigable) + même relevé."""

    def authenticate(self, request):
        resultat = super().authenticate(request)
        if resultat is not None:
            toucher_session(request, resultat[0])
        return resultat
