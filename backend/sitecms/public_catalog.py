"""Parcours **public** (visiteur non connecté) : catalogue de formations,
inscription « invité » et paiement mobile money Tara.

Aucun de ces endpoints n'exige d'authentification (`AllowAny`). Pour éviter
d'exposer les identifiants de commande en clair (IDOR), le suivi et le paiement
se font via un **token signé** (`django.core.signing`) émis à l'inscription.

Réutilise le domaine existant sans nouvelle migration :
  - un visiteur = un `User` léger (username = email, mot de passe inutilisable) ;
  - la chaîne `Inscription (WAITING) → Order (PENDING) → Payment (Tara)` est
    identique à celle du back-office (`OrderViewSet.encaisser/payer_en_ligne`).
"""
from __future__ import annotations

import os
from decimal import Decimal, InvalidOperation

from django.contrib.auth.models import User
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from bucket.models import Inscription, Order, OrderInscription
from contents.models import Publication
from .models import Document

# Sel de signature du token de commande publique (indépendant de la SECRET_KEY
# pour pouvoir le cibler, mais dérivé d'elle par django.core.signing).
_ORDER_SALT = "sitecms.public_inscription.order"
_TOKEN_MAX_AGE = 60 * 60 * 24 * 7  # 7 jours pour finaliser un paiement


def sign_order(order: Order) -> str:
    """Jeton opaque et signé identifiant une commande (anti-IDOR)."""
    return signing.dumps({"order": order.pk}, salt=_ORDER_SALT)


def load_order(token: str) -> Order:
    """Résout un jeton → Order. Lève `Order.DoesNotExist` si invalide/expiré."""
    try:
        data = signing.loads(token, salt=_ORDER_SALT, max_age=_TOKEN_MAX_AGE)
    except signing.BadSignature as exc:  # inclut SignatureExpired
        raise Order.DoesNotExist(str(exc))
    return Order.objects.get(pk=data["order"], is_deleted=False)


# ---------------------------------------------------------------------------
# Sérialisation du catalogue public
# ---------------------------------------------------------------------------
class PublicFormationSerializer(serializers.ModelSerializer):
    """Vue publique et minimale d'une formation (Publication non privée)."""

    categorie_name = serializers.CharField(source="categorie.name", read_only=True)
    image_url = serializers.SerializerMethodField()
    # Cohorte : ce que l'acheteur doit voir avant de s'inscrire.
    places_restantes = serializers.SerializerMethodField()
    complete = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = [
            "id", "title", "description", "price", "categorie_name", "image_url", "date",
            "mode", "date_debut", "date_fin", "capacite", "places_restantes", "complete",
        ]

    def get_places_restantes(self, obj):
        return obj.places_restantes()

    def get_complete(self, obj):
        return obj.est_complete()

    def get_image_url(self, obj):
        # Renvoie null si l'image est absente OU si le fichier n'existe pas sur le
        # disque (évite une <img> cassée côté vitrine → placeholder propre).
        if not obj.image:
            return None
        try:
            if not obj.image.storage.exists(obj.image.name):
                return None
        except Exception:  # noqa: BLE001 — stockage indisponible → on tente l'URL
            pass
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


def _public_formations_qs():
    """Formations exposées au public : Publications explicitement non privées."""
    return (
        Publication.objects.filter(is_private=False)
        .select_related("categorie")
        .order_by("-date", "-id")
    )


# ---------------------------------------------------------------------------
# Throttle anti-abus (écriture invité)
# ---------------------------------------------------------------------------
class GuestWriteThrottle(AnonRateThrottle):
    scope = "guest_inscription"
    rate = "20/hour"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def formations_list(request):
    """GET /api/v1/site/formations/ → catalogue public des formations."""
    data = PublicFormationSerializer(
        _public_formations_qs(), many=True, context={"request": request}
    ).data
    return Response({"results": data, "count": len(data)})


@api_view(["GET"])
@permission_classes([AllowAny])
def formation_detail(request, pk):
    """GET /api/v1/site/formations/<id>/ → détail d'une formation publique."""
    try:
        obj = _public_formations_qs().get(pk=pk)
    except Publication.DoesNotExist:
        return Response({"detail": "Formation introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(PublicFormationSerializer(obj, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def documents_list(request):
    """GET /api/v1/site/documents/ → documents publiés, groupables par catégorie."""
    qs = Document.objects.filter(is_active=True, is_deleted=False)
    results = []
    for d in qs:
        if not d.file:
            continue
        try:
            size = d.file.size
        except Exception:  # noqa: BLE001 — fichier manquant sur le disque
            size = None
        url = d.file.url
        results.append({
            "id": d.id,
            "title": d.title,
            "description": d.description,
            "category": d.category,
            "file_url": request.build_absolute_uri(url) if request else url,
            "size": size,
            "ext": os.path.splitext(d.file.name)[1].lstrip(".").upper(),
        })
    return Response({"results": results, "count": len(results)})


def _guest_user(*, email: str, first_name: str, last_name: str) -> User:
    """Récupère ou crée un `User` léger « invité » à partir de l'email.

    L'email sert de clé de déduplication (username = email tronqué). Le compte
    n'a pas de mot de passe utilisable : il ne sert qu'à rattacher les
    inscriptions/commandes/paiements à une identité stable.
    """
    email = email.strip().lower()
    username = email[:150]
    user, created = User.objects.get_or_create(
        username=username,
        defaults={"email": email, "first_name": first_name, "last_name": last_name},
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    else:
        # Complète les infos si le compte invité existait déjà mais vide.
        changed = []
        if not user.first_name and first_name:
            user.first_name = first_name
            changed.append("first_name")
        if not user.last_name and last_name:
            user.last_name = last_name
            changed.append("last_name")
        if not user.email and email:
            user.email = email
            changed.append("email")
        if changed:
            user.save(update_fields=changed)
    return user


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([GuestWriteThrottle])
def inscription_create(request):
    """POST /api/v1/site/inscription/ → inscription invité à une formation.

    Corps attendu : ``{formation_id, first_name, last_name, email, phone?}``.
    Crée (ou réutilise) un compte invité, une `Inscription` (WAITING) et une
    `Order` (PENDING), envoie l'accusé de réception et renvoie un **token signé**
    pour finaliser le paiement.
    """
    d = request.data
    email = (d.get("email") or "").strip()
    first_name = (d.get("first_name") or "").strip()
    last_name = (d.get("last_name") or "").strip()
    formation_id = d.get("formation_id")

    if not email or "@" not in email:
        return Response({"detail": "Email valide requis."}, status=status.HTTP_400_BAD_REQUEST)
    if not first_name:
        return Response({"detail": "Prénom requis."}, status=status.HTTP_400_BAD_REQUEST)
    if not formation_id:
        return Response({"detail": "Formation requise."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        formation = _public_formations_qs().get(pk=formation_id)
    except (Publication.DoesNotExist, ValueError, TypeError):
        return Response(
            {"detail": "Formation introuvable ou non ouverte aux inscriptions."},
            status=status.HTTP_404_NOT_FOUND,
        )

    with transaction.atomic():
        # Verrou de ligne : sans lui, deux inscriptions simultanées sur la
        # dernière place passeraient toutes les deux le test de capacité.
        formation = Publication.objects.select_for_update().get(pk=formation.pk)
        if formation.est_complete():
            return Response(
                {"detail": "Cette session est complète.", "complete": True},
                status=status.HTTP_409_CONFLICT,
            )
        user = _guest_user(email=email, first_name=first_name, last_name=last_name)
        inscription = Inscription.objects.create(
            participant=user, publication=formation, status=Inscription.WAITING
        )
        order = Order.objects.create(
            buyer=user, status=Order.PENDING, total_amount=Decimal(formation.price)
        )
        OrderInscription.objects.create(order=order, inscription=inscription)

    _emit_reservation_email(order, inscription, formation, email)

    return Response(
        {
            "detail": "Inscription enregistrée. Vous pouvez régler les frais en ligne.",
            "order_token": sign_order(order),
            "order_id": order.id,
            "amount": str(order.total_amount),
            "formation_title": formation.title,
        },
        status=status.HTTP_201_CREATED,
    )


def _emit_reservation_email(order, inscription, formation, email):
    """Accusé de réception (best-effort — n'interrompt jamais l'inscription)."""
    try:
        from apps_coop.notifications.events import emit_event

        emit_event(
            "reservation.creee",
            member=order.buyer,
            to_email=email,
            context={
                "nom": order.buyer.get_full_name() or order.buyer.first_name or "",
                "formation": formation.title,
                "date": "À confirmer",
            },
        )
    except Exception:  # noqa: BLE001 — notification best-effort
        pass


@api_view(["GET"])
@permission_classes([AllowAny])
def inscription_status(request, token):
    """GET /api/v1/site/inscription/<token>/ → état de la commande (polling front)."""
    try:
        order = load_order(token)
    except Order.DoesNotExist:
        return Response({"detail": "Lien de suivi invalide ou expiré."}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        "order_id": order.id,
        "status": order.status,
        "paid": order.status == Order.TOTAL_PAID,
        "amount": str(order.total_amount),
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([GuestWriteThrottle])
def inscription_pay(request, token):
    """POST /api/v1/site/inscription/<token>/payer/ → initie le paiement Tara.

    Reprend la logique de `OrderViewSet.payer_en_ligne` : crée un `Payment`
    (mobile money / Tara) et déclenche le STK push. La confirmation arrive
    ensuite par le webhook Tara déjà en place.
    """
    try:
        order = load_order(token)
    except Order.DoesNotExist:
        return Response({"detail": "Lien de paiement invalide ou expiré."}, status=status.HTTP_404_NOT_FOUND)

    if order.status == Order.TOTAL_PAID:
        return Response({"detail": "Cette commande est déjà réglée.", "order_status": order.status})

    from apps_coop.payments.models import Payment
    from apps_coop.payments.services import init_payin_for_payment, notify_payment_initiated

    phone = (request.data.get("phone") or "").strip()
    network = (request.data.get("network") or "").strip().upper()
    if not phone:
        return Response({"detail": "Numéro de téléphone requis."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        montant = Decimal(order.total_amount)
    except (InvalidOperation, TypeError):
        return Response({"detail": "Montant invalide."}, status=status.HTTP_400_BAD_REQUEST)

    payment = Payment.objects.create(
        member=order.buyer,
        montant=montant,
        type=Payment.Type.FRAIS_INSCRIPTION,
        source=Payment.Source.MOBILE_MONEY,
        statut=Payment.Statut.EN_ATTENTE,
        provider_code="tara",
        order=order,
        date_versement=timezone.now(),
    )
    try:
        payment_url, ref, raw = init_payin_for_payment(payment, phone=phone, network=network)
        payment.save(update_fields=["reference_externe", "gateway_initiated_at", "payer_phone", "updated_at"])
    except Exception as exc:  # noqa: BLE001 — remonte l'échec provider au front
        payment.statut = Payment.Statut.REJETE
        payment.motif_rejet = str(exc)[:500]
        payment.save(update_fields=["statut", "motif_rejet", "updated_at"])
        return Response(
            {"detail": f"Échec de l'initiation du paiement : {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    notify_payment_initiated(payment)
    return Response({
        "detail": "Paiement initié. Validez la demande sur votre téléphone (MoMo / Orange Money).",
        "payment_id": payment.id,
        "reference": ref,
        "payment_url": payment_url,
    })
