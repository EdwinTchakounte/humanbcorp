from django.forms import ModelForm, DateInput
from calendarapp.models import Event, EventMember, Meeting 
from contents.models import Publication, Space
from django import forms
from django.forms.widgets import CheckboxSelectMultiple
from django.contrib.auth.models import Group, User




class EventForm(ModelForm):
	class Meta:
		model = Event
		fields = ["title", "description", "is_test", "start_time", "end_time"]
		# datetime-local is a HTML5 input type
		widgets = {
			"title": forms.TextInput(
		        	attrs={"class": "form-control", "placeholder": "Enter event title"}
		    	),
		    	"description": forms.Textarea(
		        	attrs={
		            		"class": "form-control",
		            		"placeholder": "Enter event description",
		        	}
		    	),
		    	
		    	"is_test": forms.CheckboxInput(attrs={"class": "form-check-input"}),


		    	"start_time": DateInput(
		        	attrs={"type": "datetime-local", "class": "form-control"},
		        	format="%Y-%m-%dT%H:%M",
		    	),
		    	"end_time": DateInput(
		        	attrs={"type": "datetime-local", "class": "form-control"},
		        	format="%Y-%m-%dT%H:%M",
		    	),
		}
		exclude = ["user"]

	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')
		super(EventForm, self).__init__(*args, **kwargs)
		self.fields['is_test'] = forms.BooleanField(required=False, initial=False)
		self.fields["start_time"].input_formats = ("%Y-%m-%dT%H:%M",)
		self.fields["end_time"].input_formats = ("%Y-%m-%dT%H:%M",)	
		self.fields['meetings'] = forms.MultipleChoiceField(
			required=False, 
			label='meetings',
	       	widget=CheckboxSelectMultiple(), 
	       	choices=Meeting.TYPES_CHOICES  
	        )
		self.fields['publications'] = forms.ModelMultipleChoiceField(
	       	queryset = Publication.objects.filter(spaces__owner=self.user).distinct(),
			required=False, 
			label='meetings',
	       	#widget=FilteredSelectMultiple("publications", is_stacked=False)
	       	widget=forms.SelectMultiple()
	        )
			
	def save(self):
		data = self.cleaned_data
		event = Event.objects.create(title=data["title"], is_test=data["is_test"], description=data["description"], start_time=data["start_time"], 				end_time=data["end_time"], user=self.user )
		for publication in data["publications"]:
			publication.events.add(event)
			publication.save()
		#publications = Publication.objects.filter(spaces__owner=self.user)
		for meeting2 in data["meetings"]:
			meeting =  Meeting.objects.create(m_type=meeting2, event = event, is_active=True)
					
							
		return event		




class AddMemberForm(forms.ModelForm):
	class Meta:
        	model = EventMember
        	fields = ["user", "is_added"]
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.fields["user"].queryset = User.objects.filter(groups__name__in=["Teacher", "Admin", "Second_Admin"]).distinct()
		
 
        
class MeetingForm(forms.ModelForm):
	class Meta:
		model = Meeting
		fields = ["m_type"]
        
	def __init__(self, *args, **kwargs):
		event_id = kwargs.pop('event_id')
		self.event_id = event_id	             
		super(MeetingForm, self).__init__(*args, **kwargs)
		
	def save(self):
		data = self.cleaned_data
		event = Event.objects.get(pk=self.event_id)
		""" This will assert that there is only one default meeting per m_type and per publication
		"""
		meeting =  Meeting.objects.create(m_type=data["m_type"], event = event,  is_active=True)
		meeting.save()
		return meeting
		
        
   



