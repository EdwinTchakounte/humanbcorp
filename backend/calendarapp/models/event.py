from datetime import datetime
from django.db import models
from django.urls import NoReverseMatch, reverse

from abstracts.models import Abstract
#from accounts.models import User
from django.contrib.auth.models import User

class EventManager(models.Manager):
    """ Event manager """

    def get_all_events(self, user):
        events = Event.objects.filter(user=user, is_active=True, is_deleted=False)
        return events


	
    def get_running_events(self, user):
        running_events = Event.objects.filter(
            user=user,
            is_active=True,
            is_deleted=False,
            end_time__gte=datetime.now().date(),
        ).order_by("start_time")
        return running_events
        
    """ get_or_create2(self,*args,**kwargs):
              will call  Meeting.get_or_create(self,*args,**kwargs):  and add created Event to this meeting  """
    


class Event(Abstract):
    """ Event model """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=200)
    description = models.TextField()
    is_test = models.BooleanField(null=True,default=False)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    
    
     
    objects = EventManager()

    def __str__(self):
        return self.title

    # Les pages de l'ancienne application ne sont plus routées : ces deux
    # helpers ne résolvent donc plus rien. On renvoie None / le titre nu plutôt
    # que de laisser une NoReverseMatch faire tomber l'admin Django, qui appelle
    # get_absolute_url pour son lien « Voir sur le site ».
    def get_absolute_url(self):
        try:
            return reverse("calendarapp:event-detail", args=(self.id,))
        except NoReverseMatch:
            return None

    @property
    def get_html_url(self):
        url = self.get_absolute_url()
        return f'<a href="{url}"> {self.title} </a>' if url else self.title
