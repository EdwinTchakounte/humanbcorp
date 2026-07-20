from datetime import datetime
from django.db import models
from django.urls import reverse
from abstracts.models import Abstract

from django.contrib.auth.models import User




class Session(Abstract):

    year =  models.CharField(max_length=400)
    created_by = models.ForeignKey(User,  on_delete=models.CASCADE, default=None)
    espace = models.ForeignKey(
        "espaces.Espace", on_delete=models.CASCADE, null=True, blank=True,
        related_name="sessions",
    )
   
   	
    def __str__(self):
        return str(self.year)
    
    def save(self, *args, **kwargs):
        
        return super(Session, self).save(*args, **kwargs)

