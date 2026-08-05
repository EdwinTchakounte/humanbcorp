from datetime import datetime
from django.db import models
from django.urls import reverse
from abstracts.models import Abstract
from .activity import Activity
from .bloc import Bloc



class Question(Abstract):

    # Type de question. Porté par la QUESTION (et non plus déduit du type des
    # options) : socle commun à tous les formats de quiz. QCM couvre choix
    # unique/multiple (le mode reste sur l'option via `input_type`). Les valeurs
    # 3+ sont réservées aux formats à venir (texte libre, association…).
    QCM = 1
    TRUE_FALSE = 2
    FREE_TEXT = 3
    NUMERIC = 4
    ASSOCIATION = 5
    ORDERING = 6
    KIND_CHOICES = (
        (QCM, 'QCM'),
        (TRUE_FALSE, 'Vrai/Faux'),
        (FREE_TEXT, 'Texte libre'),
        (NUMERIC, 'Numérique'),
        (ASSOCIATION, 'Association'),
        (ORDERING, 'Ordonnancement'),
    )
    # Options des questions Association/Ordonnancement : réutilisent
    # `InputQuestionBox.title` avec le séparateur « || » —
    #   Association : « gauche||droite » ; Ordonnancement : « position||texte ».
    kind = models.IntegerField(choices=KIND_CHOICES, default=QCM)

    title = models.CharField(max_length=255)
    description = models.TextField(default=None)
    bloc = models.ForeignKey(Bloc, on_delete=models.CASCADE, default=None)
    # Illustration de l'énoncé (schéma, photo, capture…). Facultative — un quiz
    # « à choix d'images » porte plutôt les images sur les options ci-dessous.
    image = models.ImageField(upload_to='img', null=True, blank=True)
 
   	
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        
        return super(Question, self).save(*args, **kwargs)

