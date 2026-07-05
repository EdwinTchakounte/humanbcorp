from datetime import datetime
from django.db import models
from django.urls import reverse
from abstracts.models import Abstract
from .activity import Activity
from .bloc import Bloc



class Question(Abstract):

    title = models.CharField(max_length=255)
    description = models.TextField(default=None)
    bloc = models.ForeignKey(Bloc, on_delete=models.CASCADE, default=None)
 
   	
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        
        return super(Question, self).save(*args, **kwargs)

