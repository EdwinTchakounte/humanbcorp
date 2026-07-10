"""Amorce le contenu du site dans le CMS.

Reconstruit fidèlement la page **Accueil** (hero, stats, à propos, services,
galerie, chiffres-clés, pourquoi nous, contact) à partir du contenu actuel de
`home.html`, crée les **pages secondaires** (À propos, Services, Réalisations,
Blog, Recrutement, Équipe, Contact) et renseigne les **réglages du site**.

Les images sont retrouvées par `title` dans MediaAsset → lancer d'abord
`python manage.py import_media`.

Usage :
    python manage.py seed_site           # crée ce qui manque
    python manage.py seed_site --force   # reconstruit le contenu (efface sections/cards)
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from sitecms.models import Article, Card, MediaAsset, Page, Section, SiteSettings


def media(title):
    return MediaAsset.objects.filter(title=title).first()


class Command(BaseCommand):
    help = "Amorce pages / sections / cards / réglages du site HBC-RH."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Reconstruit le contenu des pages existantes.")

    @transaction.atomic
    def handle(self, *args, **opts):
        self.force = opts["force"]
        self._settings()
        self._home()
        self._secondary_pages()
        self._articles()
        self._translate()
        self.stdout.write(self.style.SUCCESS(
            f"Seed terminé : {Page.objects.count()} pages, {Section.objects.count()} sections, {Card.objects.count()} cards."
        ))

    # -- helpers ---------------------------------------------------------
    def _page(self, slug, title, order, nav_label=None, show_in_nav=True,
              meta_title="", meta_description=""):
        page, created = Page.objects.get_or_create(slug=slug, defaults={
            "title": title, "nav_label": nav_label or title, "order": order,
            "show_in_nav": show_in_nav, "meta_title": meta_title, "meta_description": meta_description,
        })
        if not created and self.force:
            page.sections.all().delete()
        self._build = created or self.force
        return page

    def _section(self, page, type, order, **kw):
        cards = kw.pop("cards", [])
        sec = Section.objects.create(page=page, type=type, order=order, **kw)
        for i, c in enumerate(cards):
            Card.objects.create(section=sec, order=i, **c)
        return sec

    # -- réglages --------------------------------------------------------
    def _settings(self):
        s = SiteSettings.load()
        s.brand_name = "Human Brain Corporation-RH"
        s.slogan = "Libérer le potentiel humain"
        s.tagline = "Transformez vos défis RH en opportunités"
        s.address = "300, Rue Foucault, Akwa-Douala"
        s.phones = "+237 696 305 891, +237 678 623 424, +237 656 275 091"
        s.email = "recrutementhbcrh@gmail.com"
        s.city = "Douala, Cameroun"
        s.whatsapp = "237696305891"
        s.default_meta_title = "Human Brain Corporation-RH | Libérer le potentiel humain"
        s.default_meta_description = (
            "HBC-RH, votre partenaire stratégique en ressources humaines à Douala : "
            "recrutement local et international, management des talents, formation & coaching, "
            "externalisation RH."
        )
        s.save()
        self.stdout.write("  ✓ Réglages du site")

    # -- accueil ---------------------------------------------------------
    def _home(self):
        page = self._page(
            "accueil", "Human Brain Corporation-RH | Libérer le potentiel humain", 0,
            nav_label="Accueil",
            meta_title="Human Brain Corporation-RH | Libérer le potentiel humain",
            meta_description=(
                "Partenaire stratégique RH à Douala : recrutement, management des talents, "
                "formation & coaching, externalisation RH."
            ),
        )
        if not self._build:
            return

        # 1. HERO
        self._section(
            page, Section.Type.HERO, 0,
            anchor="accueil",
            eyebrow="Recrutement · Talents · Formation · Externalisation RH",
            title="Libérer le potentiel humain",
            subtitle=(
                "Human Brain Corporation-RH, votre partenaire stratégique en ressources humaines "
                "à Douala et à l'international. Nous transformons vos défis RH en opportunités."
            ),
            bg_image=media("ev07-wide"), parallax=True, wave=True,
            options={
                "accent_word": "potentiel humain",
                "cta": [
                    {"label": "Demander un rendez-vous", "style": "accent", "href": "/contact"},
                    {"label": "Découvrir nos services", "style": "outline-light", "href": "/services"},
                ],
            },
            cards=[
                # Slides du carrousel (cartes avec image, role=slide)
                {"title": "Recrutement local & international", "image": media("ev07-wide"), "extra": {"role": "slide"}},
                {"title": "Formation & coaching", "image": media("ev05-wide"), "extra": {"role": "slide"}},
                {"title": "Management des talents", "image": media("ev06-wide"), "extra": {"role": "slide"}},
                {"title": "Externalisation RH", "image": media("ev02-wide"), "extra": {"role": "slide"}},
                # Badges (cartes avec icône, role=badge)
                {"title": "Réseau mondial de talents", "icon": "bx-globe", "extra": {"role": "badge"}},
                {"title": "Réponse sous 24h", "icon": "bx-time-five", "extra": {"role": "badge"}},
                {"title": "Conformité RH sécurisée", "icon": "bx-shield-quarter", "extra": {"role": "badge"}},
            ],
        )

        # 2. STATS
        self._section(
            page, Section.Type.STATS, 1,
            cards=[
                {"title": "Pôles d'expertise RH", "extra": {"value": "4"}},
                {"title": "Délai de réponse", "extra": {"value": "24H"}},
                {"title": "Conformité RH visée", "extra": {"value": "100%"}},
                {"title": "Talents à portée", "extra": {"value": "∞"}},
            ],
        )

        # 3. À PROPOS (bg_image = photo latérale)
        self._section(
            page, Section.Type.ABOUT, 2,
            anchor="about",
            eyebrow="À propos de nous",
            title="Votre partenaire stratégique en ressources humaines",
            body=(
                "Pionnier dans l'accompagnement RH, HBC-RH déniche les profils rares à travers le "
                "monde, forme vos équipes à performer durablement et sécurise votre conformité RH. "
                "Des résultats tangibles, au quotidien."
            ),
            bg_image=media("ev06-wide"),
            options={
                "badge": {"line1": "Douala · Cameroun", "line2": "HBC-RH", "line3": "Ressources humaines"},
                "buttons": [
                    {"label": "Discuter sur WhatsApp", "style": "brand", "href": "https://wa.me/237696305891"},
                    {"label": "Demander un devis", "style": "outline-brand", "href": "/contact"},
                ],
            },
            cards=[
                # Diapo d'images (role=slide)
                {"title": "Formation HBC-RH", "image": media("ev06-wide"), "extra": {"role": "slide"}},
                {"title": "Atelier RH", "image": media("ev11-wide"), "extra": {"role": "slide"}},
                {"title": "Coaching d'équipe", "image": media("ev10-wide"), "extra": {"role": "slide"}},
                # Progression / info-boxes (role=step)
                {"title": "Un réseau mondial de talents", "icon": "bx-globe",
                 "text": "Nous sourçons localement et à l'international.", "extra": {"role": "step"}},
                {"title": "Des solutions RH sur mesure", "icon": "bx-cog",
                 "text": "Adaptées à chaque contexte d'entreprise.", "extra": {"role": "step"}},
                {"title": "Un accompagnement juridique complet", "icon": "bx-shield-quarter",
                 "text": "Droit social, conformité, administration RH.", "extra": {"role": "step"}},
            ],
        )

        # 4. SERVICES
        self._section(
            page, Section.Type.SERVICES, 3,
            anchor="services",
            eyebrow="Nos expertises",
            title="Quatre pôles pour vos défis RH",
            subtitle="Un accompagnement complet pour attirer, développer et fidéliser vos talents.",
            bg_color="soft",
            cards=[
                {"title": "Recrutement local & international", "icon": "bx-target-lock",
                 "text": "Sourcing local ou international, onboarding et outboarding pour attirer les meilleurs profils."},
                {"title": "Management des talents", "icon": "bx-group",
                 "text": "Diagnostic RH, évaluation des compétences et plans de développement des équipes."},
                {"title": "Formation & coaching", "icon": "bx-book-reader",
                 "text": "Évaluation des besoins, coaching individuel et collectif, suivi des progrès dans la durée."},
                {"title": "Externalisation RH", "icon": "bx-briefcase-alt-2",
                 "text": "Conseil en droit social, conformité RH, administration du personnel et gestion de la paie."},
            ],
        )

        # 5. GALERIE (exploite un large jeu de photos)
        gallery_imgs = [
            ("ev02-wide", "Atelier RH HBC-RH", "tall"),
            ("ev03-card", "Séminaire recrutement", "half"),
            ("ev05-card", "Formation professionnelle", "half"),
            ("ev08-card", "Coaching d'équipe", "third"),
            ("ev10-card", "Public en formation", "third"),
            ("ev11-card", "Intervention HBC-RH", "third"),
            ("ev01-card", "Session HBC-RH", "third"),
            ("ev04-card", "Échanges en atelier", "third"),
            ("ev09-card", "Formation en salle", "third"),
        ]
        self._section(
            page, Section.Type.GALLERY, 4,
            anchor="galerie",
            eyebrow="Sur le terrain",
            title="Nos formations & ateliers en action",
            subtitle="Séminaires recrutement, coaching et ateliers RH animés par nos experts.",
            options={"limit": 8, "more": "/realisations"},
            cards=[
                {"title": alt, "image": media(t), "extra": {"span": span}}
                for t, alt, span in gallery_imgs if media(t)
            ],
        )

        # 6. (MILESTONE retiré — doublon des statistiques du haut)

        # 7. POURQUOI NOUS (features)
        self._section(
            page, Section.Type.FEATURES, 6,
            anchor="pourquoi",
            eyebrow="Pourquoi nous ?",
            title="Ce qui fait la différence",
            subtitle="Un réseau mondial de talents, des solutions sur mesure et un accompagnement de bout en bout.",
            bg_color="soft",
            cards=[
                {"title": "Expertise éprouvée", "icon": "bxs-badge-check",
                 "text": "Un savoir-faire RH reconnu et des méthodes structurées."},
                {"title": "Solutions innovantes & sur mesure", "icon": "bx-bulb",
                 "text": "Des réponses adaptées à chaque contexte d'entreprise."},
                {"title": "Accompagnement complet", "icon": "bx-support",
                 "text": "Un partenaire disponible, de l'analyse du besoin au suivi des résultats."},
            ],
        )

        # 8. CTA de clôture (le formulaire de contact vit sur la page /contact)
        self._section(
            page, Section.Type.CTA, 7,
            eyebrow="Passons à l'action",
            title="Transformez vos défis RH en opportunités",
            subtitle="Parlons de votre besoin — nous vous recontactons sous 24h.",
            options={"cta": [
                {"label": "Nous contacter", "style": "accent", "href": "/contact"},
                {"label": "Voir nos services", "style": "outline-light", "href": "/services"},
            ]},
        )
        self.stdout.write("  ✓ Page Accueil (7 sections)")

    # -- traductions anglaises ------------------------------------------
    def _translate(self):
        """Remplit les champs *_en depuis un dictionnaire FR→EN (fallback FR sinon)."""
        M = TRANSLATIONS

        s = SiteSettings.load()
        s.slogan_en = M.get(s.slogan, "")
        s.tagline_en = M.get(s.tagline, "")
        s.save()

        for p in Page.objects.all():
            p.title_en = M.get(p.title, "")
            p.nav_label_en = M.get(p.nav_label, "")
            p.meta_title_en = M.get(p.meta_title, "")
            p.meta_description_en = M.get(p.meta_description, "")
            p.save()

        for sec in Section.objects.all():
            sec.eyebrow_en = M.get(sec.eyebrow, "")
            sec.title_en = M.get(sec.title, "")
            sec.subtitle_en = M.get(sec.subtitle, "")
            sec.body_en = M.get(sec.body, "")
            sec.save()

        for c in Card.objects.all():
            c.title_en = M.get(c.title, "")
            c.text_en = M.get(c.text, "")
            c.save()

        for a in Article.objects.all():
            a.title_en = M.get(a.title, "")
            a.excerpt_en = M.get(a.excerpt, "")
            a.save()

        self.stdout.write("  ✓ Traductions EN")

    # -- pages secondaires ----------------------------------------------
    def _hero(self, page, title, htitle, hsub, image="ev02-wide"):
        self._section(
            page, Section.Type.HERO, 0, anchor=page.slug,
            eyebrow=title, title=htitle, subtitle=hsub,
            bg_image=media(image), parallax=True, wave=True,
        )

    def _cta(self, page, order, title, subtitle):
        self._section(
            page, Section.Type.CTA, order,
            eyebrow="Passons à l'action", title=title, subtitle=subtitle,
            options={"cta": [
                {"label": "Nous contacter", "style": "accent", "href": "/contact"},
                {"label": "Voir nos services", "style": "outline-light", "href": "/services"},
            ]},
        )

    def _contact_section(self, page, order):
        self._section(
            page, Section.Type.CONTACT, order, anchor="form",
            eyebrow="Écrivez-nous", title="Demander un rendez-vous",
            subtitle="Nous vous recontactons sous 24h.",
            options={"form": True},
            cards=[
                {"title": "300, Rue Foucault, Akwa-Douala", "icon": "bxs-map"},
                {"title": "+237 696 305 891 / +237 678 623 424", "icon": "bxs-phone"},
                {"title": "recrutementhbcrh@gmail.com", "icon": "bxs-envelope"},
            ],
        )

    def _secondary_pages(self):
        specs = [
            ("a-propos", "À propos", 1), ("services", "Services", 2),
            ("realisations", "Réalisations", 3), ("blog", "Blog", 4),
            ("recrutement", "Recrutement", 5), ("equipe", "Équipe", 6),
            ("contact", "Contact", 7),
        ]
        for slug, title, order in specs:
            page = self._page(slug, title, order)
            if not self._build:
                continue
            getattr(self, f"_page_{slug.replace('-', '_')}")(page)
        self.stdout.write("  ✓ Pages secondaires (contenu complet)")

    # -- contenu par page (données par défaut, éditables via le CMS) ------
    def _page_a_propos(self, page):
        self._hero(page, "À propos", "Qui sommes-nous ?",
                   "Pionnier de l'accompagnement RH à Douala, au service de votre performance humaine.", "ev06-wide")
        self._section(
            page, Section.Type.ABOUT, 1, anchor="histoire",
            eyebrow="Notre histoire", title="Un partenaire RH de confiance",
            body=("Human Brain Corporation-RH accompagne entreprises et organisations dans toutes leurs "
                  "problématiques de ressources humaines. De la recherche des profils rares à la formation "
                  "des équipes, en passant par la conformité, nous transformons vos défis RH en leviers de "
                  "croissance. Notre approche : l'écoute, la rigueur et des résultats mesurables."),
            bg_image=media("ev06-wide"),
            options={"badge": {"line1": "Depuis", "line2": "2020+", "line3": "à Douala"}},
            cards=[
                {"title": "Formation HBC-RH", "image": media("ev06-wide"), "extra": {"role": "slide"}},
                {"title": "Atelier RH", "image": media("ev11-wide"), "extra": {"role": "slide"}},
                {"title": "Vision", "icon": "bx-target-lock",
                 "text": "Libérer le potentiel humain de chaque organisation.", "extra": {"role": "step"}},
                {"title": "Mission", "icon": "bx-briefcase-alt-2",
                 "text": "Attirer, développer et fidéliser les talents.", "extra": {"role": "step"}},
                {"title": "Engagement", "icon": "bx-check-shield",
                 "text": "Des résultats tangibles et une conformité sécurisée.", "extra": {"role": "step"}},
            ],
        )
        self._section(
            page, Section.Type.FEATURES, 2, eyebrow="Nos valeurs", title="Ce qui nous anime",
            subtitle="Des principes forts au cœur de chaque accompagnement.", bg_color="soft",
            cards=[
                {"title": "Excellence", "icon": "bxs-badge-check", "text": "Des méthodes structurées et éprouvées."},
                {"title": "Proximité", "icon": "bx-conversation", "text": "Une écoute réelle de vos besoins."},
                {"title": "Innovation", "icon": "bx-bulb", "text": "Des solutions RH sur mesure et modernes."},
                {"title": "Intégrité", "icon": "bx-shield-quarter", "text": "Confidentialité et conformité garanties."},
            ],
        )
        self._cta(page, 3, "Envie d'en savoir plus ?", "Discutons de votre projet RH.")

    def _page_services(self, page):
        self._hero(page, "Services", "Nos quatre pôles d'expertise RH",
                   "Un accompagnement complet pour attirer, développer et fidéliser vos talents.", "ev05-wide")
        self._section(
            page, Section.Type.SERVICES, 1, eyebrow="Nos expertises",
            title="Quatre pôles pour vos défis RH", bg_color="soft",
            cards=[
                {"title": "Recrutement local & international", "icon": "bx-target-lock",
                 "text": "Sourcing local ou international, onboarding et outboarding pour attirer les meilleurs profils."},
                {"title": "Management des talents", "icon": "bx-group",
                 "text": "Diagnostic RH, évaluation des compétences et plans de développement des équipes."},
                {"title": "Formation & coaching", "icon": "bx-book-reader",
                 "text": "Évaluation des besoins, coaching individuel et collectif, suivi des progrès dans la durée."},
                {"title": "Externalisation RH", "icon": "bx-briefcase-alt-2",
                 "text": "Conseil en droit social, conformité RH, administration du personnel et gestion de la paie."},
            ],
        )
        self._section(
            page, Section.Type.FEATURES, 2, eyebrow="Notre méthode",
            title="Un accompagnement en 3 temps",
            subtitle="De l'analyse du besoin au suivi des résultats.",
            cards=[
                {"title": "1 · Diagnostic", "icon": "bx-search-alt", "text": "Nous analysons votre contexte et vos objectifs RH."},
                {"title": "2 · Déploiement", "icon": "bx-cog", "text": "Nous mettons en œuvre la solution adaptée."},
                {"title": "3 · Suivi", "icon": "bx-line-chart", "text": "Nous mesurons les résultats et ajustons."},
            ],
        )
        self._cta(page, 3, "Un besoin précis ?", "Parlons-en dès aujourd'hui.")

    def _page_realisations(self, page):
        self._hero(page, "Réalisations", "Nos formations & ateliers en action",
                   "Retour en images sur nos séminaires, formations et interventions.", "ev11-wide")
        imgs = list(MediaAsset.objects.filter(tags__icontains="terrain").order_by("order")[:20])
        imgs += list(MediaAsset.objects.filter(tags__icontains="wide").order_by("order")[:16])
        self._section(
            page, Section.Type.GALLERY, 1, eyebrow="Galerie", title="Toutes nos réalisations",
            subtitle="Séminaires, formations, ateliers et coaching sur le terrain.",
            cards=[{"title": m.alt, "image": m} for m in imgs[:32]],
        )
        self._cta(page, 2, "Envie d'un accompagnement sur mesure ?", "Contactez notre équipe.")

    def _page_blog(self, page):
        # Le hero + le CTA sont éditables ; la liste d'articles vient du modèle Article.
        self._hero(page, "Blog", "Actualités & conseils RH",
                   "Articles, tendances et bonnes pratiques pour vos ressources humaines.", "ev08-wide")
        self._cta(page, 1, "Une question RH ?", "Nos experts vous répondent.")

    def _page_recrutement(self, page):
        self._hero(page, "Recrutement", "Offres & candidatures",
                   "Rejoignez notre réseau de talents ou confiez-nous vos recrutements.", "ev07-wide")
        self._section(
            page, Section.Type.FEATURES, 1, eyebrow="Nous rejoindre",
            title="Pourquoi travailler avec nous", bg_color="soft",
            cards=[
                {"title": "Missions à impact", "icon": "bx-rocket", "text": "Des projets RH variés et stimulants."},
                {"title": "Réseau international", "icon": "bx-globe", "text": "Des opportunités locales et à l'étranger."},
                {"title": "Développement", "icon": "bx-trending-up", "text": "Un accompagnement de carrière continu."},
            ],
        )
        self._section(
            page, Section.Type.SERVICES, 2, eyebrow="Offres du moment",
            title="Postes ouverts",
            cards=[
                {"title": "Chargé(e) de recrutement", "text": "Douala · CDI — sourcing et suivi candidats.",
                 "image": media("ev04-card"), "link": "/contact", "link_label": "Postuler"},
                {"title": "Consultant(e) RH", "text": "Douala · Mission — conseil et conformité.",
                 "image": media("ev09-card"), "link": "/contact", "link_label": "Postuler"},
                {"title": "Formateur(trice)", "text": "Terrain · Freelance — animation d'ateliers.",
                 "image": media("ev01-card"), "link": "/contact", "link_label": "Postuler"},
            ],
        )
        self._cta(page, 3, "Vous recrutez ?", "Confiez-nous votre recherche de talents.")

    def _page_equipe(self, page):
        self._hero(page, "Équipe", "Les femmes & les hommes de HBC-RH",
                   "Une équipe d'experts passionnés par le potentiel humain.", "ev10-wide")
        members = [
            ("Direction", "Stratégie & vision", "ev06-card"),
            ("Pôle Recrutement", "Sourcing & sélection", "ev07-card"),
            ("Pôle Formation", "Coaching & ateliers", "ev05-card"),
            ("Pôle Conformité", "Droit social & paie", "ev03-card"),
        ]
        self._section(
            page, Section.Type.SERVICES, 1, eyebrow="Notre équipe", title="Des experts à votre écoute",
            subtitle="Chaque pôle est animé par des spécialistes dédiés.",
            cards=[
                {"title": n, "text": r, "image": media(im)}
                for n, r, im in members if media(im)
            ],
        )
        self._section(
            page, Section.Type.FEATURES, 2, eyebrow="Notre culture", title="Ce qui nous rassemble",
            bg_color="soft",
            cards=[
                {"title": "Passion", "icon": "bx-heart", "text": "L'humain au centre de tout."},
                {"title": "Exigence", "icon": "bxs-badge-check", "text": "La qualité à chaque étape."},
                {"title": "Esprit d'équipe", "icon": "bx-group", "text": "Ensemble, on va plus loin."},
            ],
        )
        self._cta(page, 3, "Envie de nous rejoindre ?", "Consultez nos offres.")

    def _page_contact(self, page):
        self._hero(page, "Contact", "Contactez-nous",
                   "Parlons de votre besoin RH — réponse sous 24h.", "ev02-wide")
        self._contact_section(page, 1)

    # -- articles de blog par défaut ------------------------------------
    def _articles(self):
        if not self.force and Article.objects.exists():
            return
        if self.force:
            Article.objects.all().delete()
        posts = [
            ("5 clés pour réussir vos recrutements",
             "Attirer et sélectionner les bons profils dans un marché du travail tendu.",
             "Recrutement", "ev07-card", date(2026, 6, 20)),
            ("Fidéliser ses talents durablement",
             "Les leviers d'engagement qui font vraiment la différence au quotidien.",
             "Management", "ev05-card", date(2026, 6, 5)),
            ("La conformité RH sans stress",
             "Comprendre vos obligations en droit social et sécuriser votre entreprise.",
             "Conformité", "ev03-card", date(2026, 5, 22)),
            ("Réussir l'onboarding de vos recrues",
             "Les premières semaines déterminent l'engagement et la rétention.",
             "Recrutement", "ev10-card", date(2026, 5, 8)),
            ("Former pour performer durablement",
             "Bâtir un plan de formation à fort impact et mesurable.",
             "Formation", "ev08-card", date(2026, 4, 18)),
            ("Externaliser sa paie : mode d'emploi",
             "Gagner en sérénité, en fiabilité et en temps sur votre gestion RH.",
             "Externalisation", "ev02-card", date(2026, 4, 2)),
        ]
        body_tpl = (
            "{intro}\n\n"
            "Chez HBC-RH, nous accompagnons chaque jour des organisations sur ces sujets. "
            "Voici les points essentiels à retenir pour avancer sereinement.\n\n"
            "1. Clarifier le besoin et les objectifs.\n"
            "2. S'appuyer sur des méthodes structurées et des experts dédiés.\n"
            "3. Mesurer les résultats et ajuster en continu.\n\n"
            "Besoin d'être accompagné sur ce sujet ? Notre équipe est à votre écoute — "
            "nous vous recontactons sous 24h."
        )
        for i, (title, excerpt, cat, img, pub) in enumerate(posts):
            Article.objects.create(
                title=title, excerpt=excerpt, category=cat, author="Équipe HBC-RH",
                cover=media(img), published_at=pub, order=i,
                body=body_tpl.format(intro=excerpt),
            )
        self.stdout.write("  ✓ Articles de blog")


# ---------------------------------------------------------------------------
# Dictionnaire de traduction FR → EN (contenu seedé). Fallback FR si absent.
# ---------------------------------------------------------------------------
TRANSLATIONS = {
    # Réglages
    "Libérer le potentiel humain": "Unlock human potential",
    "Transformez vos défis RH en opportunités": "Turn your HR challenges into opportunities",
    # Nav / pages
    "Accueil": "Home",
    "À propos": "About",
    "Services": "Services",
    "Réalisations": "Portfolio",
    "Blog": "Blog",
    "Recrutement": "Recruitment",
    "Équipe": "Team",
    "Contact": "Contact",
    "Human Brain Corporation-RH | Libérer le potentiel humain":
        "Human Brain Corporation-RH | Unlock human potential",
    "Partenaire stratégique RH à Douala : recrutement, management des talents, "
    "formation & coaching, externalisation RH.":
        "Strategic HR partner in Douala: recruitment, talent management, training & coaching, HR outsourcing.",
    # Hero accueil
    "Recrutement · Talents · Formation · Externalisation RH":
        "Recruitment · Talent · Training · HR Outsourcing",
    "Human Brain Corporation-RH, votre partenaire stratégique en ressources humaines "
    "à Douala et à l'international. Nous transformons vos défis RH en opportunités.":
        "Human Brain Corporation-RH, your strategic human resources partner in Douala and "
        "internationally. We turn your HR challenges into opportunities.",
    "Réseau mondial de talents": "Global talent network",
    "Réponse sous 24h": "Reply within 24h",
    "Conformité RH sécurisée": "Secured HR compliance",
    # Stats / milestone
    "Pôles d'expertise RH": "HR expertise areas",
    "Délai de réponse": "Response time",
    "Conformité RH visée": "Targeted HR compliance",
    "Talents à portée": "Talent within reach",
    "Partenaire stratégique": "Strategic partner",
    "Pôles d'expertise": "Areas of expertise",
    # À propos
    "À propos de nous": "About us",
    "Votre partenaire stratégique en ressources humaines":
        "Your strategic human resources partner",
    "Pionnier dans l'accompagnement RH, HBC-RH déniche les profils rares à travers le "
    "monde, forme vos équipes à performer durablement et sécurise votre conformité RH. "
    "Des résultats tangibles, au quotidien.":
        "A pioneer in HR support, HBC-RH finds rare profiles across the world, trains your "
        "teams to perform sustainably and secures your HR compliance. Tangible results, every day.",
    "Un réseau mondial de talents": "A global talent network",
    "Nous sourçons localement et à l'international.": "We source locally and internationally.",
    "Des solutions RH sur mesure": "Tailored HR solutions",
    "Adaptées à chaque contexte d'entreprise.": "Adapted to each business context.",
    "Un accompagnement juridique complet": "Full legal support",
    "Droit social, conformité, administration RH.": "Labour law, compliance, HR administration.",
    # Services
    "Nos expertises": "Our expertise",
    "Quatre pôles pour vos défis RH": "Four pillars for your HR challenges",
    "Un accompagnement complet pour attirer, développer et fidéliser vos talents.":
        "End-to-end support to attract, develop and retain your talent.",
    "Recrutement local & international": "Local & international recruitment",
    "Sourcing local ou international, onboarding et outboarding pour attirer les meilleurs profils.":
        "Local or international sourcing, onboarding and outboarding to attract the best profiles.",
    "Management des talents": "Talent management",
    "Diagnostic RH, évaluation des compétences et plans de développement des équipes.":
        "HR diagnostics, skills assessment and team development plans.",
    "Formation & coaching": "Training & coaching",
    "Évaluation des besoins, coaching individuel et collectif, suivi des progrès dans la durée.":
        "Needs assessment, individual and group coaching, long-term progress tracking.",
    "Externalisation RH": "HR outsourcing",
    "Conseil en droit social, conformité RH, administration du personnel et gestion de la paie.":
        "Labour-law advice, HR compliance, personnel administration and payroll management.",
    # Galerie
    "Sur le terrain": "In the field",
    "Nos formations & ateliers en action": "Our training & workshops in action",
    "Séminaires recrutement, coaching et ateliers RH animés par nos experts.":
        "Recruitment seminars, coaching and HR workshops led by our experts.",
    "Galerie": "Gallery",
    "Toutes nos réalisations": "All our work",
    "Séminaires, formations, ateliers et coaching.": "Seminars, training, workshops and coaching.",
    # Pourquoi nous
    "Pourquoi nous ?": "Why us?",
    "Ce qui fait la différence": "What sets us apart",
    "Un réseau mondial de talents, des solutions sur mesure et un accompagnement de bout en bout.":
        "A global talent network, tailored solutions and end-to-end support.",
    "Expertise éprouvée": "Proven expertise",
    "Un savoir-faire RH reconnu et des méthodes structurées.":
        "Recognised HR know-how and structured methods.",
    "Solutions innovantes & sur mesure": "Innovative & tailored solutions",
    "Des réponses adaptées à chaque contexte d'entreprise.":
        "Responses adapted to each business context.",
    "Accompagnement complet": "Complete support",
    "Un partenaire disponible, de l'analyse du besoin au suivi des résultats.":
        "An available partner, from needs analysis to results tracking.",
    # Contact
    "Parlons de votre besoin — nous vous recontactons sous 24h.":
        "Let's talk about your needs — we'll get back to you within 24h.",
    "Écrivez-nous": "Write to us",
    "Demander un rendez-vous": "Request an appointment",
    "Nous vous recontactons sous 24h.": "We'll get back to you within 24h.",
    # Heros pages secondaires
    "Qui sommes-nous": "Who we are",
    "Nos quatre pôles d'expertise RH": "Our four HR expertise areas",
    "Recrutement, management des talents, formation & coaching, externalisation RH.":
        "Recruitment, talent management, training & coaching, HR outsourcing.",
    "Retour en images sur nos séminaires, formations et interventions.":
        "A look back at our seminars, training sessions and interventions.",
    "Actualités & conseils RH": "HR news & tips",
    "Articles et conseils pour vos ressources humaines.":
        "Articles and tips for your human resources.",
    "Offres & candidatures": "Jobs & applications",
    "Rejoignez notre réseau ou confiez-nous vos recrutements.":
        "Join our network or entrust us with your recruitment.",
    "Notre équipe": "Our team",
    "Les femmes et les hommes de Human Brain Corporation.":
        "The women and men of Human Brain Corporation.",
    "Parlons de votre besoin RH — réponse sous 24h.":
        "Let's talk about your HR needs — reply within 24h.",
    "Contactez-nous": "Contact us",
}
