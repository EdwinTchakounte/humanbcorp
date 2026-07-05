# 03 — Formulaire de contact RH

Décision client : le CTA « Réservation cours d'essai gratuit » devient un
**formulaire de demande de contact / devis RH**, envoyé à **recrutementhbcrh@gmail.com**.

## Front — modale dans `base.html`

Ancienne modale (contexte « cours enfants ») remplacée. Nouveaux champs :

| Champ | `name` | Obligatoire |
|-------|--------|-------------|
| Nom | `first_name` | oui |
| Prénom | `last_name` | non |
| Entreprise | `company` | non |
| Email | `email` | oui |
| Téléphone | `phone` | non |
| Service souhaité | `service` (select : les 4 pôles + « Autre ») | non |
| Votre besoin | `message` | non |

Champs **supprimés** : `age`, `parent_consent` (consentement parental), non pertinents pour un
public B2B. Le panneau latéral de la modale affiche désormais le logo, le pitch « Parlons de vos
défis RH » et les coordonnées, sur fond marine.

L'action du formulaire reste `{% url 'registration:send_email' %}` (POST + `{% csrf_token %}`).

## Back — `registration/views.py`, fonction `send_email`

Modifications :

- lecture des nouveaux champs `company` et `service` (au lieu de `age` / `parent_consent`) ;
- **sujet** : `HBC-RH — Nouvelle demande de {prénom} {nom}` (au lieu de « Algomaat_… ») ;
- **corps** du mail réorganisé : Nom, Entreprise, Email, Téléphone, Service souhaité, Message ;
- **destinataire** : `recrutementhbcrh@gmail.com` (au lieu de `fokamfekamcedric@gmail.com`) ;
- expéditeur = email saisi par le visiteur (inchangé).

## Pré-requis d'envoi

L'envoi réel nécessite la configuration SMTP dans `.env` :
```
EMAIL_HOST_USER=recrutementhbcrh@gmail.com
EMAIL_HOST_PASSWORD=<mot de passe d'application Gmail>
```
Sans ces valeurs, la soumission ne provoque pas d'erreur bloquante mais aucun mail n'est expédié.

## Vérification

1. Ouvrir la modale (bouton « Contact » / « Contactez-nous »).
2. Soumettre le formulaire → redirection vers `/` avec message de succès Django.
3. Vérifier la réception sur la boîte `recrutementhbcrh@gmail.com`.
