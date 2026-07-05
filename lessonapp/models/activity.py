from django.db import models

#from accounts.models import User
from abstracts.models import Abstract

from lessonapp.models import Seance, Duration
from .bloc import Bloc

class Activity(Abstract):
    
    title = models.CharField(max_length=400)
    #note = models.PositiveIntegerField()
    seance = models.ForeignKey(Seance, on_delete=models.CASCADE, default=None)
    bloc = models.ForeignKey(Bloc, on_delete=models.CASCADE, default=None)
    QUIZZ = 1
    PDF = 2
    LINK = 3
    TYPES_CHOICES = ( (QUIZZ, 'Quizz'), (PDF, 'Pdf'), (LINK, 'Link'))
    a_type = models.IntegerField(TYPES_CHOICES, default=1)
    INIT = 1
    OPEN = 2
    CLOSED = 3
    TYPES_CHOICES2 = ( (INIT, 'Init'), (OPEN, 'Open'), (CLOSED, 'Closed'))
    state = models.IntegerField(TYPES_CHOICES2, default=1)
    

  
    def __unicode__(self):
        return "%s" % (self.title)
        
    def __str__(self):
        return self.title
        
    	
    def save(self, *args, **kwargs):
       
        return super(Activity, self).save(*args, **kwargs)
        
        

class Control(Activity):
	is_oral = models.BooleanField(null=False,default=False)
	is_chrono = models.BooleanField(null=False,default=False)
	duration =  models.ForeignKey(Duration, on_delete=models.CASCADE, default=None)
	note = models.IntegerField(default=0)

 
   
        


