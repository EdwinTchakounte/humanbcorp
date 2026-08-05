from django.apps import AppConfig


class SitecmsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "sitecms"

    def ready(self):
        # Signaux : bump de Theme.content_updated_at à chaque modif de contenu.
        from . import signals
        signals.register()
