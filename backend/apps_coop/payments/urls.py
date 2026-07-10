"""Routes génériques de l'app paiement (montées sous ``/api/v1/payments/``).

HBC-RH n'utilise l'app `payments` que comme **librairie** (modèles + provider
Tara + services + réconciliation). Seules les routes indépendantes du métier
sont exposées ici :
  - le **webhook Tara** (Tara → nous), point d'entrée de la confirmation ;
  - le **simulateur dev** (DEBUG uniquement) pour confirmer un paiement en local
    sans passer par Tara.

Les endpoints métier (init d'un paiement d'inscription, encaissement manuel,
historique) sont fournis par le module `sitecms`, adaptés au modèle `Order`.
"""
from django.urls import path

from . import views


app_name = "coop_payments"

urlpatterns = [
    # Tara → nous : confirmation de paiement (atomique, idempotent).
    path("webhook/tara/", views.webhook_tara, name="webhook-tara"),
    # Dev-only : simule un webhook Tara réussi (renvoie 404 si DEBUG=False).
    path("dev/<int:pk>/confirm/", views.dev_confirm_payment, name="dev-confirm"),
]
