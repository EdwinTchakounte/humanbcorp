"""Panier d'inscriptions — souscrire pour soi **et pour d'autres** (parent → enfants).

Complète `public_catalog` (achat d'une formation, une personne, en visiteur) par
un parcours connecté : depuis son espace, l'apprenant parcourt le catalogue,
empile plusieurs formations et plusieurs participants, puis règle **une seule
commande**.

Modèle de données — rien de neuf :

  - le panier est un `bucket.BucketOfInscriptions` (owner = acheteur) contenant
    des `Inscription` en WAITING ;
  - la commande est une `Order` (buyer = acheteur) reliée par `OrderInscription` ;
  - `Inscription.participant` est **l'apprenant**, qui peut différer de
    l'acheteur. C'est là que se joue le cas parent/enfants.

Le hook de paiement (`apps_coop.payments.services._hook_inscription_order`)
confirme déjà toutes les inscriptions d'une commande, vide le panier et envoie à
**chaque participant** son e-mail d'accès. Ce module n'a donc rien à réimplémenter
du paiement : il produit une `Order` de la même forme que le parcours visiteur, et
le même jeton signé sert à la régler.
"""
from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from bucket.models import BucketOfInscriptions, Inscription, Order, OrderInscription
from contents.models import Publication

from .learner import load_member
from .public_catalog import (
    PublicFormationSerializer,
    _guest_user,
    _public_formations_qs,
    sign_order,
)


def _panier(user) -> BucketOfInscriptions:
    """Le panier de cet acheteur, créé à la volée."""
    bucket = BucketOfInscriptions.objects.filter(owner=user).first()
    if bucket is None:
        bucket = BucketOfInscriptions.objects.create(owner=user)
    return bucket


def _lignes(bucket):
    """Inscriptions réellement en attente dans le panier.

    Une inscription confirmée entre-temps (payée par ailleurs, offerte par un
    admin) n'a plus rien à faire dans le panier : on la filtre à la lecture
    plutôt que de dépendre d'un nettoyage parfait à l'écriture.
    """
    return (
        bucket.inscriptions.filter(status=Inscription.WAITING, is_deleted=False)
        .select_related("participant", "publication")
        .order_by("id")
    )


def _ligne_payload(ins):
    pub = ins.publication
    return {
        "inscription_id": ins.id,
        "publication_id": pub.id,
        "formation": pub.title,
        "prix": str(pub.price or 0),
        "participant": {
            "nom": ins.participant.get_full_name() or ins.participant.username,
            "email": ins.participant.email,
            "id": ins.participant_id,
        },
    }


def _panier_payload(user):
    bucket = _panier(user)
    lignes = [_ligne_payload(i) for i in _lignes(bucket)]
    total = sum(Decimal(l["prix"]) for l in lignes)
    return {
        "lignes": lignes,
        "total": str(total),
        "nb_lignes": len(lignes),
        "nb_participants": len({l["participant"]["id"] for l in lignes}),
    }


def _email_reserve(email: str) -> bool:
    """L'adresse appartient-elle à un compte du personnel ?

    Le panier accepte un e-mail libre pour désigner un enfant : rien n'empêcherait
    d'y saisir l'adresse d'un admin ou d'un formateur. On la refuse — l'inscription
    ne fuiterait rien, mais elle pollue un compte de travail et fausse le suivi.

    Le test porte sur **l'e-mail**, et avant toute création de compte. `_guest_user`
    déduplique sur le `username` (= l'e-mail tronqué) : un admin dont le username
    est `fokam` ne serait jamais retrouvé par son adresse, et le contrôle fait
    après coup porterait sur un compte invité fraîchement créé — donc innocent.
    """
    from django.db.models import Q

    from .roles import is_admin, is_teacher

    for u in User.objects.filter(email__iexact=email).filter(
        Q(is_staff=True) | Q(is_superuser=True) | Q(groups__isnull=False)
    ).distinct():
        if u.is_staff or u.is_superuser or is_admin(u) or is_teacher(u):
            return True
    return False


# ---------------------------------------------------------------------------
# Catalogue vu depuis l'espace apprenant
# ---------------------------------------------------------------------------


def _catalogue_body(request, user):
    """Formations ouvertes, annotées pour cet utilisateur.

    Même source que le catalogue public : l'apprenant connecté ne voit ni plus,
    ni moins que le visiteur. On ajoute seulement ce qu'il ne peut pas deviner —
    les formations auxquelles il est déjà inscrit, et celles déjà au panier.
    """
    qs = _public_formations_qs()
    data = PublicFormationSerializer(qs, many=True, context={"request": request}).data

    deja = set(
        Inscription.objects.filter(
            participant=user, is_deleted=False,
        ).exclude(status=Inscription.CANCEL).values_list("publication_id", flat=True)
    )
    au_panier = set(_lignes(_panier(user)).values_list("publication_id", flat=True))
    for f in data:
        f["deja_inscrit"] = f["id"] in deja
        f["au_panier"] = f["id"] in au_panier
    return Response({"formations": data})


# ---------------------------------------------------------------------------
# Panier
# ---------------------------------------------------------------------------


def _panier_lire_body(request, user):
    """Contenu courant du panier."""
    return Response(_panier_payload(user))


def _memes_noms(u, first: str, last: str) -> bool:
    """Le compte existant est-il la même personne (ou encore sans nom) ?"""
    ef = (u.first_name or "").strip().lower()
    el = (u.last_name or "").strip().lower()
    if not ef and not el:
        return True  # compte invité encore vierge → on le complètera
    return ef == first.strip().lower() and el == last.strip().lower()


def _participant_user(email: str, first_name: str, last_name: str):
    """Résout le compte apprenant d'un participant, en gérant l'e-mail PARTAGÉ.

    Un parent peut inscrire plusieurs enfants sous **une seule adresse e-mail**.
    Or `_guest_user` déduplique par e-mail (username = e-mail) : deux enfants
    partageant l'adresse fusionneraient en un seul compte. On distingue donc :

    - e-mail libre, ou déjà celui de CETTE personne → compte « normal »
      (username = e-mail, login par mot de passe possible), via `_guest_user` ;
    - e-mail déjà détenu par une AUTRE personne (le parent ou un frère/sœur) →
      compte **distinct** au username dérivé. Ces comptes s'utilisent par lien
      magique (un lien par enfant, tous dans la boîte du parent), pas par mot de
      passe — l'adresse partagée ne les distinguerait pas au login.
    """
    email = email.strip().lower()
    first = first_name.strip()
    last = last_name.strip()

    holder = User.objects.filter(username=email[:150]).first()
    if holder is None or _memes_noms(holder, first, last):
        return _guest_user(email=email, first_name=first, last_name=last)

    from django.contrib.auth.models import Group
    from django.utils.text import slugify

    from .roles import LEARNER_GROUP

    # Réutilise un compte enfant déjà créé pour ce (e-mail, nom) — un parent qui
    # re-sélectionne le même enfant ne doit pas en dupliquer le compte.
    frere = (
        User.objects.filter(
            email__iexact=email, first_name__iexact=first, last_name__iexact=last,
            groups__name__iexact=LEARNER_GROUP,
        ).exclude(pk=holder.pk).first()
    )
    if frere:
        return frere

    base = (slugify(f"{first}-{last}") or "enfant")[:80]
    username = f"{base}.{email}"[:150]
    n = 2
    while User.objects.filter(username=username).exists():
        username = f"{base}-{n}.{email}"[:150]
        n += 1
    child = User.objects.create(username=username, email=email, first_name=first, last_name=last)
    child.set_unusable_password()
    child.save(update_fields=["password"])
    learner_group, _ = Group.objects.get_or_create(name=LEARNER_GROUP)
    child.groups.add(learner_group)
    return child


def _ajouter_body(request, user):
    """Ajoute une formation au panier pour un ou plusieurs apprenants.

    Corps : ``{publication_id, pour_moi: bool, participants: [{first_name, last_name, email}, ...]}``.

    `pour_moi` est explicite car « je m'inscris **et** j'inscris mes enfants » est
    un cas courant : le déduire d'une liste vide rendrait la case à cocher
    inopérante dès qu'un autre participant est saisi. Absent, on retombe sur
    l'ancienne convention (liste vide = pour moi) pour ne pas casser les appels
    existants.

    La capacité est vérifiée ici **et** à la commande : entre les deux, d'autres
    acheteurs peuvent avoir pris les places. Refuser tôt évite de laisser
    construire un panier condamné.
    """
    pub_id = request.data.get("publication_id")
    participants = request.data.get("participants") or []
    if not isinstance(participants, list):
        return Response({"detail": "Format des participants invalide."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pub = _public_formations_qs().get(pk=pub_id)
    except (Publication.DoesNotExist, ValueError, TypeError):
        return Response(
            {"detail": "Formation introuvable ou non ouverte aux inscriptions."},
            status=status.HTTP_404_NOT_FOUND,
        )

    bucket = _panier(user)
    ajoutes, ignores = [], []

    with transaction.atomic():
        pub = Publication.objects.select_for_update().get(pk=pub.pk)

        # Résolution des apprenants visés. `_participant_user` réutilise le compte
        # d'un enfant déjà connu (même e-mail + même nom) mais crée un compte
        # DISTINCT quand plusieurs enfants partagent une adresse — pas de fusion.
        pour_moi = request.data.get("pour_moi")
        if pour_moi is None:
            pour_moi = not participants
        cibles = []
        if pour_moi:
            cibles.append(user)
        for p in participants:
            email = (p.get("email") or "").strip().lower()
            prenom = (p.get("first_name") or "").strip()
            if not email or "@" not in email:
                return Response(
                    {"detail": "Chaque apprenant doit avoir un e-mail valide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not prenom:
                return Response(
                    {"detail": "Chaque apprenant doit avoir un prénom."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if email != (user.email or "").lower() and _email_reserve(email):
                return Response(
                    {"detail": f"L'adresse {email} appartient à un compte du personnel."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cibles.append(_participant_user(email=email, first_name=prenom,
                                            last_name=(p.get("last_name") or "").strip()))

        # Dédoublonnage intra-requête : deux lignes identiques prendraient deux
        # places pour une seule personne.
        vus = set()
        for u in cibles:
            if u.pk in vus:
                continue
            vus.add(u.pk)

            existante = (
                Inscription.objects.filter(participant=u, publication=pub, is_deleted=False)
                .exclude(status=Inscription.CANCEL)
                .first()
            )
            if existante and existante.status == Inscription.CONFIRMED:
                ignores.append({"email": u.email, "raison": "déjà inscrit"})
                continue
            if existante:
                # Réservation abandonnée : elle occupe déjà une place, on la
                # remet au panier au lieu d'en créer une seconde.
                bucket.inscriptions.add(existante)
                ajoutes.append(_ligne_payload(existante))
                continue
            if pub.est_complete():
                ignores.append({"email": u.email, "raison": "session complète"})
                continue
            ins = Inscription.objects.create(
                participant=u, publication=pub, status=Inscription.WAITING
            )
            bucket.inscriptions.add(ins)
            ajoutes.append(_ligne_payload(ins))

    payload = _panier_payload(user)
    payload["ajoutes"] = ajoutes
    payload["ignores"] = ignores
    code = status.HTTP_201_CREATED if ajoutes else status.HTTP_409_CONFLICT
    return Response(payload, status=code)


def _retirer_body(request, user):
    """Retire une ligne du panier.

    L'inscription est annulée, pas seulement décrochée du panier : la laisser en
    WAITING immobiliserait une place que plus personne ne compte payer.
    """
    bucket = _panier(user)
    ins = _lignes(bucket).filter(pk=request.data.get("inscription_id")).first()
    if ins is None:
        return Response({"detail": "Ligne introuvable dans votre panier."},
                        status=status.HTTP_404_NOT_FOUND)
    bucket.inscriptions.remove(ins)
    ins.status = Inscription.CANCEL
    ins.save(update_fields=["status"])
    return Response(_panier_payload(user))


def _commander_body(request, user):
    """Transforme le panier en commande.

    Renvoie le **même jeton signé** que le parcours visiteur : le front réutilise
    tel quel `/site/inscription/<token>/payer/` et son polling de statut. Un seul
    chemin de paiement à maintenir, donc un seul à pouvoir casser.

    Cas gratuit : une commande à 0 n'a aucun paiement à attendre. La laisser en
    PENDING bloquerait l'accès pour toujours — on la confirme immédiatement, en
    passant par le même hook métier que le paiement (mêmes e-mails, même audit).
    """
    bucket = _panier(user)

    with transaction.atomic():
        lignes = list(_lignes(bucket).select_for_update())
        if not lignes:
            return Response({"detail": "Votre panier est vide."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Recontrôle de capacité : le panier a pu vieillir. On EXCLUT les lignes
        # du panier courant du décompte — sinon les inscriptions WAITING qu'on
        # s'apprête à confirmer se comptent elles-mêmes et bloquent le dernier
        # acheteur d'une session qui arrive pile à capacité.
        from collections import defaultdict
        par_pub = defaultdict(list)
        for l in lignes:
            par_pub[l.publication_id].append(l)
        complets = []
        for ls in par_pub.values():
            pub = ls[0].publication
            if not pub.capacite:
                continue
            autres = (Inscription.objects
                      .filter(publication=pub, is_deleted=False,
                              status__in=[Inscription.WAITING, Inscription.CONFIRMED])
                      .exclude(pk__in=[l.pk for l in ls]).count())
            if autres + len(ls) > pub.capacite:
                complets.append(pub.title)
        if complets:
            return Response(
                {"detail": "Certaines sessions sont devenues complètes : "
                           + ", ".join(sorted(set(complets))),
                 "complete": True},
                status=status.HTTP_409_CONFLICT,
            )

        # Prix figé à la commande (comme `Order.total_amount` du parcours visiteur) :
        # une hausse de tarif ne doit pas se réappliquer à une commande déjà passée.
        total = sum(Decimal(l.publication.price or 0) for l in lignes)
        order = Order.objects.create(
            buyer=user, status=Order.PENDING, total_amount=total
        )
        for l in lignes:
            OrderInscription.objects.create(order=order, inscription=l)

    if total <= 0:
        from apps_coop.payments.models import Payment
        from apps_coop.payments.services import _hook_inscription_order

        with transaction.atomic():
            _hook_inscription_order(
                Payment(member=user, montant=Decimal(0),
                        type=Payment.Type.FRAIS_INSCRIPTION, order=order), {}
            )
        order.refresh_from_db()
        return Response({
            "detail": "Inscription confirmée. Chaque apprenant reçoit son accès par e-mail.",
            "order_id": order.id,
            "amount": "0",
            "paid": True,
        }, status=status.HTTP_201_CREATED)

    return Response({
        "detail": "Commande créée. Vous pouvez la régler en ligne.",
        "order_token": sign_order(order),
        "order_id": order.id,
        "amount": str(order.total_amount),
        "nb_lignes": len(lignes),
        "paid": False,
    }, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Les apprenants dont je suis l'acheteur (vue « parent »)
# ---------------------------------------------------------------------------


def _mes_apprenants_body(request, user):
    """Les personnes pour qui j'ai payé.

    Aucune table dédiée : le lien parent→enfant se déduit des commandes
    (`Order.buyer` = moi, `Inscription.participant` = l'autre). Une relation
    stockée en plus pourrait diverger de ce que dit la comptabilité ; celle-ci
    est vraie par construction.

    Volontairement limité au **suivi d'inscription** : le parent voit qui est
    inscrit à quoi et si l'accès est actif, pas les notes ni les réponses aux
    quiz — celles-ci appartiennent à l'apprenant.
    """
    liens = (
        OrderInscription.objects.filter(order__buyer=user, order__is_deleted=False)
        .select_related("inscription__participant", "inscription__publication", "order")
        .order_by("inscription__participant_id", "-order__id")
    )
    par_personne: dict[int, dict] = {}
    for oi in liens:
        ins = oi.inscription
        u = ins.participant
        if u.pk == user.pk:
            continue  # mes propres formations sont déjà dans mon espace
        entree = par_personne.setdefault(u.pk, {
            "nom": u.get_full_name() or u.username,
            "email": u.email,
            "compte_actif": u.has_usable_password(),
            "formations": [],
        })
        entree["formations"].append({
            "publication_id": ins.publication_id,
            "titre": ins.publication.title,
            "confirmee": ins.status == Inscription.CONFIRMED,
            "commande_id": oi.order_id,
            "payee": oi.order.status == Order.TOTAL_PAID,
        })
    return Response({"apprenants": list(par_personne.values())})


# ---------------------------------------------------------------------------
# Routes — deux portes d'entrée pour un même corps
# ---------------------------------------------------------------------------
# L'espace apprenant s'ouvre par lien magique ; le mot de passe est facultatif.
# Réserver le panier aux comptes authentifiés le rendrait inaccessible à la
# plupart des apprenants. On reprend donc le doublet déjà en place dans
# `learner.py` : le jeton signé prouve la possession de l'e-mail — la même
# preuve qui autorise déjà à poser un mot de passe — et le JWT sert ceux qui ont
# activé leur compte. Un seul corps de logique, donc une seule règle d'accès à
# tenir juste.


def _par_token(body):
    """Fabrique la vue « lien magique » correspondant à un corps."""

    @api_view(["GET", "POST"])
    @permission_classes([AllowAny])
    def vue(request, token):
        try:
            user = load_member(token)
        except User.DoesNotExist:
            return Response({"detail": "Lien d'accès invalide ou expiré."},
                            status=status.HTTP_404_NOT_FOUND)
        return body(request, user)

    vue.__name__ = f"{body.__name__}_token"
    return vue


def _par_compte(body):
    """Fabrique la vue « compte authentifié » correspondant à un corps."""

    @api_view(["GET", "POST"])
    @permission_classes([IsAuthenticated])
    def vue(request):
        return body(request, request.user)

    vue.__name__ = f"{body.__name__}_auth"
    return vue


catalogue = _par_compte(_catalogue_body)
panier_lire = _par_compte(_panier_lire_body)
panier_ajouter = _par_compte(_ajouter_body)
panier_retirer = _par_compte(_retirer_body)
panier_commander = _par_compte(_commander_body)
mes_apprenants = _par_compte(_mes_apprenants_body)

catalogue_token = _par_token(_catalogue_body)
panier_lire_token = _par_token(_panier_lire_body)
panier_ajouter_token = _par_token(_ajouter_body)
panier_retirer_token = _par_token(_retirer_body)
panier_commander_token = _par_token(_commander_body)
mes_apprenants_token = _par_token(_mes_apprenants_body)
