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
    # Rang de l'activité dans sa séance (cf. Seance.order).
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ["order", "id"]

    def __unicode__(self):
        return "%s" % (self.title)
        
    def __str__(self):
        return self.title
        
    	
    def save(self, *args, **kwargs):
        # Cf. Seance.save : rang attribué au niveau du modèle pour que tout point
        # d'entrée (API, admin, script) produise un ordre cohérent.
        if not self.order and self.seance_id:
            from django.db.models import Max

            dernier = Activity.objects.filter(
                seance_id=self.seance_id, is_deleted=False
            ).aggregate(m=Max("order"))["m"]
            self.order = (dernier or 0) + 1
        return super(Activity, self).save(*args, **kwargs)
        
        

class Control(Activity):
	is_oral = models.BooleanField(null=False,default=False)
	is_chrono = models.BooleanField(null=False,default=False)
	duration =  models.ForeignKey(Duration, on_delete=models.CASCADE, default=None)
	note = models.IntegerField(default=0)

 
   
        


