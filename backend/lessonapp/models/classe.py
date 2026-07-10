from datetime import datetime
from django.db import models
from django.urls import reverse
from django.contrib.auth.models import User
from abstracts.models import Abstract



class Classe(Abstract):
  
    name = models.CharField(max_length=200)
    created_by = models.ForeignKey(User,  on_delete=models.CASCADE, default=None)

    def __str__(self):
        return self.name

   
