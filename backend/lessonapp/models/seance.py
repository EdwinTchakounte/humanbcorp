from datetime import datetime
from django.db import models
from django.urls import reverse
from abstracts.models import Abstract
from lessonapp.models import Theme



class Seance(Abstract):

    title =  models.CharField(max_length=400)
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, default=None)
    THEORIE = 0
    PRATIQUE = 1
    EXERCICE = 2
    TYPES_CHOICES = ((THEORIE, 'Theorie'), (PRATIQUE, 'Pratique'), (EXERCICE, 'Exercice'))
    s_type = models.IntegerField(TYPES_CHOICES, default=0)
    # Rang pédagogique de la séance dans sa formation. Sans ce champ, le tri
    # retombait sur l'ordre d'insertion (voire un ordre non garanti par la base),
    # alors que l'UI numérote les séances comme une progression.
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        # Tri par défaut : tout chemin de lecture (API, espace apprenant, vues
        # historiques) est ordonné sans avoir à le redemander. `id` départage les
        # ex æquo pour que l'ordre reste stable.
        ordering = ["order", "id"]

    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        
        return super(Seance, self).save(*args, **kwargs)

