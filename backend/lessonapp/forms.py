from django import forms
from . import models
from lessonapp.models import Session, Categorie, Sequence, Classe, Duration, Theme, Examen, Seance, Activity, Control, Bloc, Question, Activityquestion
from contents.models import Publication, Space





class CreateSequenceForm(forms.ModelForm):

	class Meta:
		model = models.Sequence
		fields = ['numero']
    
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')                 # !!! !!! !!! needed
		super(CreateSequenceForm, self).__init__(*args, **kwargs)
		self.fields['session'] = forms.ModelChoiceField(queryset=Session.objects.filter(created_by=self.user), required=True)
        		      	

	def save(self):
		data = self.cleaned_data
		if not Sequence.objects.filter(numero=data["numero"], created_by=self.user, session=data["session"]).exists():
			sequence = Sequence(numero=data["numero"], created_by=self.user, session=data["session"])
			sequence.save()       
		
		return sequence
        





class CreateThemeForm(forms.ModelForm):

	class Meta:
		model = models.Theme
		fields = ['title', 'is_visible', 'categorie', 'classes', 't_type','image']
    
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')                 # !!! !!! !!! needed
		self.sequence_id = kwargs.pop('sequence_id')  
		super(CreateThemeForm, self).__init__(*args, **kwargs)
		if self.sequence_id == 0:
			self.fields['sequence'] = forms.ModelChoiceField(queryset=Sequence.objects.filter(created_by =self.user), required=True)
		else: 
			self.fields['sequence'] = forms.ModelChoiceField(queryset=Sequence.objects.filter(id=self.sequence_id), required=True)
		self.fields['categorie'] = forms.ModelChoiceField(queryset=Categorie.objects.filter(created_by =self.user), required=True)
		self.fields['classes'] = forms.ModelMultipleChoiceField(queryset=Classe.objects.filter(created_by=self.user), required=True)
 		
 		
	def save(self, case):
		data = self.cleaned_data
		if case=="theme":
			theme = Theme(title=data["title"], is_visible=data["is_visible"], sequence=data["sequence"],categorie=data['categorie'], image=data['image'])
		else: 
			theme = Examen(title=data["title"], sequence=data["sequence"], categorie=data['categorie'], t_type=data["t_type"], image=data['image'], is_oral=data["is_oral"], is_chrono=data["is_chrono"], duration=data["duration"])
		
		theme.save()
		# Ajoutez les classes à theme
		for classe in data["classes"]:
			theme.classes.add(classe)
		
		

		return theme
		
		

class CreateExamenForm(CreateThemeForm):
	is_oral = forms.BooleanField(required=False)
	is_chrono = forms.BooleanField(required=False)
	
	
	def __init__(self, *args, **kwargs):
		super(CreateExamenForm, self).__init__(*args, **kwargs)
		self.fields['duration'] = forms.ModelChoiceField(queryset=Duration.objects.all(), required=True)
		self.fields['t_type'].initial = 2
		
	def save(self):
		return super(CreateExamenForm, self).save("examen")
		
    

    
    
    		
		


class CreateSeanceForm(forms.ModelForm):

	class Meta:
		model = models.Seance
		fields = ['title', 's_type', 'theme']
    
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')                 # !!! !!! !!! needed
		self.theme_id = kwargs.pop('theme_id')
		super(CreateSeanceForm, self).__init__(*args, **kwargs)
		if self.theme_id == 0:
			self.fields['theme'] = forms.ModelChoiceField(queryset=Theme.objects.filter(sequence__created_by =self.user), required=True)
		else:
			self.fields['theme'] = forms.ModelChoiceField(queryset=Theme.objects.filter(sequence__created_by =self.user, id=self.theme_id), required=True)
 		      	
        
	def save(self):
		data = self.cleaned_data
		seance = Seance(title=data["title"],s_type=data["s_type"], theme=data["theme"])
		
		seance.save()
		
		return seance
		
		




class CreateActivityForm(forms.ModelForm):

	class Meta:
		model = models.Activity
		fields = ['title', 'a_type', 'state',  'seance', 'bloc']
    
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')                 # !!! !!! !!! needed
		self.seance_id = kwargs.pop('seance_id')  
		super(CreateActivityForm, self).__init__(*args, **kwargs)
		self.fields['bloc'] = forms.ModelChoiceField(queryset=Bloc.objects.filter(created_by =self.user, categorie=2), required=True)
		if self.seance_id == 0:
			self.fields['seance'] = forms.ModelChoiceField(queryset=Seance.objects.filter(theme__sequence__created_by =self.user), required=True)
			
		else:
			self.fields['seance'] = forms.ModelChoiceField(queryset=Seance.objects.filter(theme__sequence__created_by =self.user, id=self.seance_id), required=True)
 		      	
        
	def save(self, case):
		data = self.cleaned_data
		if case=="activity":
			activity = Activity(title=data["title"], a_type=data["a_type"], state=data["state"], bloc=data["bloc"], seance=data["seance"])
		else:
			activity = Control(title=data["title"], a_type=data["a_type"], state=data["state"], bloc=data["bloc"], seance=data["seance"], is_oral=data["is_oral"], is_chrono=data["is_chrono"], duration=data["duration"])
	
		activity.save()
		
		return activity
		
	

		
		
class CreateControlForm(CreateActivityForm):
	is_oral = forms.BooleanField(required=False)
	is_chrono = forms.BooleanField(required=False)
	
	
	def __init__(self, *args, **kwargs):
		super(CreateControlForm, self).__init__(*args, **kwargs)
		self.fields['duration'] = forms.ModelChoiceField(queryset=Duration.objects.all(), required=True)

		
	def save(self):
		return super(CreateControlForm, self).save("control")
		
    

    
  



		
 

class CreateQuestionForm(forms.ModelForm):

	class Meta:
		model = models.Question
		fields = ['title', 'description', 'bloc']
    
	def __init__(self, *args, **kwargs):
		self.user = kwargs.pop('user')                 # !!! !!! !!! needed
		self.activity_id = kwargs.pop('activity_id')  
		super(CreateQuestionForm, self).__init__(*args, **kwargs)
		self.fields['description'].required = False
		self.fields['bloc'] = forms.ModelChoiceField(queryset=Bloc.objects.filter(created_by =self.user, categorie=1), required=True)	
		self.fields['activities'] = forms.ModelMultipleChoiceField(queryset=Activity.objects.filter(seance__theme__sequence__created_by=self.user), required=True)	
			
		"""if self.activity_id == 0:
			self.fields['activity'] = forms.ModelChoiceField(queryset=Activity.objects.filter(seance__theme__sequence__created_by =self.user), required=True)
		else:
			self.fields['activities'] = forms.ModelChoiceField(queryset=Activity.objects.filter(seance__theme__sequence__created_by =self.user, id=self.activity_id), required=True) """			
 		     	
        
	def save(self):
		data = self.cleaned_data
		question = Question(title=data["title"], description=data["description"], bloc=data["bloc"])
	
		question.save()
		# Ajoutez les activities à question
		for activity in data["activities"]:
			activity_question = Activityquestion(activity=activity, question=question)
			activity_question.save()
		
		return question
   
   
   
   
   
