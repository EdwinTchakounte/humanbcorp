from datetime import datetime
from django.db import models
from django.urls import reverse
from django.contrib.auth.models import User
from abstracts.models import Abstract
from .session import Session




class Sequence(Abstract):
  
	numero =  models.PositiveIntegerField()
	created_by = models.ForeignKey(User, on_delete=models.CASCADE, default=None)   
	session = models.ForeignKey(Session, on_delete=models.CASCADE, default=None)
	
	def __str__(self):
		return str(self.numero)
		


