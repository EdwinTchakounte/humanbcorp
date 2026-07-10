"""Business hooks fired when a Payment transitions to ``valide``.

The webhook view stays thin: it authenticates, locks the Payment row, sets
``statut=valide`` and delegates the rest here. Each Payment.type maps to a
handler — handlers that aren't implemented yet raise NotImplementedError so
the system fails loud rather than silently miss a side effect.

Every handler MUST be idempotent: it can be called more than once for the
same Payment (the webhook may replay, or the cron may re-trigger after a
network blip). Use ``Payment.statut`` and timestamps as guards.
"""
from __future__ import annotations

import logging
import uuid
from typing import Callable

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps_coop.audit.services import record as record_audit


def _fmt_xaf(amount) -> str:
    """Pretty-print a Decimal/int as `1 234 567`."""
    try:
        return f"{int(amount):,}".replace(",", " ")
    except (TypeError, ValueError):
        return str(amount)

from .models import Payment
from .providers import get_provider


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def init_payin_for_payment(
    payment: Payment,
    *,
    phone: str,
    network: str,
) -> tuple[str | None, str, dict]:
    """Push a payin request to the configured provider.

    Returns ``(payment_url, provider_reference, provider_raw)``. La 3e
    valeur contient la reponse brute du provider (utile cote mobile pour
    afficher vendor / message Tara). Le Payment row est mis a jour en
    place avec ``reference_externe`` et ``gateway_initiated_at`` — le
    caller (view) doit le persister.
    """
    provider = get_provider(payment.provider_code or "tara")
    result = provider.init_payin(payment, phone=phone, network=network)
    payment.reference_externe = result.provider_reference
    payment.gateway_initiated_at = timezone.now()
    return result.payment_url, result.provider_reference, result.raw or {}


@transaction.atomic
def handle_webhook_event(
    payment_idempotency_key: str | uuid.UUID,
    new_status: str,
    *,
    provider_reference: str = "",
    raw_payload: dict | None = None,
) -> Payment:
    """Apply a verified webhook event to the matching Payment row.

    Idempotent: replaying the same event is a no-op. Returns the updated
    (or unchanged) Payment row.

    Raises ``Payment.DoesNotExist`` if the key is unknown — the caller view
    should return 404 to the provider so it stops retrying for ghost rows.
    """
    # Match du Payment — 4 strategies en cascade. Tara ne renvoie PAS notre
    # productId dans le webhook (que collectionId numerique + phoneNumber +
    # paymentId), donc le matching par UUID ne marche qu'en theorie. En
    # pratique on tombe sur le fallback par phone + en_attente recent.
    raw_payload = raw_payload or {}
    payment = None
    match_strategy = None

    # Strategy 1 — UUID direct (rare en pratique, conserve pour compat)
    try:
        uuid.UUID(str(payment_idempotency_key))
        payment = Payment.objects.select_for_update().get(
            idempotency_key=payment_idempotency_key,
        )
        match_strategy = "uuid"
    except (ValueError, TypeError, Payment.DoesNotExist):
        payment = None

    # Strategy 2 — reference_externe == payment_idempotency_key ou provider_reference
    if payment is None:
        candidates = Payment.objects.select_for_update().filter(
            reference_externe=str(payment_idempotency_key),
        )
        if not candidates.exists() and provider_reference:
            candidates = Payment.objects.select_for_update().filter(
                reference_externe=str(provider_reference),
            )
        if candidates.exists():
            payment = candidates.filter(
                statut=Payment.Statut.EN_ATTENTE,
            ).order_by("-created_at").first() or candidates.order_by("-created_at").first()
            if payment is not None:
                match_strategy = "reference_externe"

    # Strategy 3 (NEW) — fallback par phoneNumber Tara : on cherche le Payment
    # EN_ATTENTE le plus recent (< 30 min) dont le membre a ce numero. Tara
    # envoie phoneNumber au format "237699XXXXXX" dans le webhook, donc on
    # compare apres normalisation. C'est notre seule chance quand Tara ne
    # renvoie ni productId UUID ni un ID qu'on a deja stocke en reference.
    if payment is None and raw_payload.get("phoneNumber"):
        from datetime import timedelta

        phone_raw = str(raw_payload["phoneNumber"])
        # Normalise les 2 sens : on accepte 2376XXX, +2376XXX, 6XXX, 06XXX.
        digits_only = "".join(c for c in phone_raw if c.isdigit())
        local_8_digits = digits_only[-9:] if len(digits_only) >= 9 else digits_only
        recent_cutoff = timezone.now() - timedelta(minutes=30)
        candidates = (
            Payment.objects.select_for_update()
            .filter(
                statut=Payment.Statut.EN_ATTENTE,
                created_at__gte=recent_cutoff,
                member__phone__icontains=local_8_digits,
            )
            .order_by("-created_at")
        )
        payment = candidates.first()
        if payment is not None:
            match_strategy = "phone_recent"

    if payment is None:
        logger.warning(
            "[TARA] webhook MATCH FAILED — key=%r ref=%r phone=%r status=%r — "
            "aucun Payment correspondant. Le membre a peut-etre debite son MoMo "
            "sans qu'on puisse rapprocher.",
            payment_idempotency_key,
            provider_reference,
            raw_payload.get("phoneNumber"),
            new_status,
        )
        raise Payment.DoesNotExist()

    logger.info(
        "[TARA] webhook MATCH OK — strategy=%s payment_id=%s status_now=%s -> %s",
        match_strategy,
        payment.id,
        payment.statut,
        new_status,
    )

    # On stocke le paymentId Tara comme reference_externe au passage, ca aidera
    # un eventuel rejeu webhook a matcher direct par strategy 2.
    if provider_reference and payment.reference_externe != provider_reference:
        payment.reference_externe = provider_reference
        payment.save(update_fields=["reference_externe", "updated_at"])

    # Already-final terminal states are not re-evaluated.
    if payment.statut == Payment.Statut.VALIDE:
        return payment
    if payment.statut == Payment.Statut.REJETE and new_status != "valide":
        return payment

    if new_status == "valide":
        return _confirm(payment, provider_reference=provider_reference, raw=raw_payload or {})
    if new_status == "rejete":
        return _reject(payment, raw=raw_payload or {})
    # "en_attente" — provider says "still pending", nothing to change yet.
    return payment


@transaction.atomic
def confirm_payment_manually(payment: Payment, *, provider_reference: str = "") -> Payment:
    """Confirme un paiement saisi manuellement (encaissement agence / cash-in admin).

    Passe le paiement à ``VALIDE`` et exécute le hook métier + les notifications,
    exactement comme un webhook Tara réussi (même pipeline ``_confirm``).
    Idempotent : un paiement déjà ``VALIDE`` n'est pas re-traité.
    """
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.statut == Payment.Statut.VALIDE:
        return payment
    return _confirm(payment, provider_reference=provider_reference, raw={})


# ---------------------------------------------------------------------------
# Private — confirmation pipeline
# ---------------------------------------------------------------------------


def _confirm(payment: Payment, *, provider_reference: str, raw: dict) -> Payment:
    payment.statut = Payment.Statut.VALIDE
    payment.date_validation = timezone.now()
    if provider_reference:
        payment.reference_externe = provider_reference
    payment.save(update_fields=["statut", "date_validation", "reference_externe", "updated_at"])

    record_audit(
        action="payment.confirmed",
        entite_type="Payment",
        entite_id=payment.id,
        details={
            "type": payment.type,
            "montant": str(payment.montant),
            "provider": payment.provider_code,
            "reference": payment.reference_externe,
        },
    )

    handler = _BUSINESS_HOOKS.get(payment.type)
    if handler is None:
        logger.warning(
            "No business handler registered for Payment.type=%s (id=%s)",
            payment.type,
            payment.id,
        )
    else:
        handler(payment, raw)

    _notify_payment_confirmed(payment)
    return payment


def _notify_payment_confirmed(payment: Payment) -> None:
    """Notif in-app systematique a la validation d'un Payment.

    Best-effort . n'echoue jamais. Couvre TOUS les types de paiement (epargne
    classique, cotisation, frais carnet, frais credit, remboursement,
    decaissement). Le membre voit ainsi son paiement passer de "en cours"
    a "valide" dans le centre de notifs mobile / portail, sans dependre du
    canal email.
    """
    if not payment.member_id:
        return
    try:
        from apps_coop.notifications.services import create_notification

        type_display = payment.get_type_display() if hasattr(payment, "get_type_display") else payment.type
        create_notification(
            user=payment.member,
            type=f"payment.confirmed.{payment.type}",
            message=f"Paiement {type_display} de {_fmt_xaf(payment.montant)} FCFA validé.",
            lien="/paiements",
        )
    except Exception:  # noqa: BLE001
        logger.warning("payment.confirmed notification failed", exc_info=True)


def _reject(payment: Payment, *, raw: dict) -> Payment:
    payment.statut = Payment.Statut.REJETE
    payment.motif_rejet = (raw.get("message") or raw.get("reason") or "Rejected by provider")[:500]
    payment.save(update_fields=["statut", "motif_rejet", "updated_at"])
    record_audit(
        action="payment.rejected",
        entite_type="Payment",
        entite_id=payment.id,
        details={"reason": payment.motif_rejet, "provider": payment.provider_code},
    )
    # Notif in-app — le membre doit voir le rejet dans son centre de notifs.
    if payment.member_id:
        try:
            from apps_coop.notifications.services import create_notification

            type_display = payment.get_type_display() if hasattr(payment, "get_type_display") else payment.type
            create_notification(
                user=payment.member,
                type=f"payment.rejected.{payment.type}",
                message=(
                    f"Paiement {type_display} de {_fmt_xaf(payment.montant)} FCFA échoué. "
                    f"{payment.motif_rejet[:120]}"
                ),
                lien="/paiements",
            )
        except Exception:  # noqa: BLE001 — best-effort
            logger.warning("payment.rejected notification failed", exc_info=True)
    return payment


def notify_payment_initiated(payment: Payment) -> None:
    """Cree une notif in-app "Paiement en cours" quand l'init Tara OK.

    Appele depuis la view ``init_payment`` apres le init_payin reussi. Le
    membre voit ainsi son paiement dans le centre de notifs meme s'il ne
    valide pas le STK Push (cas le plus frequent ou un Payment reste en
    en_attente perpetuellement).
    """
    if not payment.member_id:
        return
    try:
        from apps_coop.notifications.services import create_notification

        type_display = payment.get_type_display() if hasattr(payment, "get_type_display") else payment.type
        create_notification(
            user=payment.member,
            type=f"payment.initiated.{payment.type}",
            message=(
                f"Paiement {type_display} de {_fmt_xaf(payment.montant)} FCFA en cours. "
                f"Validez le paiement sur votre téléphone (MoMo/OM)."
            ),
            lien="/paiements",
        )
    except Exception:  # noqa: BLE001
        logger.warning("payment.initiated notification failed", exc_info=True)


# ---------------------------------------------------------------------------
# Business hooks per Payment.type
# ---------------------------------------------------------------------------
# Each hook receives the freshly-confirmed Payment and the raw provider
# payload. It must be idempotent and may NOT raise — log + record_audit on
# failure rather than blow up the webhook.


#: Type de paiement HBC-RH réglant une commande d'inscription/formation.
#: On réutilise l'enum existant `FRAIS_INSCRIPTION` (« Frais d'inscription »).
_INSCRIPTION_PAYMENT_TYPE = Payment.Type.FRAIS_INSCRIPTION


def _member_full_name(member) -> str:
    """Nom lisible du payeur (member = User Django dans HBC-RH)."""
    if member is None:
        return ""
    full = (member.get_full_name() or "").strip() if hasattr(member, "get_full_name") else ""
    return full or getattr(member, "username", "") or ""


def _remove_order_inscriptions_from_bucket(order) -> None:
    """Retire du panier de l'acheteur les inscriptions de la commande.

    Réplique `remove_inscriptions_from_bucket` de l'app d'origine. Idempotent :
    retirer une inscription déjà absente du panier est un no-op.
    """
    from bucket.models import BucketOfInscriptions, OrderInscription

    bucket = BucketOfInscriptions.objects.filter(owner=order.buyer).first()
    if bucket is None:
        return
    for oi in OrderInscription.objects.select_related("inscription").filter(order=order):
        bucket.inscriptions.remove(oi.inscription)


def _emit_paiement_recu(payment, order, *, fully_paid, total_paid) -> None:
    """E-mail transactionnel de confirmation de paiement (best-effort, ne lève jamais)."""
    try:
        from apps_coop.notifications.events import emit_event

        to_email = getattr(payment.member, "email", "") or ""

        # Lien magique vers l'espace apprenant (accès au contenu de la formation).
        try:
            from sitecms.learner import learner_space_url

            portal_url = learner_space_url(payment.member)
        except Exception:  # noqa: BLE001 — dégrade sur l'URL dashboard si indispo
            portal_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3007")

        emit_event(
            "paiement.recu",
            member=payment.member,
            to_email=to_email or None,
            context={
                "nom": _member_full_name(payment.member),
                "montant": _fmt_xaf(payment.montant),
                "commande_id": order.id,
                "reste": _fmt_xaf(max(order.total_amount - total_paid, 0)),
                "statut": "payée intégralement" if fully_paid else "partiellement payée",
                "portal_url": portal_url,
            },
        )
    except Exception:  # noqa: BLE001
        logger.warning("paiement.recu email skipped for Payment #%s", payment.id, exc_info=True)


def _hook_inscription_order(payment: Payment, _raw: dict) -> None:
    """Paiement d'inscription validé → confirme la commande + les inscriptions.

    Réplique la logique de l'app d'origine (`paiement_entrant` +
    `remove_inscriptions_from_bucket`) :
      - total payé (paiements validés de la commande) ≥ `total_amount` → Order
        `TOTAL_PAID` (2), sinon `SEMI_PAID` (3) — équivalent tranche/entier ;
      - passe les inscriptions liées en `CONFIRMED` et les retire du panier ;
      - émet l'événement e-mail `paiement.recu`.

    Idempotent : une commande déjà `TOTAL_PAID` n'est pas retouchée. Ne lève
    jamais (best-effort — loggue/audite en cas de souci) pour ne pas casser le
    webhook Tara.
    """
    if payment.order_id is None:
        logger.warning("Payment #%s (inscription) sans order_id — rien à confirmer.", payment.id)
        return
    try:
        from django.db.models import Sum

        from bucket.models import Inscription, Order, OrderInscription

        order = Order.objects.select_for_update().get(pk=payment.order_id)
        already_final = order.status == Order.TOTAL_PAID

        # Somme des paiements validés rattachés à cette commande.
        total_paid = (
            Payment.objects.filter(order=order, statut=Payment.Statut.VALIDE).aggregate(
                s=Sum("montant")
            )["s"]
            or 0
        )
        fully_paid = total_paid >= order.total_amount

        order.status = Order.TOTAL_PAID if fully_paid else Order.SEMI_PAID
        order.save()

        # Confirme les inscriptions liées + vide le panier (comme l'origine).
        confirmed = 0
        for oi in OrderInscription.objects.select_related("inscription").filter(order=order):
            insc = oi.inscription
            if insc.status != Inscription.CONFIRMED:
                insc.status = Inscription.CONFIRMED
                insc.save(update_fields=["status"])
                confirmed += 1
        _remove_order_inscriptions_from_bucket(order)

        record_audit(
            action="order.paid",
            entite_type="Order",
            entite_id=order.id,
            details={
                "payment_id": payment.id,
                "montant": str(payment.montant),
                "total_paid": str(total_paid),
                "total_amount": str(order.total_amount),
                "fully_paid": fully_paid,
                "inscriptions_confirmed": confirmed,
            },
        )

        if not already_final:
            _emit_paiement_recu(payment, order, fully_paid=fully_paid, total_paid=total_paid)
    except Exception:  # noqa: BLE001 — un hook ne doit jamais casser le webhook.
        logger.warning("_hook_inscription_order a échoué pour Payment #%s", payment.id, exc_info=True)


_BUSINESS_HOOKS: dict[str, Callable[[Payment, dict], None]] = {
    _INSCRIPTION_PAYMENT_TYPE: _hook_inscription_order,
}
