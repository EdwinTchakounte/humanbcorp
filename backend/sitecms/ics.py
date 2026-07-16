"""Construction de flux iCalendar (RFC 5545).

Le format paraît trivial et ne l'est pas : les lignes se terminent en CRLF, se
replient à 75 octets — pas 75 caractères, ce qui compte dès qu'il y a un accent —
et cinq caractères doivent être échappés. Une seule de ces règles enfreinte, et
Google Agenda refuse le flux entier sans rien expliquer.

D'où ce module : le format est isolé ici, les vues ne manipulent que des données.
"""
from __future__ import annotations

from datetime import datetime


def echapper(valeur: str) -> str:
    """Échappe une valeur texte iCalendar (RFC 5545 §3.3.11).

    L'ordre compte : la barre oblique inverse d'abord, sinon on échapperait les
    échappements qu'on vient d'ajouter.
    """
    if not valeur:
        return ""
    return (
        str(valeur)
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def plier(ligne: str) -> str:
    """Replie une ligne à 75 OCTETS, la suite préfixée d'une espace (§3.1).

    Le pliage se compte en octets, pas en caractères : un « é » en pèse deux. On
    découpe donc sur les octets, en veillant à ne jamais couper au milieu d'un
    caractère — ce qui produirait un flux invalide.
    """
    octets = ligne.encode("utf-8")
    if len(octets) <= 75:
        return ligne

    morceaux = []
    debut = 0
    limite = 75
    while debut < len(octets):
        fin = min(debut + limite, len(octets))
        # Reculer tant qu'on tombe sur un octet de continuation UTF-8 (10xxxxxx).
        while fin < len(octets) and (octets[fin] & 0xC0) == 0x80:
            fin -= 1
        morceaux.append(octets[debut:fin].decode("utf-8"))
        debut = fin
        limite = 74  # les lignes suivantes perdent un octet pour l'espace initiale
    return "\r\n ".join(morceaux)


def horodatage(dt: datetime) -> str:
    """Date-heure UTC au format iCalendar : 20260812T140000Z.

    `timezone.utc` a disparu de Django 5 : on prend celui de la bibliothèque
    standard, qui est de toute façon la bonne source.
    """
    from datetime import timezone as tz_std

    from django.utils import timezone

    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, tz_std.utc)
    return dt.astimezone(tz_std.utc).strftime("%Y%m%dT%H%M%SZ")


class Calendrier:
    """Assemble un flux iCalendar. `nom` s'affiche comme titre de l'agenda."""

    def __init__(self, nom: str, description: str = "", ttl_heures: int = 6):
        self.lignes: list[str] = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Human Brain Corporation-RH//Espace apprenant//FR",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            f"X-WR-CALNAME:{echapper(nom)}",
            "X-WR-TIMEZONE:UTC",
            # Fréquence de rafraîchissement souhaitée. Les deux formes coexistent :
            # REFRESH-INTERVAL est la norme, X-PUBLISHED-TTL ce que lisent encore
            # Outlook et quelques autres. Ce ne sont que des suggestions — Google
            # rafraîchit à son propre rythme, souvent 12 à 24 h.
            f"REFRESH-INTERVAL;VALUE=DURATION:PT{ttl_heures}H",
            f"X-PUBLISHED-TTL:PT{ttl_heures}H",
        ]
        if description:
            self.lignes.append(f"X-WR-CALDESC:{echapper(description)}")

    def ajouter(
        self,
        *,
        uid: str,
        debut: datetime,
        fin: datetime,
        titre: str,
        description: str = "",
        lieu: str = "",
        url: str = "",
        modifie_le: datetime | None = None,
        sequence: int = 0,
    ) -> None:
        e = [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{horodatage(modifie_le or debut)}",
            f"DTSTART:{horodatage(debut)}",
            f"DTEND:{horodatage(fin)}",
            f"SUMMARY:{echapper(titre)}",
            # SEQUENCE doit croître à chaque modification, sinon les agendas
            # conservent l'ancienne version de l'événement.
            f"SEQUENCE:{sequence}",
            "STATUS:CONFIRMED",
            "TRANSP:OPAQUE",
        ]
        if description:
            e.append(f"DESCRIPTION:{echapper(description)}")
        if lieu:
            e.append(f"LOCATION:{echapper(lieu)}")
        if url:
            # URL n'est pas une valeur texte : elle ne s'échappe pas.
            e.append(f"URL:{url}")
        e.append("END:VEVENT")
        self.lignes.extend(e)

    def rendu(self) -> str:
        return "\r\n".join(plier(l) for l in [*self.lignes, "END:VCALENDAR"]) + "\r\n"
