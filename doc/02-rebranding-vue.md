# 02 — Rebranding de la vue (habillage global + landing)

Périmètre validé avec le client : **landing + habillage global**. La page d'accueil et
le squelette commun (header/nav/footer/meta/logo/couleurs) sont refondus ; le back-office
conserve sa mécanique mais hérite du nouvel habillage.

## 1. Charte couleurs — `Algomaat/static/css/hbc-brand.css` (nouveau)

Fichier de surcharge **chargé après `STYle2.css`** (donc non destructif). Il :

- redéfinit les variables : `--brand: #112848` (marine), `--brand-gold: #C49640` (or) ;
- neutralise les fonds « photos d'enfants » du hero (`.slide1/2/3`) par un **dégradé de marque** ;
- restyle boutons (`.btn-brand`, `.btn-outline-light`), cartes `.service` (liseré or au survol),
  sur-titres `.intro h6` (or), filet doré sous les `h1`, section chiffres `#milestone` (marine),
  overlays et **footer** (marine sombre).

Inclusion ajoutée dans `base.html` :
```html
<link rel="stylesheet" href="{% static 'css/STYle2.css' %}">
<link rel="stylesheet" href="{% static 'css/hbc-brand.css' %}">
```

## 2. `Algomaat/templates/base.html`

| Zone | Avant | Après |
|------|-------|-------|
| `<title>` / meta / OG / Twitter | « Algomaat [Learning for kids] », URL algomaat.com | « Human Brain Corporation-RH \| Libérer le potentiel humain », URL humanbcorp.com |
| Favicon | `LOGO-ALGOMAAT*.png` (+ bloc dupliqué cassé) | `favicon-hbc.png` / `favicon-hbc-64.png` (bloc dupliqué supprimé) |
| Barre supérieure | « Réservez un cours d'essai gratuit » | Email + téléphone HBC-RH |
| Logo navbar | `LOGO.png` (110×50) | `logo-hbc.png` (hauteur auto 52px via CSS) |
| Liens nav | Services / Réservation cours d'essai | Nos services · À propos · Pourquoi nous · Contact |
| Footer | Bloc unique « Algomaat » + copyright 2020 | 3 colonnes : présentation + slogan, liste des services, coordonnées ; copyright dynamique `{% now "Y" %}` |
| Modale | Formulaire « cours d'essai » (nom, âge, consentement parental) | Formulaire de contact RH (voir [03](03-formulaire-contact-rh.md)) |

## 3. `Algomaat/templates/home.html` (contenu entièrement réécrit)

Nouvelle structure de la landing :

1. **Hero slider** (3 slides, dégradé de marque) : « Libérer le potentiel humain »,
   « Nous dénichons les profils rares », « Des équipes qui performent durablement ».
2. **À propos** (`#about`) : texte officiel HBC + 3 atouts (réseau mondial, solutions sur
   mesure, accompagnement juridique) + boutons WhatsApp / devis + logo.
3. **Services** (`#services`) : 4 cartes (icônes boxicons) = les 4 pôles RH du PDF.
4. **Chiffres clés** (`#milestone`) : RH · 4 pôles · 24H de réponse · 100% conformité visée.
5. **Pourquoi nous** (`#pourquoi`) : expertise éprouvée, solutions innovantes/sur mesure,
   engagement & accompagnement complet.
6. **Contact** (`#contact`) : bandeau marine avec coordonnées + CTA « Demander un rendez-vous ».

Tout le contenu « programmation / robotique / cours enfants » a été retiré. Les liens de
navigation pointent vers les ancres de ces sections (`/#services`, `/#about`, `/#pourquoi`).

## 4. Back-office & pages d'auth (2e passage)

Le landing avait été fait ; ce passage étend la charte aux écrans connectés :

| Fichier | Changement |
|---------|-----------|
| `templates/base/base.html` | logo `LOGO.png`→`logo-hbc.png` ; inclusion de `hbc-brand.css` (surcharge `--brand` orange `#ff4d29`→marine `#112848`) ; favicon HBC ; barre email/tél HBC ; **modale « cours d'essai » (consentement parental) remplacée par le formulaire de contact HBC-RH** (champs alignés sur la vue `send_email` : `first_name/last_name/company/email/phone/service/message`) |
| `templates/registration/login.html`, `registration_form.html`, `registration_admin_add_form.html` | logo `LOGO.png`→`logo-hbc.png` |
| `templates/calendarapp/event-details.html` | texte « Algomaat »→« HBC-RH » |
| `templates/contents/show_publication.html`, `show_spaces.html` | CTA « cours d'essai gratuit »→« Demander un rendez-vous » / « Contactez nos experts RH » / « Parlons de vos défis RH » |
| `static/js/bucketContents.js`, `bucketOfInscriptions.js` | chemin cassé `/Algomaat/static/img/icon1.png`→`/static/img/icon1.png` (STATIC_URL=`/static/`) |

> Le mot « Algomaat » restant dans `manage.py`, `Algomaat/settings.py`, `wsgi.py`,
> `asgi.py`, `calendarapp/views/other_views.py` est le **nom du module/projet Python**
> (chemin d'import) — à NE PAS renommer, sans impact visuel.

## Vérification

- Reconstruire les statiques : `python manage.py collectstatic` (fait au démarrage du conteneur).
- Ouvrir `/` : logo HBC dans la navbar, hero marine/or, 4 services RH, footer coordonnées Douala.
- Se connecter : logo HBC sur `/registration/login/`, back-office en marine/or, modale « Contact » = formulaire RH.
- Aucune référence visuelle « Algomaat » ne doit subsister (public **et** connecté).
