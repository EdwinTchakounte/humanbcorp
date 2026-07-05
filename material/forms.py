from django import forms
from django.forms import ModelForm
from . import models
from calendarapp.models import Event
from lessonapp.models import Question, Activity
from material.models import File, Link,  Material,MaterialEventDoc, MaterialPublicationDoc, MaterialQuestionDoc, MaterialActivityDoc,MaterialResponseActivityDoc, MaterialSeanceDoc,InputBox, InputQuestionBox,Component, ActivityComponent
from django.shortcuts import render




class CreateMaterialForm(ModelForm):

   
	class Meta:
		model = Material
		fields = ('title', 'description', 'color', 'm_type')
    
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')
		self.nodetype_id = kwargs.pop("nodetype_id")
		"""
		   last digit 1 for file and Link material
		   last digit 2 for inputBox like checkbox 
		   last digit 3 for inputBox like  radio
		   
		   		   
		   first digit 1 for event
		   first digit 2 for activity
		   first digit 3 for question
		   first digit 4 for response_activity
		   first digit 5 for seance
		   first digit 6 for publication
		"""
		if int(self.nodetype_id) == int(11): 
			self.event_id = kwargs.pop('event_id')
		elif int(self.nodetype_id) == int(31) or int(self.nodetype_id) == int(32) or int(self.nodetype_id) == int(33):
			self.question_id = kwargs.pop('question_id')
		elif int(self.nodetype_id) == int(21) or int(self.nodetype_id) == int(41) or int(self.nodetype_id) == int(414):
			self.activity_id = kwargs.pop('activity_id')
		elif int(self.nodetype_id) == int(51):
			self.seance_id = kwargs.pop('seance_id')
		elif int(self.nodetype_id) == int(61):
			self.publication_id = kwargs.pop('publication_id')
		
		
		super(CreateMaterialForm, self).__init__(*args, **kwargs)
		if int(self.nodetype_id) == int(41):
			self.fields['m_type'].initial = 3
		
		if int(self.nodetype_id) == int(414):
			self.fields['m_type'].initial = 4

		
		if int(self.nodetype_id) == int(11) or  int(self.nodetype_id) == int(21) or  int(self.nodetype_id) == int(31) or  int(self.nodetype_id) == int(51) or  int(self.nodetype_id) == int(61):
			#self.fields['title'] = forms.CharField()
			#self.fields['description'] = forms.CharField(widget=forms.Textarea)
			self.fields['has_answer'] = forms.BooleanField(required=False, initial=False)
		
       
        
	def save(self, doc):
		data = self.cleaned_data
		if int(self.nodetype_id) == int(21):
			activity = Activity.objects.filter(pk=self.activity_id)[0]
			material = MaterialActivityDoc( color=data["color"],
				has_answer=data["has_answer"],
				m_type=data["m_type"],
				title=data["title"],
				description=data["description"],
				document=doc,
				activity=activity,
				owner=self.user
			       )
			material.save()
		elif int(self.nodetype_id) == int(51):
			seance = Seance.objects.filter(pk=self.seance_id)[0]
			material = MaterialSeanceDoc( color=data["color"],
				has_answer=data["has_answer"],
				m_type=data["m_type"],
				title=data["title"],
				description=data["description"],
				document=doc,
				seance=seance,
				owner=self.user
			       )
			material.save()
		elif int(self.nodetype_id) == int(41) or int(self.nodetype_id) == int(414) :
			activity_doc = MaterialActivityDoc.objects.filter(pk=self.activity_id)[0]
			material = MaterialResponseActivityDoc( color=data["color"],
				m_type=data["m_type"],
				title=data["title"],
				description=data["description"],
				document=doc,
				activity_doc=activity_doc,
				owner=self.user
			       )
			material.save()
		elif int(self.nodetype_id) == int(31):
			question = Question.objects.filter(pk=self.question_id)[0]
			material = MaterialQuestionDoc( color=data["color"],
				has_answer=data["has_answer"],
				m_type=data["m_type"],
				title=data["title"],
				description=data["description"],
				document=doc,
				question=question,
				owner=self.user
			       )
			material.save()
		elif int(self.nodetype_id) == int(11):
			event = Event.objects.filter(pk=self.event_id)[0]
			material = MaterialEventDoc( color=data["color"],
				has_answer=data["has_answer"],
				m_type=data["m_type"],
				title=data["title"],
				description=data["description"],
				document=doc,
				owner=self.user
			       )
			material.save()
			material.events.add(event)
		elif int(self.nodetype_id) == int(51):
			publication = Publication.objects.filter(pk=self.publication_id)[0]
			material = MaterialPublicationDoc( color=data["color"],
				has_answer=data["has_answer"],
				m_type=data["m_type"],
				title=data["title"],
				description=data["description"],
				document=doc,
				owner=self.user
			       )
			material.save()
			material.publications.add(publication)
		
		
	 	      
		return material
        
	

class CreateMaterialFileForm(CreateMaterialForm):
    document = forms.FileField()

    def save(self):
        data = self.cleaned_data
        file_ext_index = data["document"].name.rfind(".")
        doc = File(
                title = data["document"].name[:file_ext_index],
                document = data["document"],
                filename = data["document"].name,
                mime_type = data["document"].content_type,
                size = data["document"].size)
        doc.save()
        
        return super(CreateMaterialFileForm, self).save(doc)
        
        
class CreateMaterialLinkForm(CreateMaterialForm):
    url = forms.URLField(label="Your website", required=True)

    def save(self):
        data = self.cleaned_data
        doc = Link(title=data["title"], url = data["url"])
        doc.save()
        
        return super(CreateMaterialLinkForm, self).save(doc)
        
        

class CreateInputBoxForm(ModelForm):
	class Meta:
		model = InputQuestionBox
		fields = ('color', 'is_answer', 'title', 'input_type')
	
	
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')
		self.nodetype_id = kwargs.pop("nodetype_id")
		if int(self.nodetype_id) == int(32) or int(self.nodetype_id) == int(33):
			self.question_id = kwargs.pop('question_id')
		super(CreateInputBoxForm, self).__init__(*args, **kwargs)
		
		if int(self.nodetype_id) == int(32):
			self.fields['input_type'].initial = 1
		elif int(self.nodetype_id) == int(33):
			self.fields['input_type'].initial = 2  
		
	
   
	def save(self):
		data = self.cleaned_data	
		if int(self.nodetype_id) == int(32) or int(self.nodetype_id) == int(33):
			question = Question.objects.filter(pk=self.question_id)[0]
			input_question_box = InputQuestionBox(
				color=data["color"],
				is_answer=data["is_answer"],
				title=data["title"],
				input_type=data["input_type"],
				question = question)
			input_question_box.save()
		
		return input_question_box 


        

class CreateActivityComponentForm(ModelForm):
	class Meta:
		model = ActivityComponent
		fields = ('color', 'is_answer', 'number')
	
	
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')
		self.nodetype_id = kwargs.pop("nodetype_id")
		"""
		   last digit 4 for component
		   
		   first digit 1 for event
		   first digit 2 for activity
		   first digit 3 for question
		 """
		 
		self.choice_field = kwargs.pop("choice_id")
		if int(self.nodetype_id) == int(24):
			self.activity_id = kwargs.pop('activity_id')
		super(CreateActivityComponentForm, self).__init__(*args, **kwargs)
		
		if int(self.nodetype_id) == int(24):
			self.fields['number'].initial = int(ActivityComponent.objects.filter(activity_id=self.activity_id).count()) + int(1)
		if int(self.choice_field) == int(1):
			self.fields['title'] = forms.CharField()		
		elif int(self.choice_field) == int(2):
			self.fields['paragraph'] = forms.CharField(widget=forms.Textarea)
		elif int(self.choice_field) == int(3):
			self.fields['image'] = forms.ImageField()
			self.fields['img_width'] = forms.IntegerField(initial=400)
			self.fields['img_height'] = forms.IntegerField(initial=300)
		
		
	
   
	def save(self):
		data = self.cleaned_data	
		if int(self.nodetype_id) == int(24):
			activity = Activity.objects.filter(pk=self.activity_id)[0]
			if int(self.choice_field) == int(1):
				activity_component = ActivityComponent(
					color=data["color"],
					is_answer=data["is_answer"],
					number=data["number"],
					title=data["title"],
					activity = activity)
			elif int(self.choice_field) == int(2):
				activity_component = ActivityComponent(
					color=data["color"],
					is_answer=data["is_answer"],
					number=data["number"],
					paragraph=data["paragraph"],
					activity = activity)
			elif int(self.choice_field) == int(3):
				activity_component = ActivityComponent(
					color=data["color"],
					is_answer=data["is_answer"],
					number=data["number"],
					image=data["image"],
					activity = activity)
			
			activity_component.save()
		
		return activity_component 
       
 
 
 
 
 
