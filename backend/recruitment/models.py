"""Domaine recrutement : offres d'emploi (`JobOffer`) et candidatures publiques
(`Application`).

Le modèle est **autonome** (aucune dépendance au reste du projet) et les
candidatures sont ouvertes aux visiteurs non authentifiés : une `Application`
n'est donc PAS rattachée à un `User`, seulement à des coordonnées libres + un CV.
"""
from __future__ import annotations

from django.db import models
from django.utils.text import slugify


class JobOffer(models.Model):
    """Offre d'emploi publiée sur la vitrine."""

    class Contract(models.TextChoices):
        CDI = "CDI", "CDI"
        CDD = "CDD", "CDD"
        STAGE = "STAGE", "Stage"
        ALTERNANCE = "ALTERNANCE", "Alternance"
        FREELANCE = "FREELANCE", "Freelance / Mission"

    class Plan(models.TextChoices):
        CLASSIC = "classic", "Classique"
        PREMIUM = "premium", "Premium"

    title = models.CharField("Intitulé du poste", max_length=200)
    slug = models.SlugField("Slug", max_length=220, unique=True, blank=True)
    department = models.CharField("Département / Pôle", max_length=120, blank=True)
    location = models.CharField("Lieu", max_length=120, blank=True, default="Douala — Cameroun")
    contract_type = models.CharField(
        "Type de contrat", max_length=20, choices=Contract.choices, default=Contract.CDI
    )
    salary = models.CharField("Rémunération", max_length=120, blank=True)
    description = models.TextField("Description du poste")
    profile = models.TextField("Profil recherché", blank=True)
    is_published = models.BooleanField("Publiée", default=True)
    closing_date = models.DateField("Date de clôture", null=True, blank=True)

    # --- Compte recruteur propriétaire ------------------------------------
    # Le compte (groupe Recruiter) autorisé à SUIVRE cette offre en lecture
    # seule depuis son espace. `null` = offre gérée par HBC en propre, sans
    # espace client. C'est le super-admin qui attribue l'offre à un recruteur ;
    # celui-ci ne peut ni la créer ni la modifier (étape intermédiaire).
    owner = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="job_offers", verbose_name="Recruteur (compte de suivi)",
    )

    # --- Entreprise qui recrute -------------------------------------------
    # Renseignée ou non : c'est elle qui décide de l'accroche du flyer
    # (« UCB recrute… » vs « Une entreprise recrute… »).
    company_name = models.CharField("Nom de l'entreprise", max_length=150, blank=True)
    company_logo = models.ImageField(
        "Logo de l'entreprise", upload_to="entreprises/%Y/%m", null=True, blank=True
    )
    company_website = models.URLField("Site de l'entreprise", blank=True)

    # --- Offre commerciale -------------------------------------------------
    # L'anonymat est le mode par défaut (gratuit) ; l'abonnement premium
    # débloque l'identité de l'entreprise, la candidature directe et la mise
    # en avant. C'est ce qui est monétisé.
    plan = models.CharField(
        "Formule", max_length=10, choices=Plan.choices, default=Plan.CLASSIC
    )
    is_featured = models.BooleanField("Mise en avant", default=False)

    # --- Destination des candidatures --------------------------------------
    # En premium, si l'un de ces canaux est renseigné, le candidat postule
    # DIRECTEMENT chez l'entreprise ; sinon la candidature transite par la
    # plateforme (formulaire + CV côté HBC-RH).
    apply_email = models.EmailField("E-mail de candidature (direct)", blank=True)
    apply_url = models.URLField("Lien de candidature (direct)", blank=True)

    # --- Champs affichés sur le flyer et la page ---------------------------
    # Le recruteur active/désactive ce qu'il veut montrer ; le flyer et le
    # formulaire s'adaptent à ce qui reste.
    show_company = models.BooleanField("Afficher l'entreprise", default=True)
    show_salary = models.BooleanField("Afficher la rémunération", default=True)
    show_location = models.BooleanField("Afficher le lieu", default=True)
    show_contract = models.BooleanField("Afficher le type de contrat", default=True)
    show_department = models.BooleanField("Afficher le département", default=True)
    show_closing_date = models.BooleanField("Afficher la date de clôture", default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Offre d'emploi"
        verbose_name_plural = "Offres d'emploi"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or "offre"
            slug = base
            i = 2
            while JobOffer.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------
    # Règles d'affichage et de candidature.
    # Centralisées ici pour que l'API, le flyer et le dashboard racontent
    # exactement la même chose — une divergence se verrait sur le partage.
    # ------------------------------------------------------------------
    @property
    def is_premium(self) -> bool:
        return self.plan == self.Plan.PREMIUM

    @property
    def company_display(self):
        """Nom de l'entreprise si elle peut être révélée, sinon None.

        L'identité n'est dévoilée qu'en premium ET si le recruteur l'a
        activée : en formule classique l'offre reste anonyme, c'est
        précisément ce que l'abonnement débloque.
        """
        if self.is_premium and self.show_company and self.company_name.strip():
            return self.company_name.strip()
        return None

    @property
    def headline(self) -> str:
        """Accroche du flyer : « UCB recrute » ou « Une entreprise recrute »."""
        return f"{self.company_display or 'Une entreprise'} recrute"

    @property
    def apply_mode(self) -> str:
        """`direct` (vers l'entreprise) ou `platform` (formulaire HBC-RH)."""
        if self.is_premium and (self.apply_email or self.apply_url):
            return "direct"
        return "platform"

    @property
    def apply_target(self):
        """Destination de candidature en mode direct : lien externe prioritaire."""
        if self.apply_mode != "direct":
            return None
        return self.apply_url or f"mailto:{self.apply_email}"

    def visible_fields(self) -> dict:
        """Champs réellement montrables : activés ET renseignés.

        Le flyer se compose à partir de ça : un champ désactivé ou vide ne
        laisse pas de trou dans la maquette, elle se resserre.
        """
        return {
            "company": self.company_display,
            "salary": self.salary.strip() if (self.show_salary and self.salary) else None,
            "location": self.location.strip() if (self.show_location and self.location) else None,
            "contract": self.get_contract_type_display() if self.show_contract else None,
            "department": self.department.strip() if (self.show_department and self.department) else None,
            "closing_date": self.closing_date if self.show_closing_date else None,
        }


def cv_upload_to(instance, filename):
    # cv/2026/07/<slug-ou-spontanee>-<nom>.<ext>
    from django.utils import timezone  # import local (Date.now indispo côté script)

    now = timezone.now()
    return f"cv/{now:%Y/%m}/{filename}"


class Application(models.Model):
    """Candidature déposée par un visiteur (sur une offre ou spontanée).

    Suivi RH réservé au **super-admin plateforme** (aucun rattachement à un
    espace/tenant) : un pipeline par étapes, une évaluation, un recruteur
    affecté et un fil de notes internes (`ApplicationNote`).
    """

    class Status(models.IntegerChoices):
        NEW = 0, "Nouvelle"
        REVIEWED = 1, "Vue"
        SHORTLISTED = 2, "Présélectionnée"
        REJECTED = 3, "Rejetée"
        # Étapes ajoutées pour un vrai pipeline de recrutement.
        INTERVIEW = 4, "Entretien"
        HIRED = 5, "Recrutée"

    # Ordre d'avancement du pipeline (le rejet est un état terminal, hors file).
    PIPELINE_ORDER = [Status.NEW, Status.REVIEWED, Status.SHORTLISTED, Status.INTERVIEW, Status.HIRED]

    offer = models.ForeignKey(
        JobOffer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
        help_text="Vide = candidature spontanée.",
    )
    first_name = models.CharField("Prénom", max_length=100)
    last_name = models.CharField("Nom", max_length=100, blank=True)
    email = models.EmailField("Email")
    phone = models.CharField("Téléphone", max_length=30, blank=True)
    cover_letter = models.TextField("Lettre de motivation", blank=True)
    cv = models.FileField("CV", upload_to=cv_upload_to)
    status = models.IntegerField("Statut", choices=Status.choices, default=Status.NEW)
    # Évaluation du recruteur (0–5 ; vide = non évaluée).
    rating = models.PositiveSmallIntegerField("Évaluation", null=True, blank=True)
    # Recruteur en charge du suivi (un membre du staff plateforme).
    assigned_to = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="recruitment_applications",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField("Dernière activité", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Candidature"
        verbose_name_plural = "Candidatures"

    def __str__(self):
        cible = self.offer.title if self.offer else "Candidature spontanée"
        return f"{self.full_name} — {cible}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class ApplicationNote(models.Model):
    """Note interne d'un recruteur sur une candidature (fil chronologique)."""

    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="notes"
    )
    author = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, related_name="+"
    )
    body = models.TextField("Note")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Note de candidature"
        verbose_name_plural = "Notes de candidature"

    def __str__(self):
        return f"Note {self.pk} — candidature {self.application_id}"
