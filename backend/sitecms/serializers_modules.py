"""Serializers des modules rapatriés dans le dashboard + JWT enrichi du profil."""

from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from calendarapp.models import Event, Meeting
from lessonapp.models import Theme, Session, Sequence, Categorie, Classe, Seance, Activity
from contents.models import Publication, Category, Tags, Space
from paiement.models import Paiement
from bucket.models import Inscription, Order
from chat.models import Project, ChatMessage
from .roles import is_admin, is_teacher, profile_payload

PAIEMENT_STATUS = {1: "Réussi", 2: "Échoué", 3: "En attente"}
PAIEMENT_METHOD = {1: "Espèces", 2: "Mobile Money", 3: "PayPal"}
INSCRIPTION_STATUS = {0: "Test", 1: "En attente", 2: "Confirmée", 3: "Annulée"}
ORDER_STATUS = {1: "En attente", 2: "Payée", 3: "Partiellement payée", 4: "Échouée"}


class EventSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    # Rattachement à une **cohorte** (contents.Publication) via le M2M
    # `Publication.events`, déjà alimenté par l'application historique. Le
    # calendrier appartient à la session vendue, pas au programme : sinon deux
    # cohortes d'une même formation partagent dates et liens visio.
    publication = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    publication_id = serializers.SerializerMethodField()
    publication_title = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "title", "description", "start_time", "end_time",
            "is_test", "is_active", "user", "user_name", "created_at",
            "publication", "publication_id", "publication_title", "participants_count",
        ]
        read_only_fields = ["created_at", "user_name"]
        extra_kwargs = {
            "user": {"required": False},
            "description": {"required": False, "allow_blank": True},
        }

    def _publication(self, obj):
        # Reverse du M2M `Publication.events` (sans related_name).
        return obj.publication_set.first()

    def get_publication_id(self, obj):
        p = self._publication(obj)
        return p.id if p else None

    def get_publication_title(self, obj):
        p = self._publication(obj)
        return p.title if p else None

    def get_participants_count(self, obj):
        # Participants = apprenants confirmés sur la cohorte de ce créneau.
        p = self._publication(obj)
        if not p:
            return 0
        from bucket.models import Inscription

        return (
            Inscription.objects.filter(
                publication=p, status=Inscription.CONFIRMED, is_deleted=False
            )
            .values("participant")
            .distinct()
            .count()
        )

    def _sync_publication(self, event, publication_id):
        from contents.models import Publication

        # `set()` remplace le rattachement sans détruire l'événement ; un créneau
        # n'appartient qu'à une cohorte à la fois côté back-office.
        if publication_id:
            pub = Publication.objects.filter(pk=publication_id).first()
            event.publication_set.set([pub] if pub else [])
        else:
            event.publication_set.clear()

    def create(self, validated_data):
        publication_id = validated_data.pop("publication", None)
        event = super().create(validated_data)
        self._sync_publication(event, publication_id)
        return event

    def update(self, instance, validated_data):
        has_pub = "publication" in validated_data
        publication_id = validated_data.pop("publication", None)
        event = super().update(instance, validated_data)
        if has_pub:
            self._sync_publication(event, publication_id)
        return event


class MeetingSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source="event.title", read_only=True)

    class Meta:
        model = Meeting
        fields = ["id", "m_type", "link_url", "event", "event_title", "is_active", "created_at"]
        read_only_fields = ["created_at", "event_title"]


# --- Module Formations (lessonapp) ---------------------------------------
class ThemeSerializer(serializers.ModelSerializer):
    """Une « formation » = un Thème (Cours/Examen) rattaché à une séquence/catégorie."""

    t_type_label = serializers.SerializerMethodField()
    categorie_name = serializers.CharField(source="categorie.name", read_only=True)
    session_year = serializers.CharField(source="sequence.session.year", read_only=True)
    sequence_numero = serializers.IntegerField(source="sequence.numero", read_only=True)
    classes_names = serializers.SerializerMethodField()
    seances_count = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    # Écriture : upload image + affectation des classes (lecture via *_names/_url).
    image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    classes = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Classe.objects.all(), required=False
    )
    # Affectation des formateurs (écriture = ids ; lecture détaillée via instructors_detail).
    instructors = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(), required=False
    )
    instructors_detail = serializers.SerializerMethodField()

    class Meta:
        model = Theme
        fields = [
            "id", "title", "is_visible", "t_type", "t_type_label",
            "sequence", "sequence_numero", "session_year",
            "categorie", "categorie_name", "classes", "classes_names",
            "instructors", "instructors_detail",
            "seances_count", "image", "image_url", "is_active",
        ]
        # Champs requis à la création uniquement : PATCH partiel reste possible.
        extra_kwargs = {"sequence": {"required": False}, "categorie": {"required": False}}

    def validate(self, attrs):
        # À la création, séquence + catégorie sont obligatoires (FK non nulles).
        if self.instance is None:
            if not attrs.get("sequence"):
                raise serializers.ValidationError({"sequence": "Séquence requise."})
            if not attrs.get("categorie"):
                raise serializers.ValidationError({"categorie": "Catégorie requise."})
        return attrs

    def get_t_type_label(self, obj):
        return dict(Theme.TYPES_CHOICES).get(obj.t_type, "—")

    def get_classes_names(self, obj):
        return list(obj.classes.values_list("name", flat=True))

    def get_instructors_detail(self, obj):
        return [
            {"id": u.id, "name": (u.get_full_name() or u.username), "email": u.email}
            for u in obj.instructors.all()
        ]

    def get_seances_count(self, obj):
        return obj.seance_set.count()

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


SEANCE_TYPES = {0: "Théorie", 1: "Pratique", 2: "Exercice"}
ACTIVITY_TYPES = {1: "Quiz", 2: "Document (PDF)", 3: "Contenu / Vidéo"}
DOC_TYPES = {1: "Cours", 2: "Exercice", 3: "Réponse", 4: "Correction"}


class SeanceSerializer(serializers.ModelSerializer):
    """Séance d'un thème (authoring dashboard)."""

    s_type_label = serializers.SerializerMethodField()
    activities_count = serializers.SerializerMethodField()

    class Meta:
        model = Seance
        fields = [
            "id", "title", "theme", "s_type", "s_type_label", "activities_count",
            "is_active", "order",
        ]
        # `order` est piloté par la création et l'action `reorder`, jamais saisi.
        read_only_fields = ["order"]

    def get_s_type_label(self, obj):
        return SEANCE_TYPES.get(obj.s_type, "—")

    def get_activities_count(self, obj):
        return obj.activity_set.count()


class ActivitySerializer(serializers.ModelSerializer):
    """Activité d'une séance (authoring). Le `bloc` requis est géré côté vue."""

    a_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = ["id", "title", "seance", "a_type", "a_type_label", "state", "is_active", "order"]
        read_only_fields = ["order"]
        extra_kwargs = {"state": {"required": False}}

    def get_a_type_label(self, obj):
        return ACTIVITY_TYPES.get(obj.a_type, "—")


class ActivityComponentSerializer(serializers.ModelSerializer):
    """Bloc de contenu (texte + vidéo + audio + image) d'une activité (authoring)."""

    image_url = serializers.SerializerMethodField(read_only=True)
    video_file_url = serializers.SerializerMethodField(read_only=True)
    audio_file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        from material.models import ActivityComponent

        model = ActivityComponent
        fields = [
            "id", "activity", "title", "paragraph",
            "video_url", "video_file", "video_file_url",
            "audio_url", "audio_file", "audio_file_url",
            "image", "image_url", "number",
        ]
        extra_kwargs = {
            "number": {"required": False},
            "title": {"required": False, "allow_blank": True},
            "paragraph": {"required": False, "allow_blank": True, "allow_null": True},
            "video_url": {"required": False, "allow_blank": True, "allow_null": True},
            "audio_url": {"required": False, "allow_blank": True, "allow_null": True},
            "image": {"required": False, "allow_null": True, "write_only": True},
            "video_file": {"required": False, "allow_null": True, "write_only": True},
            "audio_file": {"required": False, "allow_null": True, "write_only": True},
        }

    def _abs(self, f):
        if not f:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(f.url) if request else f.url

    def get_image_url(self, obj):
        return self._abs(obj.image)

    def get_video_file_url(self, obj):
        return self._abs(obj.video_file)

    def get_audio_file_url(self, obj):
        return self._abs(obj.audio_file)


class SessionMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ["id", "year"]


class SequenceMiniSerializer(serializers.ModelSerializer):
    session_year = serializers.CharField(source="session.year", read_only=True)

    class Meta:
        model = Sequence
        fields = ["id", "numero", "session", "session_year"]


class CategorieMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ["id", "name"]


class ClasseMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classe
        fields = ["id", "name"]


# --- Module Publications (contents) --------------------------------------
class PublicationSerializer(serializers.ModelSerializer):
    categorie_name = serializers.CharField(source="categorie.name", read_only=True)
    tags_names = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    events_count = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    places_restantes = serializers.SerializerMethodField()
    # Écriture : upload image, lien vers formations (themes), hiérarchie (parent).
    image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    themes = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Theme.objects.filter(is_deleted=False), required=False
    )
    themes_titles = serializers.SerializerMethodField()
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Publication.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Publication
        fields = [
            "id", "title", "description", "date", "price", "is_private",
            "categorie", "categorie_name", "tags_names",
            "themes", "themes_titles", "parent",
            "children_count", "events_count", "image", "image_url",
            "mode", "date_debut", "date_fin", "capacite", "acces_duree_mois",
            "places_restantes",
        ]
        read_only_fields = ["date"]
        extra_kwargs = {"categorie": {"required": False}, "description": {"required": False}}

    def get_places_restantes(self, obj):
        return obj.places_restantes()

    def validate(self, attrs):
        if self.instance is None and not attrs.get("categorie"):
            raise serializers.ValidationError({"categorie": "Catégorie requise."})

        def champ(nom):
            # En PATCH partiel, un champ absent garde sa valeur en base.
            if nom in attrs:
                return attrs[nom]
            return getattr(self.instance, nom, None)

        mode = champ("mode") or Publication.COHORTE
        debut, fin = champ("date_debut"), champ("date_fin")
        if mode == Publication.COHORTE and debut and fin and fin < debut:
            raise serializers.ValidationError(
                {"date_fin": "La fin de session ne peut pas précéder son début."}
            )
        if mode == Publication.LIBRE and (debut or fin):
            raise serializers.ValidationError(
                {"mode": "Une offre en accès libre n'a pas de dates de session."}
            )
        capacite = champ("capacite")
        if capacite is not None and self.instance is not None:
            # Réduire la capacité sous le nombre d'inscrits mettrait la session
            # dans un état incohérent (places restantes négatives).
            from bucket.models import Inscription

            pris = Inscription.objects.filter(
                publication=self.instance, is_deleted=False,
                status__in=[Inscription.WAITING, Inscription.CONFIRMED],
            ).count()
            if capacite < pris:
                raise serializers.ValidationError(
                    {"capacite": f"{pris} personne(s) déjà inscrite(s) : capacité minimale {pris}."}
                )
        return attrs

    def get_themes_titles(self, obj):
        return [{"id": t.id, "title": t.title} for t in obj.themes.all()]

    def get_tags_names(self, obj):
        return list(obj.liste_tags.values_list("name", flat=True))

    def get_children_count(self, obj):
        return obj.children.count()

    def get_events_count(self, obj):
        return obj.events.count()

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class CategoryMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class TagsMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tags
        fields = ["id", "name"]


# --- Module Paiements (paiement) -----------------------------------------
class PaiementSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.username", read_only=True)
    status_label = serializers.SerializerMethodField()
    method_label = serializers.SerializerMethodField()

    class Meta:
        model = Paiement
        fields = [
            "id", "owner", "owner_name", "montant", "status", "status_label",
            "method", "method_label", "tranche", "is_active", "created_at",
        ]
        read_only_fields = ["created_at", "owner_name"]
        extra_kwargs = {"owner": {"required": False}}

    def get_status_label(self, obj):
        return PAIEMENT_STATUS.get(obj.status, "—")

    def get_method_label(self, obj):
        return PAIEMENT_METHOD.get(obj.method, "—")


# --- Module Inscriptions & Paniers (bucket) ------------------------------
class InscriptionSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source="participant.username", read_only=True)
    publication_title = serializers.CharField(source="publication.title", read_only=True)
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = Inscription
        fields = [
            "id", "participant", "participant_name", "publication", "publication_title",
            "status", "status_label", "is_active", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_status_label(self, obj):
        return INSCRIPTION_STATUS.get(obj.status, "—")


class OrderSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source="buyer.username", read_only=True)
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "buyer", "buyer_name", "status", "status_label",
            "total_amount", "is_active", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_status_label(self, obj):
        return ORDER_STATUS.get(obj.status, "—")


# --- Module Messagerie (chat) --------------------------------------------
class ChatProjectSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    messages_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "name", "user", "user_name", "created_at", "messages_count"]
        read_only_fields = ["created_at", "user_name"]
        extra_kwargs = {"user": {"required": False}}

    def get_messages_count(self, obj):
        return obj.chatmessage_set.count()


class ChatMessageSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "project", "project_name", "user", "user_name", "message", "response", "timestamp"]
        read_only_fields = ["timestamp", "user_name", "project_name"]


class ProfileTokenSerializer(TokenObtainPairSerializer):
    """JWT standard + claim `is_admin` dans le token + profil complet dans la réponse."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["is_admin"] = is_admin(user)
        token["is_teacher"] = is_teacher(user)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["profile"] = profile_payload(self.user)
        return data
