from django.db import models
from abstracts.models import Abstract
from .activity import Activity
from .question import Question



class Activityquestion(Abstract):
    points =  models.PositiveIntegerField(default=0)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, default=None)
    number = models.IntegerField(default=0)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, default=None)
   
   	
    #def __str__(self):
        #return self.number
    
    def save(self, *args, **kwargs):
        
        return super(Activityquestion, self).save(*args, **kwargs)

