from datetime import datetime
from django.db import models
from django.urls import reverse
from abstracts.models import Abstract
from django.contrib.auth.models import User



class Bloc(Abstract):

    title =  models.CharField(max_length=400)
    created_by = models.ForeignKey(User,  on_delete=models.CASCADE, default=None)
    QUESTION = 1
    ACTIVITY = 2
    CATEGORIES = ( (QUESTION, 'FOR QUESTION'), (ACTIVITY, 'FOR ACTIVITY'))
    categorie = models.IntegerField(CATEGORIES, default=1)
   	
    def __str__(self):
        return self.title

