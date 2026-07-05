from datetime import datetime
from django.db import models
from django.urls import reverse
from abstracts.models import Abstract
from lessonapp.models import Theme



class Objectif(Abstract):

    name =  models.CharField(max_length=400)
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, default=None)
   	
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
       
        return super(Objectif, self).save(*args, **kwargs)

