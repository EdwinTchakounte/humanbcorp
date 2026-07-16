"""Espace **apprenant** public (accès par lien magique, sans mot de passe).

Après confirmation du paiement, l'apprenant reçoit par e-mail un lien signé vers
son espace : la liste de ses formations confirmées et, pour chacune, le contenu
pédagogique rattaché (arbre ``Theme → Séances → Activités`` : documents PDF/liens,
blocs texte/image, quiz en lecture).

MVP volontairement en **lecture seule** : pas encore de réponse interactive au
quiz, ni de notation, ni de progression (itération suivante).
"""
from __future__ import annotations

from django.contrib.auth.models import User
from django.core import signing
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from bucket.models import Inscription

_MEMBER_SALT = "sitecms.learner.member"
_TOKEN_MAX_AGE = 60 * 60 * 24 * 180  # 6 mois d'accès au contenu acheté

# Jeton distinct pour le flux d'agenda. Une URL d'abonnement est stockée
# durablement chez Google et se transmet facilement : réutiliser le jeton du
# contenu ferait d'une fuite d'agenda une fuite de la formation entière. Celui-ci
# ne donne que le planning.
#
# Il n'expire pas, volontairement : un abonnement qui meurt le fait en silence,
# l'apprenant ne voit rien et rate ses séances. L'accès est de toute façon
# revérifié à chaque requête — inscription confirmée, offre non expirée — donc
# une URL fuitée ne survit pas aux droits qu'elle représente.
_CALENDAR_SALT = "sitecms.learner.calendar"


def sign_member(user: User) -> str:
    """Jeton opaque et signé identifiant un apprenant (accès à son espace)."""
    return signing.dumps({"member": user.pk}, salt=_MEMBER_SALT)


def learner_space_url(user: User) -> str:
    """Lien magique complet vers l'espace apprenant sur la vitrine."""
    from django.conf import settings

    base = getattr(settings, "SITE_PUBLIC_URL", "http://localhost:3000").rstrip("/")
    return f"{base}/mon-espace/{sign_member(user)}"


def sign_member_calendar(user: User) -> str:
    """Jeton d'abonnement à l'agenda — ne donne accès qu'au planning."""
    return signing.dumps({"cal": user.pk}, salt=_CALENDAR_SALT)


def load_member_calendar(token: str) -> User:
    """Résout un jeton d'agenda → User. Lève `User.DoesNotExist` si invalide.

    Un jeton de contenu présenté ici ne passe pas : les sels diffèrent.
    """
    try:
        data = signing.loads(token, salt=_CALENDAR_SALT)
    except signing.BadSignature as exc:
        raise User.DoesNotExist(str(exc))
    return User.objects.get(pk=data["cal"])


def learner_calendar_url(user: User) -> str:
    """URL d'abonnement au flux d'agenda (à coller dans Google Agenda).

    On réutilise `PUBLIC_BASE_URL`, l'URL publique de l'API : c'est déjà elle
    qu'on transmet à Tara pour ses webhooks, donc elle est nécessairement juste
    en production — sinon les paiements ne rentreraient pas. Un réglage de plus
    serait un réglage de plus à oublier, et l'apprenant s'abonnerait alors à une
    adresse locale, injoignable depuis Google.
    """
    from django.conf import settings

    base = getattr(settings, "PUBLIC_BASE_URL", "http://localhost:8011").rstrip("/")
    return f"{base}/api/v1/site/mon-espace/{sign_member_calendar(user)}/agenda.ics"


def load_member(token: str) -> User:
    """Résout un jeton → User. Lève ``User.DoesNotExist`` si invalide/expiré."""
    try:
        data = signing.loads(token, salt=_MEMBER_SALT, max_age=_TOKEN_MAX_AGE)
    except signing.BadSignature as exc:  # inclut SignatureExpired
        raise User.DoesNotExist(str(exc))
    return User.objects.get(pk=data["member"])


def _abs(request, url):
    if not url:
        return None
    return request.build_absolute_uri(url) if request else url


def _doc_payload(request, doc, index):
    """Sérialise un Material* (MaterialSeanceDoc / MaterialActivityDoc)."""
    try:
        url = doc.doc_link()
    except Exception:  # noqa: BLE001 — document manquant / incohérent
        url = None
    return {
        "id": doc.pk,
        "index": index,
        "title": doc.title,
        "description": doc.description,
        "url": _abs(request, url),
        "m_type": doc.m_type,  # 1=Cours 2=Exercice 3=Réponse 4=Correction
        "mime_type": getattr(getattr(doc, "document", None), "mime_type", "") or "",
    }


def build_theme_content(theme, request, user=None):
    """Construit l'arbre de contenu d'un Theme (adapté de lessonapp.read_theme).

    Si ``user`` est fourni, chaque activité quiz porte ``last_attempt`` (dernier
    score de l'apprenant sur ce quiz) — sinon ``None``.
    """
    # Imports locaux (évite de charger lessonapp/material au démarrage de sitecms).
    from lessonapp.models import Objectif, Seance, Activity, Activityquestion, Question
    from material.models import (
        MaterialSeanceDoc,
        MaterialActivityDoc,
        InputQuestionBox,
        ActivityComponent,
        QuizAttempt,
        ActivityProgress,
    )

    objectifs = list(Objectif.objects.filter(theme=theme).values_list("name", flat=True))

    # Activités terminées par l'apprenant sur ce thème (1 requête).
    completed_ids = set()
    if user is not None:
        completed_ids = set(
            ActivityProgress.objects.filter(
                learner=user, completed=True, activity__seance__theme=theme
            ).values_list("activity_id", flat=True)
        )
    theme_done = theme_total = 0

    seances_out = []
    # `is_deleted` : une séance retirée du programme ne doit plus être servie,
    # mais ses données (progressions, scores) restent en base.
    for si, seance in enumerate(Seance.objects.filter(theme=theme, is_deleted=False), start=1):
        seance_docs = [
            _doc_payload(request, d, i)
            for i, d in enumerate(MaterialSeanceDoc.objects.filter(seance=seance), start=1)
        ]

        activities_out = []
        for ai, activity in enumerate(Activity.objects.filter(seance=seance, is_deleted=False), start=1):
            # Documents rattachés à l'activité (PDF/liens) — tout type d'activité.
            docs = [
                _doc_payload(request, d, i)
                for i, d in enumerate(MaterialActivityDoc.objects.filter(activity=activity), start=1)
            ]

            # Quiz (a_type == 1) — questions + options (lecture seule, sans révéler la bonne réponse)
            questions = []
            if activity.a_type == Activity.QUIZZ:
                aqs = Activityquestion.objects.filter(activity=activity).select_related("question", "question__bloc")
                for qi, aq in enumerate(aqs, start=1):
                    q = aq.question
                    options = [
                        {"id": o.pk, "title": o.title, "input_type": o.input_type}
                        for o in InputQuestionBox.objects.filter(question=q)
                    ]
                    questions.append({
                        "id": q.pk,
                        "index": qi,
                        "title": q.title,
                        "description": q.description,
                        "points": aq.points,
                        "number": aq.number,
                        "options": options,
                    })

            # Blocs de contenu (texte / image / vidéo / audio — embed ou fichier)
            components = [
                {
                    "id": c.pk,
                    "title": c.title,
                    "paragraph": c.paragraph,
                    "image": _abs(request, c.image.url) if c.image else None,
                    "video_url": c.video_url or None,
                    "video_file": _abs(request, c.video_file.url) if c.video_file else None,
                    "audio_url": c.audio_url or None,
                    "audio_file": _abs(request, c.audio_file.url) if c.audio_file else None,
                    "number": c.number,
                }
                for c in ActivityComponent.objects.filter(activity=activity).order_by("number")
            ]

            last_attempt = None
            if user is not None and activity.a_type == Activity.QUIZZ:
                la = QuizAttempt.objects.filter(learner=user, activity=activity).first()
                if la:
                    last_attempt = {"score": la.score, "max_score": la.max_score}

            completed = activity.pk in completed_ids
            theme_total += 1
            if completed:
                theme_done += 1

            activities_out.append({
                "id": activity.pk,
                "index": ai,
                "title": activity.title,
                "type": activity.a_type,  # 1=Quizz 2=PDF 3=Link
                "state": activity.state,
                "documents": docs,
                "questions": questions,
                "components": components,
                "last_attempt": last_attempt,
                "completed": completed,
            })

        seances_out.append({
            "id": seance.pk,
            "index": si,
            "title": seance.title,
            "type": seance.s_type,  # 0=Théorie 1=Pratique 2=Exercice
            "documents": seance_docs,
            "activities": activities_out,
        })

    image = getattr(theme, "image", None)
    return {  # NB : le planning n'est pas ici — il appartient à la cohorte
        "id": theme.pk,
        "title": theme.title,
        "image": _abs(request, image.url) if image else None,
        "objectifs": objectifs,
        "seances": seances_out,
        "progress": {
            "done": theme_done,
            "total": theme_total,
            "percent": round(100 * theme_done / theme_total) if theme_total else 0,
        },
    }


def acces_expire(inscription) -> bool:
    """L'accès au contenu de cette inscription est-il arrivé à échéance ?

    La durée se configure par offre (`Publication.acces_duree_mois`, vide = à
    vie) mais ne court pas du même point selon le mode : depuis la fin de
    session pour une cohorte, depuis l'inscription en accès libre — une offre
    en accès libre n'ayant pas de date de fin.
    """
    pub = getattr(inscription, "publication", None)
    if pub is None:
        return False
    fin = pub.fin_acces(depuis=inscription.created_at)
    return fin is not None and timezone.now() > fin


def build_schedule(publication):
    """Planning d'une **cohorte** : ses créneaux d'agenda et leurs visios.

    Le calendrier appartient à l'offre vendue (`Publication.events`), pas au
    programme (`Theme`) : deux sessions d'une même formation ont chacune leurs
    dates. Le rattachement historique par `EventTheme` faisait voir à chaque
    apprenant le planning de toutes les autres sessions, liens visio compris.
    """
    from calendarapp.models import Meeting

    events = list(
        publication.events.filter(is_deleted=False, is_active=True)
        .exclude(is_test=True)  # is_test est nullable : exclude() couvre NULL et False
        .select_related("seance")
        .order_by("start_time")
    )
    # Une seule requête pour toutes les visios, au lieu d'une par créneau.
    meetings = {}
    for m in Meeting.objects.filter(event__in=events, is_deleted=False):
        meetings.setdefault(m.event_id, []).append({"m_type": m.m_type, "link_url": m.link_url})

    return [
        {
            "id": ev.id,
            "title": ev.title,
            "start_time": ev.start_time,
            "end_time": ev.end_time,
            "meetings": meetings.get(ev.id, []),
            # Séance couverte par le créneau : permet à l'apprenant de relier une
            # date à un chapitre du programme (« Séance 3 — 12 mars »), et de
            # sauter directement au contenu correspondant.
            "seance_id": ev.seance_id,
            "seance_title": ev.seance.title if ev.seance else None,
            "seance_order": ev.seance.order if ev.seance else None,
        }
        for ev in events
    ]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def my_space(request, token):
    """GET /api/v1/site/mon-espace/<token>/ → formations confirmées de l'apprenant."""
    try:
        user = load_member(token)
    except User.DoesNotExist:
        return Response({"detail": "Lien d'accès invalide ou expiré."}, status=status.HTTP_404_NOT_FOUND)

    inscriptions = (
        Inscription.objects.filter(participant=user, status=Inscription.CONFIRMED, is_deleted=False)
        .select_related("publication")
    )
    seen = set()
    formations = []
    for ins in inscriptions:
        pub = ins.publication
        if not pub or pub.id in seen:
            continue
        seen.add(pub.id)
        # L'offre expirée reste listée (l'apprenant doit comprendre pourquoi elle
        # est fermée) mais son contenu n'est plus servi — cf. `my_formation`.
        fin = pub.fin_acces(depuis=ins.created_at)
        formations.append({
            "publication_id": pub.id,
            "title": pub.title,
            "description": pub.description,
            "image": _abs(request, pub.image.url) if pub.image else None,
            "has_content": pub.themes.exists(),
            "progress": _publication_progress(user, pub),
            "mode": pub.mode,
            "date_debut": pub.date_debut,
            "date_fin": pub.date_fin,
            "acces_fin": fin,
            "acces_expire": acces_expire(ins),
        })
    return Response({
        "learner": {"name": user.get_full_name() or user.first_name or user.username, "email": user.email},
        "formations": formations,
        # URL d'abonnement : l'apprenant la colle dans son agenda et ses séances
        # s'y synchronisent, y compris quand on les déplace.
        "agenda_url": learner_calendar_url(user),
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def my_formation(request, token, publication_id):
    """GET /api/v1/site/mon-espace/<token>/formation/<id>/ → contenu d'une formation.

    Autorisation : l'apprenant doit avoir une inscription **confirmée** sur cette
    publication. Renvoie le contenu de chaque Theme rattaché.
    """
    try:
        user = load_member(token)
    except User.DoesNotExist:
        return Response({"detail": "Lien d'accès invalide ou expiré."}, status=status.HTTP_404_NOT_FOUND)

    ins = (
        Inscription.objects.filter(
            participant=user, publication_id=publication_id,
            status=Inscription.CONFIRMED, is_deleted=False,
        )
        .select_related("publication")
        .first()
    )
    if not ins:
        return Response(
            {"detail": "Vous n'avez pas accès à cette formation."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if acces_expire(ins):
        return Response(
            {
                "detail": "Votre accès à cette formation a expiré.",
                "acces_expire": True,
                "acces_fin": ins.publication.fin_acces(depuis=ins.created_at),
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    pub = ins.publication
    # `is_deleted` est un soft-delete : sans ce filtre, une formation supprimée
    # resterait servie aux apprenants tant que le M2M Publication↔Theme n'est
    # pas dénoué à la main.
    themes = [
        build_theme_content(t, request, user=user)
        for t in pub.themes.filter(is_deleted=False)
    ]
    return Response({
        "publication_id": pub.id,
        "title": pub.title,
        "description": pub.description,
        "schedule": build_schedule(pub),
        "themes": themes,
    })


def _learner_can_access_activity(user, activity) -> bool:
    """L'apprenant a une inscription confirmée sur une formation contenant ce quiz."""
    theme = getattr(getattr(activity, "seance", None), "theme", None)
    if theme is None:
        return False
    inscriptions = Inscription.objects.filter(
        participant=user,
        status=Inscription.CONFIRMED,
        is_deleted=False,
        publication__themes=theme,
    ).select_related("publication")
    # Une inscription expirée ne donne plus accès : sans ce filtre, un apprenant
    # dont l'offre est fermée pourrait encore passer les quiz en direct.
    return any(not acces_expire(ins) for ins in inscriptions)


def _score_quiz(activity, answers: dict):
    """Corrige un quiz. Renvoie (score, max_score, results).

    Une question est **juste** si l'ensemble des options cochées == l'ensemble
    des options correctes (vrai pour radio comme pour checkbox).
    """
    from lessonapp.models import Activityquestion
    from material.models import InputQuestionBox

    total = max_total = 0
    results = []
    for aq in Activityquestion.objects.filter(activity=activity).select_related("question"):
        q = aq.question
        correct = set(
            InputQuestionBox.objects.filter(question=q, is_answer=True).values_list("id", flat=True)
        )
        raw = answers.get(str(q.id), answers.get(q.id, [])) or []
        try:
            selected = {int(x) for x in raw}
        except (TypeError, ValueError):
            selected = set()
        is_correct = bool(correct) and selected == correct
        earned = aq.points if is_correct else 0
        total += earned
        max_total += aq.points
        results.append({
            "question_id": q.id,
            "is_correct": is_correct,
            "points": aq.points,
            "points_earned": earned,
            "correct_option_ids": sorted(correct),
            "selected_option_ids": sorted(selected),
        })
    return total, max_total, results


@api_view(["POST"])
@permission_classes([AllowAny])
def submit_quiz(request, token, activity_id):
    """POST /api/v1/site/mon-espace/<token>/quiz/<activity_id>/ → corrige et note.

    Corps : ``{"answers": {"<question_id>": [<option_id>, ...]}}``. Persiste la
    tentative et renvoie le score + le détail (bonnes/mauvaises réponses).
    """
    try:
        user = load_member(token)
    except User.DoesNotExist:
        return Response({"detail": "Lien d'accès invalide ou expiré."}, status=status.HTTP_404_NOT_FOUND)

    from lessonapp.models import Activity
    from material.models import QuizAttempt

    activity = Activity.objects.filter(pk=activity_id, a_type=Activity.QUIZZ).first()
    if activity is None:
        return Response({"detail": "Quiz introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if not _learner_can_access_activity(user, activity):
        return Response({"detail": "Vous n'avez pas accès à ce quiz."}, status=status.HTTP_403_FORBIDDEN)

    answers = request.data.get("answers") or {}
    if not isinstance(answers, dict):
        return Response({"detail": "Format de réponses invalide."}, status=status.HTTP_400_BAD_REQUEST)

    score, max_score, results = _score_quiz(activity, answers)
    QuizAttempt.objects.create(
        learner=user, activity=activity, score=score, max_score=max_score, answers=answers
    )
    _mark_activity(user, activity, True)  # un quiz soumis marque l'activité terminée
    return Response({"score": score, "max_score": max_score, "results": results})


def _mark_activity(user, activity, completed: bool) -> None:
    from material.models import ActivityProgress

    ActivityProgress.objects.update_or_create(
        learner=user, activity=activity, defaults={"completed": completed}
    )


def _publication_progress(user, pub) -> dict:
    """% d'activités terminées sur l'ensemble des thèmes de la formation."""
    from lessonapp.models import Activity
    from material.models import ActivityProgress

    # Même périmètre que le contenu servi (cf. `my_formation`) : sans le filtre
    # is_deleted, une formation supprimée gonflerait le dénominateur et la
    # progression n'atteindrait jamais 100 %.
    live_themes = pub.themes.filter(is_deleted=False)
    live = {"is_deleted": False, "seance__is_deleted": False, "seance__theme__in": live_themes}
    total = Activity.objects.filter(**live).count()
    done = (
        ActivityProgress.objects.filter(
            learner=user, completed=True,
            **{f"activity__{k}": v for k, v in live.items()},
        ).count()
        if user is not None else 0
    )
    return {"done": done, "total": total, "percent": round(100 * done / total) if total else 0}


@api_view(["POST"])
@permission_classes([AllowAny])
def mark_activity(request, token, activity_id):
    """POST /api/v1/site/mon-espace/<token>/activite/<activity_id>/terminer/

    Corps optionnel ``{"done": bool}`` (défaut true) → marque l'activité
    terminée / non terminée pour l'apprenant.
    """
    try:
        user = load_member(token)
    except User.DoesNotExist:
        return Response({"detail": "Lien d'accès invalide ou expiré."}, status=status.HTTP_404_NOT_FOUND)

    from lessonapp.models import Activity

    activity = Activity.objects.filter(pk=activity_id).first()
    if activity is None:
        return Response({"detail": "Activité introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if not _learner_can_access_activity(user, activity):
        return Response({"detail": "Vous n'avez pas accès à cette activité."}, status=status.HTTP_403_FORBIDDEN)

    done = request.data.get("done", True)
    _mark_activity(user, activity, bool(done))
    return Response({"activity_id": activity.id, "completed": bool(done)})


@api_view(["GET"])
@permission_classes([AllowAny])
def agenda_ics(request, token):
    """GET /api/v1/site/mon-espace/<token>/agenda.ics → flux d'abonnement.

    Ce flux est relu périodiquement par l'agenda de l'apprenant (Google, Apple,
    Outlook) : déplacer une séance ou en ajouter une se propage sans qu'il ait
    quoi que ce soit à faire. Google rafraîchit à son rythme, souvent 12 à 24 h —
    on ne peut que le suggérer.

    Les droits sont revérifiés à CHAQUE requête : une inscription annulée ou une
    offre expirée vide le flux, donc une URL fuitée ne survit pas aux droits
    qu'elle représente.
    """
    from calendarapp.models import Meeting

    from .ics import Calendrier

    try:
        user = load_member_calendar(token)
    except User.DoesNotExist:
        return Response({"detail": "Lien d'agenda invalide."}, status=status.HTTP_404_NOT_FOUND)

    inscriptions = (
        Inscription.objects.filter(participant=user, status=Inscription.CONFIRMED, is_deleted=False)
        .select_related("publication")
    )

    cal = Calendrier(
        nom="Mes formations — HBC-RH",
        description="Séances des formations auxquelles vous êtes inscrit(e).",
    )

    vus = set()
    for ins in inscriptions:
        pub = ins.publication
        if not pub or acces_expire(ins):
            continue
        events = (
            pub.events.filter(is_deleted=False, is_active=True)
            .exclude(is_test=True)
            .select_related("seance")
            .order_by("start_time")
        )
        # Une requête pour toutes les visios, plutôt qu'une par créneau.
        meetings = {}
        for m in Meeting.objects.filter(event__in=events, is_deleted=False):
            meetings.setdefault(m.event_id, []).append(m)

        for ev in events:
            if ev.id in vus or not ev.start_time or not ev.end_time:
                continue
            vus.add(ev.id)

            ms = meetings.get(ev.id, [])
            # Le lien qu'on propose de rejoindre, pas un autre rendez-vous du
            # même créneau (cf. l'espace apprenant).
            lien = next((m.link_url for m in ms if m.link_url), "")
            presentiel = any(m.m_type == 2 for m in ms)

            titre = ev.seance.title if ev.seance else ev.title
            if ev.seance and ev.seance.order:
                titre = f"Séance {ev.seance.order} — {titre}"

            # Surtout PAS le lien magique de l'espace : il ouvre tout le contenu.
            # Le jeton d'agenda est distinct précisément pour qu'une fuite du flux
            # n'expose qu'un planning — l'y recopier annulerait ce cloisonnement.
            # L'apprenant a déjà son lien par e-mail.
            corps = [pub.title]
            if lien:
                corps.append(f"Rejoindre : {lien}")

            cal.ajouter(
                # UID stable : c'est lui qui permet à l'agenda de METTRE À JOUR
                # l'événement au lieu d'en créer un second à chaque relecture.
                uid=f"hbc-event-{ev.id}@humanbcorp.com",
                debut=ev.start_time,
                fin=ev.end_time,
                titre=titre,
                description="\n".join(corps),
                lieu=lien or ("Présentiel" if presentiel else ""),
                url=lien,
                modifie_le=getattr(ev, "updated_at", None) or ev.start_time,
                # Toute modification du créneau doit se propager : on dérive la
                # séquence de la date de dernière modification.
                sequence=int(getattr(ev, "updated_at", None).timestamp()) if getattr(ev, "updated_at", None) else 0,
            )

    from django.http import HttpResponse

    resp = HttpResponse(cal.rendu(), content_type="text/calendar; charset=utf-8")
    resp["Content-Disposition"] = 'inline; filename="hbc-formations.ics"'
    # Un flux d'agenda ne doit pas être servi depuis un cache : l'apprenant
    # verrait un planning périmé sans le savoir.
    resp["Cache-Control"] = "no-cache, must-revalidate"
    return resp
