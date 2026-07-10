from django.db import models

#from accounts.models import User
from django.contrib.auth.models import User
from calendarapp.models import Event
from abstracts.models import Abstract

class EventMember(Abstract):
    """ Event member model """

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="events")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="event_members" )
    is_added = models.BooleanField(default=True)

    class Meta:
        unique_together = ["event", "user"]

    def __str__(self):
        return str(self.user)
