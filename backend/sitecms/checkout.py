"""Checkout **invité** d'un panier de session anonyme (vitrine publique).

La vitrine laisse un visiteur non identifié empiler, côté navigateur, plusieurs
formations pour plusieurs personnes (un parent pour ses enfants). Ce module
matérialise ce panier **en une seule requête** au moment du paiement :

    1. l'acheteur s'identifie par son e-mail        → compte invité (`_guest_user`) ;
    2. chaque ligne {formation, participant}        → `Inscription` (WAITING),
       en gérant l'e-mail PARTAGÉ entre enfants     (`_participant_user`) ;
    3. le tout devient **une** `Order` (PENDING)    reliée par `OrderInscription` ;
    4. l'adresse de contact est figée sur la commande (`AdresseCommande`).

On ne réécrit **ni le paiement ni le suivi** : la commande est renvoyée sous le
même jeton signé (`sign_order`) que le parcours mono-formation, donc le front
réutilise tels quels `/site/inscription/<token>/payer/` et le polling de statut.
Le provisionnement des accès (confirmation des inscriptions, e-mails/liens
magiques par participant) reste entièrement porté par le hook de paiement
`apps_coop.payments.services._hook_inscription_order`.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from bucket.models import Inscription, Order, OrderInscription
from contents.models import Publication

from .models import AdresseCommande
from .panier import _email_reserve, _panier, _participant_user
from .public_catalog import (
    GuestWriteThrottle,
    _guest_user,
    _public_formations_qs,
    sign_order,
)


def _resoudre_participant(item, buyer):
    """(publication, user_participant) pour une ligne de panier, ou (None, message d'erreur).

    Accepte `pour_moi: true` (l'acheteur s'inscrit lui-même) ou un objet
    `participant: {first_name, last_name?, email}`. Applique les mêmes règles que
    le panier connecté : e-mail valide, prénom requis, e-mail du personnel refusé.
    """
    pub_id = item.get("formation_id") or item.get("publication_id")
    try:
        pub = _public_formations_qs().get(pk=pub_id)
    except (Publication.DoesNotExist, ValueError, TypeError):
        return None, "Formation introuvable ou non ouverte aux inscriptions."

    if item.get("pour_moi"):
        return pub, buyer

    p = item.get("participant") or {}
    email = (p.get("email") or "").strip().lower()
    prenom = (p.get("first_name") or "").strip()
    nom = (p.get("last_name") or "").strip()
    if not email or "@" not in email:
        return None, "Chaque apprenant doit avoir un e-mail valide."
    if not prenom:
        return None, "Chaque apprenant doit avoir un prénom."
    if email != (buyer.email or "").lower() and _email_reserve(email):
        return None, f"L'adresse {email} appartient à un compte du personnel."
    return pub, _participant_user(email=email, first_name=prenom, last_name=nom)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([GuestWriteThrottle])
def panier_checkout(request):
    """POST /api/v1/site/panier/checkout/ — matérialise un panier de session anonyme.

    Corps ::

        {
          "acheteur": {"email", "first_name", "last_name"?},
          "adresse":  {"ligne1"?, "ligne2"?, "ville"?, "region"?, "pays"?, "telephone"?},
          "items": [
            {"formation_id", "participant": {"first_name", "last_name"?, "email"}},
            {"formation_id", "pour_moi": true}
          ]
        }

    Réponse : `order_token` (à régler via les endpoints paiement existants),
    `amount`, `nb_lignes` et, si la commande est gratuite, `paid: true`.
    """
    d = request.data
    acheteur = d.get("acheteur") or {}
    email = (acheteur.get("email") or "").strip().lower()
    first_name = (acheteur.get("first_name") or "").strip()
    last_name = (acheteur.get("last_name") or "").strip()
    items = d.get("items") or []

    if not email or "@" not in email:
        return Response({"detail": "E-mail de l'acheteur requis."}, status=status.HTTP_400_BAD_REQUEST)
    if not first_name:
        return Response({"detail": "Prénom de l'acheteur requis."}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(items, list) or not items:
        return Response({"detail": "Votre panier est vide."}, status=status.HTTP_400_BAD_REQUEST)
    # L'acheteur ne peut pas être un compte du personnel (mêmes garde-fous que le panier).
    if _email_reserve(email):
        return Response(
            {"detail": f"L'adresse {email} appartient à un compte du personnel."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    buyer = _guest_user(email=email, first_name=first_name, last_name=last_name)

    # Résolution des lignes AVANT d'écrire quoi que ce soit : une ligne invalide
    # doit faire échouer tout le panier, pas en matérialiser la moitié.
    cibles = []  # (publication, participant_user)
    for item in items:
        if not isinstance(item, dict):
            return Response({"detail": "Ligne de panier invalide."}, status=status.HTTP_400_BAD_REQUEST)
        pub, res = _resoudre_participant(item, buyer)
        if pub is None:
            return Response({"detail": res}, status=status.HTTP_400_BAD_REQUEST)
        cibles.append((pub, res))

    ignores = []
    with transaction.atomic():
        bucket = _panier(buyer)
        # Verrou par formation pour un décompte de capacité fiable sous concurrence.
        pub_ids = sorted({pub.pk for pub, _ in cibles})
        pubs = {p.pk: p for p in Publication.objects.select_for_update().filter(pk__in=pub_ids)}

        besoin = defaultdict(int)     # places neuves à réserver par formation
        vus = set()                   # dédoublonnage (participant, formation)
        a_creer = []                  # (pub, participant) à matérialiser
        for pub, participant in cibles:
            pub = pubs[pub.pk]
            cle = (participant.pk, pub.pk)
            if cle in vus:
                continue
            vus.add(cle)

            existante = (
                Inscription.objects.filter(participant=participant, publication=pub, is_deleted=False)
                .exclude(status=Inscription.CANCEL)
                .first()
            )
            if existante and existante.status == Inscription.CONFIRMED:
                ignores.append({"email": participant.email, "formation": pub.title, "raison": "déjà inscrit"})
                continue
            if existante:  # réservation abandonnée : elle occupe déjà une place
                bucket.inscriptions.add(existante)
                a_creer.append((pub, existante))
                continue
            besoin[pub.pk] += 1
            a_creer.append((pub, None, participant))

        # Contrôle de capacité : places déjà prises (WAITING/CONFIRMED, hors panier
        # courant) + places neuves demandées ne doivent pas dépasser la capacité.
        complets = []
        for pid, n in besoin.items():
            pub = pubs[pid]
            if not pub.capacite:
                continue
            prises = (
                Inscription.objects.filter(
                    publication=pub, is_deleted=False,
                    status__in=[Inscription.WAITING, Inscription.CONFIRMED],
                ).count()
            )
            if prises + n > pub.capacite:
                complets.append(pub.title)
        if complets:
            return Response(
                {"detail": "Certaines sessions sont complètes : " + ", ".join(sorted(set(complets))),
                 "complete": True},
                status=status.HTTP_409_CONFLICT,
            )

        lignes = []
        for entry in a_creer:
            if len(entry) == 2:  # inscription existante remise au panier
                _, ins = entry
                lignes.append(ins)
                continue
            pub, _, participant = entry
            ins = Inscription.objects.create(
                participant=participant, publication=pub, status=Inscription.WAITING
            )
            bucket.inscriptions.add(ins)
            lignes.append(ins)

        if not lignes:
            return Response(
                {"detail": "Aucune inscription à enregistrer.", "ignores": ignores},
                status=status.HTTP_409_CONFLICT,
            )

        # Prix figé à la commande (comme le parcours visiteur).
        total = sum(Decimal(ins.publication.price or 0) for ins in lignes)
        order = Order.objects.create(buyer=buyer, status=Order.PENDING, total_amount=total)
        for ins in lignes:
            OrderInscription.objects.create(order=order, inscription=ins)

        adr = d.get("adresse") or {}
        AdresseCommande.objects.create(
            order=order,
            buyer_email=email,
            nom_complet=(f"{first_name} {last_name}".strip())[:200],
            telephone=(adr.get("telephone") or "").strip()[:30],
            ligne1=(adr.get("ligne1") or "").strip()[:255],
            ligne2=(adr.get("ligne2") or "").strip()[:255],
            ville=(adr.get("ville") or "").strip()[:120],
            region=(adr.get("region") or "").strip()[:120],
            pays=(adr.get("pays") or "").strip()[:120] or "Cameroun",
        )

    # Commande gratuite : aucun paiement à attendre — on confirme immédiatement via
    # le même hook métier que le paiement (mêmes e-mails, même audit, idempotent).
    if total <= 0:
        from apps_coop.payments.models import Payment
        from apps_coop.payments.services import _hook_inscription_order

        with transaction.atomic():
            _hook_inscription_order(
                Payment(member=buyer, montant=Decimal(0),
                        type=Payment.Type.FRAIS_INSCRIPTION, order=order),
                {},
            )
        order.refresh_from_db()
        return Response({
            "detail": "Inscription confirmée. Chaque apprenant reçoit son accès par e-mail.",
            "order_id": order.id,
            "amount": "0",
            "nb_lignes": len(lignes),
            "ignores": ignores,
            "paid": True,
        }, status=status.HTTP_201_CREATED)

    return Response({
        "detail": "Commande créée. Vous pouvez la régler en ligne.",
        "order_token": sign_order(order),
        "order_id": order.id,
        "amount": str(order.total_amount),
        "nb_lignes": len(lignes),
        "ignores": ignores,
        "paid": False,
    }, status=status.HTTP_201_CREATED)
