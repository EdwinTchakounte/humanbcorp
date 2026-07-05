from datetime import datetime
from django.db import models
from django.urls import reverse

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

    def get_absolute_url(self):
        return reverse("calendarapp:event-detail", args=(self.id,))

    @property
    def get_html_url(self):
        url = reverse("calendarapp:event-detail", args=(self.id,))
        return f'<a href="{url}"> {self.title} </a>'
