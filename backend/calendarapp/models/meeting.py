from django.db import models
from django.contrib.auth.models import User
from calendarapp.models import Event
from abstracts.models import Abstract

# Create your models here.


class Meeting(Abstract):
	GOOGLE_MEET = 0
	ZOOM = 1
	FACE_TO_FACE = 2
	TYPES_CHOICES = ((GOOGLE_MEET, 'Google_Meet'), (ZOOM, 'Zoom'), (FACE_TO_FACE, 'Face-to-face'),)
	m_type = models.IntegerField(TYPES_CHOICES, default=0)
	link_url = models.URLField(max_length=200, null=True, blank=True)
	event = models.ForeignKey(Event,  on_delete=models.CASCADE)
	
	
	def __unicode__(self):
		return "%s" % (self.m_type)
		
	"""def get_cloned_meeting(self, to_event):
		meeting_to = self
		meeting_to.event = to_event
		meeting_to.save()
		return meeting_to"""
		
		
        	
 
"""	def save(self, *args, **kwargs):
		""" """This will assert that there is only one default meeting per m_type and per publication
		"""
"""		if self.is_active == False:
			try:
				meeting = Meeting.objects.get(publication=self.publication, m_type=self.m_type, is_active=False)
			except Meeting.DoesNotExist:
				return super(Meeting, self).save(*args, **kwargs)
			return False
		return super(Meeting, self).save(*args, **kwargs) """
  
