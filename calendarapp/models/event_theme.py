from django.db import models


from lessonapp.models import Theme
from calendarapp.models import Event


class EventTheme(models.Model):
    """ Event Theme model """

    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE )
    link_url = models.URLField(max_length = 200)

    class Meta:
        unique_together = ["event", "theme"]

    def __str__(self):
        return str(self.theme)
