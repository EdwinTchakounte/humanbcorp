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
   	
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        
        return super(Seance, self).save(*args, **kwargs)

