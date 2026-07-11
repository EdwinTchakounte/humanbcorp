"""Serializers des modules rapatriés dans le dashboard + JWT enrichi du profil."""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from calendarapp.models import Event, Meeting
from lessonapp.models import Theme, Session, Sequence, Categorie, Classe, Seance, Activity
from contents.models import Publication, Category, Tags, Space
from paiement.models import Paiement
from bucket.models import Inscription, Order
from chat.models import Project, ChatMessage
from .roles import is_admin, profile_payload

PAIEMENT_STATUS = {1: "Réussi", 2: "Échoué", 3: "En attente"}
PAIEMENT_METHOD = {1: "Espèces", 2: "Mobile Money", 3: "PayPal"}
INSCRIPTION_STATUS = {0: "Test", 1: "En attente", 2: "Confirmée", 3: "Annulée"}
ORDER_STATUS = {1: "En attente", 2: "Payée", 3: "Partiellement payée", 4: "Échouée"}


class EventSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    # Rattachement à une formation (lessonapp.Theme) via calendarapp.EventTheme.
    theme = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    theme_id = serializers.SerializerMethodField()
    theme_title = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "title", "description", "start_time", "end_time",
            "is_test", "is_active", "user", "user_name", "created_at",
            "theme", "theme_id", "theme_title",
        ]
        read_only_fields = ["created_at", "user_name"]
        extra_kwargs = {
            "user": {"required": False},
            "description": {"required": False, "allow_blank": True},
        }

    def _event_theme(self, obj):
        from calendarapp.models import EventTheme

        return EventTheme.objects.filter(event=obj).select_related("theme").first()

    def get_theme_id(self, obj):
        et = self._event_theme(obj)
        return et.theme_id if et else None

    def get_theme_title(self, obj):
        et = self._event_theme(obj)
        return et.theme.title if et else None

    def _sync_theme(self, event, theme_id):
        from calendarapp.models import EventTheme
        from lessonapp.models import Theme

        EventTheme.objects.filter(event=event).delete()
        if theme_id:
            t = Theme.objects.filter(pk=theme_id).first()
            if t:
                EventTheme.objects.create(event=event, theme=t, link_url="")

    def create(self, validated_data):
        theme_id = validated_data.pop("theme", None)
        event = super().create(validated_data)
        self._sync_theme(event, theme_id)
        return event

    def update(self, instance, validated_data):
        has_theme = "theme" in validated_data
        theme_id = validated_data.pop("theme", None)
        event = super().update(instance, validated_data)
        if has_theme:
            self._sync_theme(event, theme_id)
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

    class Meta:
        model = Theme
        fields = [
            "id", "title", "is_visible", "t_type", "t_type_label",
            "sequence", "sequence_numero", "session_year",
            "categorie", "categorie_name", "classes_names",
            "seances_count", "image_url", "is_active",
        ]
        # Champs requis à la création uniquement : PATCH partiel reste possible.
        extra_kwargs = {"sequence": {"required": False}, "categorie": {"required": False}}

    def get_t_type_label(self, obj):
        return dict(Theme.TYPES_CHOICES).get(obj.t_type, "—")

    def get_classes_names(self, obj):
        return list(obj.classes.values_list("name", flat=True))

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
        fields = ["id", "title", "theme", "s_type", "s_type_label", "activities_count", "is_active"]

    def get_s_type_label(self, obj):
        return SEANCE_TYPES.get(obj.s_type, "—")

    def get_activities_count(self, obj):
        return obj.activity_set.count()


class ActivitySerializer(serializers.ModelSerializer):
    """Activité d'une séance (authoring). Le `bloc` requis est géré côté vue."""

    a_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = ["id", "title", "seance", "a_type", "a_type_label", "state", "is_active"]
        extra_kwargs = {"state": {"required": False}}

    def get_a_type_label(self, obj):
        return ACTIVITY_TYPES.get(obj.a_type, "—")


class ActivityComponentSerializer(serializers.ModelSerializer):
    """Bloc de contenu (texte + vidéo + image) d'une activité (authoring)."""

    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        from material.models import ActivityComponent

        model = ActivityComponent
        fields = ["id", "activity", "title", "paragraph", "video_url", "image", "image_url", "number"]
        extra_kwargs = {
            "number": {"required": False},
            "title": {"required": False, "allow_blank": True},
            "paragraph": {"required": False, "allow_blank": True, "allow_null": True},
            "video_url": {"required": False, "allow_blank": True, "allow_null": True},
            "image": {"required": False, "allow_null": True, "write_only": True},
        }

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


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

    class Meta:
        model = Publication
        fields = [
            "id", "title", "description", "date", "price", "is_private",
            "categorie", "categorie_name", "tags_names",
            "children_count", "events_count", "image_url",
        ]
        read_only_fields = ["date"]
        extra_kwargs = {"categorie": {"required": False}, "description": {"required": False}}

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
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["profile"] = profile_payload(self.user)
        return data
