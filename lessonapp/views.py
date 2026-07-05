from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404 , redirect
from django.template import RequestContext
from django.http import Http404, HttpResponseRedirect,  JsonResponse
from lessonapp.models import Session, Sequence, Classe, Categorie, Theme, Examen,  Objectif, Seance, Activity, Control, Question, Activityquestion
from lessonapp.forms import CreateSequenceForm, CreateThemeForm, CreateExamenForm, CreateSeanceForm, CreateActivityForm, CreateControlForm, CreateQuestionForm
from material.models import File, Link, Material, MaterialEventDoc, MaterialQuestionDoc, MaterialActivityDoc, InputBox, InputQuestionBox, CheckedResponseInputQuestion, Component, ActivityComponent, MaterialResponseActivityDoc, MaterialSeanceDoc
from material.forms import CreateMaterialFileForm, CreateMaterialLinkForm, CreateInputBoxForm, CreateActivityComponentForm
from lessonapp.serializers import SessionSerializer, SequenceSerializer, ClasseSerializer, ThemeSerializer, ActivityquestionSerializer

from material.serializers import ComponentSerializer
# Create your views here.



@login_required
def my_lessons(request):
	form_sequence = CreateSequenceForm(user=request.user)
	context_dict = {"form_sequence": form_sequence}
	template="lessonapp/my_lessons.html"
	return render(request, template, context_dict)


@login_required
def read_lessons(request):
	context_dict = {}
	template="lessonapp/show_lessons.html"
	return render(request, template, context_dict)
	


def read_theme(request, theme_id):
	if not request.user.is_authenticated:
		return redirect("/registration/login/?page_id=%s&page_type=t" %  theme_id )
	
	theme = get_object_or_404(Theme, id=theme_id)
	objectifs =  Objectif.objects.filter(theme = theme)
	
	seance_dict = { }
	seances_dicts = []
	seances =  Seance.objects.filter(theme = theme)
	
	activity_dicts = []
	control = 0
	s = 1
	for seance in seances:
		seance_docs = []
		materialSeanceDocs = MaterialSeanceDoc.objects.filter(seance = seance)
		sd=1
		for doc in materialSeanceDocs:
			doc_dict = {}
			doc_dict = {
				"id"  : doc.pk,
				"index":sd,
				"url": doc.doc_link,
				"title": doc.title,
				"description": doc.description,
				"color":doc.color,
				"has_answer":doc.has_answer,
				"m_type":doc.m_type,
			}				
						
			seance_docs.append(doc_dict)
			sd = sd+1			
				
		
	
		
		activities = Activity.objects.filter(seance = seance)
		
		#children = []
		activity_dicts = []
		a = 1
		for activity in activities:
			if Control.objects.filter(id = activity.id).exists():
				control = 1
			children_of_docs = []
			if activity.a_type == 2:
				materialActivityDocs = MaterialActivityDoc.objects.filter(activity = activity)
				d=1
				for doc in materialActivityDocs:
					doc_dict = {}
					doc_dict = {
						"id"  : doc.pk,
						"index":d,
						"url": doc.doc_link,
						"title": doc.title,
						"description": doc.description,
						"color":doc.color,
						"has_answer":doc.has_answer,
						"m_type":doc.m_type,
					 }		
						
					children_of_docs.append(doc_dict)
					d = d+1
						
			
			
			children_of_questions = []
			questions_dicts = []
			if activity.a_type == 1: 
				question_ids = []
				activityquestions =  Activityquestion.objects.filter(activity=activity)
				for activityquestion in activityquestions:
					question_ids.append(activityquestion.question.id)

				questions = Question.objects.filter(pk__in=question_ids)
				question_dict = {}
				q=1
				for question in questions:
					if question.bloc.title == "Text avec plusieurs checkboxs" or question.bloc.title == "Text avec plusieurs radios":
						inputQuestionBoxs = InputQuestionBox.objects.filter(question = question)
						children_of_question = []
						i=1
						for inputQuestionBox in inputQuestionBoxs:
							children_of_inputquestion = []
							inputResponseQuestionBoxs = CheckedResponseInputQuestion.objects.filter(input_question_box = inputQuestionBox, owner=request.user)
							r = 1
							for inputResponseQuestionBox in inputResponseQuestionBoxs:
								inputResponseQuestion_dict = {}
								inputResponseQuestion_dict = {
								    "id": inputResponseQuestionBox.pk,
								    "index":r,
								    "checked": inputResponseQuestionBox.checked,
								   		   
								 }
								
								children_of_inputquestion.append(inputResponseQuestion_dict)
								r = r + 1
								
							
							inputQuestion_dict = {}
							inputQuestion_dict = {
							    "id"  : inputQuestionBox.pk,
							    "index":i,
							    "title": inputQuestionBox.title,
							    "color": inputQuestionBox.color,
							    "is_answer": inputQuestionBox.is_answer,
							    "input_type": inputQuestionBox.input_type,
							    "children": children_of_inputquestion, 				   
							 }
							
							children_of_question.append(inputQuestion_dict)
							i = i + 1	
						
						activityquestion =  Activityquestion.objects.filter(activity=activity, question=question)[0]
						question_dict = {
							    "id"  : question.pk,
							    "index":q,
							    "title": question.title,
							    "description": question.description,
							    "points": activityquestion.points,
							    "number": activityquestion.number,
							    "bloc": question.bloc.title,				   
							    "children":children_of_question,
							    "children_count":questions.count(),
							}
						questions_dicts.append(question_dict)
						q = q + 1
				
			
			
			components =  ActivityComponent.objects.filter(activity = activity).order_by('number')
			components_dict = ComponentSerializer(components, many=True).data			
			activity_dict = {
						    "id"  : activity.pk,
						    "index":a,
						    "title": activity.title,
						    "seance": activity.seance.title,
						    "control": control,
						    "type": activity.a_type,
						    "bloc": activity.bloc.title,
						    "state": activity.state,
						    "children_questions": questions_dicts,					   
						    "children_docs":children_of_docs,
						    "children_components":components_dict,
						    "children_components_count":components.count(),
						}
						
			activity_dicts.append(activity_dict)
			a = a + 1
				
		seance_dict = {
				    "id"  : seance.pk,
				    "index":s,
				    "title": seance.title,
				    "type": seance.s_type,
				    "seance_docs":seance_docs,				   
				    "children":activity_dicts,
				    "children_count":activities.count()
				}
		seances_dicts.append(seance_dict)
		s = s + 1		
		
		
	
	context_dict = {"theme":theme ,"objectifs":objectifs, "seances":seances, "seances_dicts":seances_dicts }
	template="lessonapp/show_theme.html"
	return render(request, template, context_dict)





@login_required    
def create_session(request):
    # # # BAD BAD BAD ASS fast and hacky #TODO
	if request.method == 'POST':
		year = request.POST.get('year')
		if Session.objects.filter(year=year, created_by=request.user).exists():
			session = Session.objects.get(year=year, created_by=request.user)       
		else:
			session = Session.objects.create(year=year, created_by=request.user)
		
	return redirect("lessonapp:my_lessons")
    



@login_required    
def create_sequence(request):
    # # # BAD BAD BAD ASS fast and hacky #TODO
	if request.method == 'POST':
		form = CreateSequenceForm(request.POST, user=request.user)
		if form.is_valid():
			sequence = form.save()
		
		return redirect("lessonapp:sequence_edit", sequence_id=sequence.pk)
	return redirect("lessonapp:my_lessons")
    

@login_required    
def edit_sequence(request, sequence_id):
	#sequence = get_object_or_404(Sequence, id=sequence_id)
	context_dict = {}
	if Sequence.objects.filter(id=sequence_id, created_by=request.user).exists():
		sequence = Sequence.objects.filter( id=sequence_id, created_by=request.user)[0]
		context_dict = {"sequence": sequence}
	template="lessonapp/edit_sequence.html"        
	return render(request, template, context_dict)



def ajax_get_sequences_data(request):
	sequences = Sequence.objects.filter(created_by=request.user)
	results = SequenceSerializer(sequences, many=True).data
	return JsonResponse(results, safe=False)


def ajax_get_sessions_sequences_data(request):
	sessions_dicts = []
	sessions = Session.objects.filter(created_by=request.user)
	for session in sessions:
		sequences = Sequence.objects.filter(session = session, created_by=request.user)
		sequences_dicts = []
		for sequence in sequences:
			sequence_dict = {
				"id": sequence.id,
				"numero": sequence.numero,
			}
			sequences_dicts.append(sequence_dict)
		session_dict = {
			"id"  : session.id,
			"year": session.year,
			"sequences": sequences_dicts,
		}
		sessions_dicts.append(session_dict)
	return JsonResponse(sessions_dicts, safe=False)



def ajax_get_sequences_from_session_id(request, session_id):
	session = Session.objects.filter(created_by=request.user, id=session_id)[0]
	sequences = Sequence.objects.filter(created_by=request.user, session=session)
	results = SequenceSerializer(sequences, many=True).data
	return JsonResponse(results, safe=False)




def json_checkbox_getChilds(request, inputbox_id):
	checkbox = get_object_or_404(InputQuestionBox, id=inputbox_id)
	
	ct_json = checkbox_getChilds(checkbox)
	return JsonResponse(ct_json)
	


def checkbox_getChilds(checkbox):
	children = []
	
		
	node_dict = {
		"id"  : "node_checkbox_%s" % checkbox.pk,
		"name": "%s" % checkbox.title,
		"data": {},
		"children":children,
		}
    
 
	return node_dict  



def json_radio_getChilds(request, inputbox_id):
	radio = get_object_or_404(InputQuestionBox, id=inputbox_id)
	
	ct_json = radio_getChilds(radio)
	return JsonResponse(ct_json)





def radio_getChilds(radio):
	children = []
	
		
	node_dict = {
		"id"  : "node_radio_%s" % radio.pk,
		"name": "%s" % radio.title,
		"data": {},
		"children":children,
		}
    
 
	return node_dict  



def json_question_getChilds(request, question_id):
	question = get_object_or_404(Question, id=question_id)
	
	ct_json = question_getChilds(question)
	return JsonResponse(ct_json)
 

def question_getChilds(question):
	#print(seance)	 
	children = []
	activity_ids = []
	question_points = []
	question_numbers = []
	
	for checkbox in InputQuestionBox.objects.filter(question=question, input_type=1):
		children.append(checkbox_getChilds(checkbox)) 
		
	for radio in InputQuestionBox.objects.filter(question=question, input_type=2):
		children.append(radio_getChilds(radio)) 
	
	activityquestions =  Activityquestion.objects.filter(question=question)
	for activityquestion in activityquestions:
		activity_ids.append(activityquestion.activity.id)
		question_points.append(activityquestion.points)
		question_numbers.append(activityquestion.number)

	
	node_dict = {
		"id"  : "node_question_%s" % question.pk,
		"name": "%s" % question.title,
		"data": {"question_id": question.pk, "question_points": question_points, "question_numbers":question_numbers,  "activity_ids":activity_ids},
		"children":children,
		}
    
 
	return node_dict  




def ajax_get_question__activities(request, question_id):
	question = Question.objects.filter(id=question_id)[0]
	questions_activities = Activityquestion.objects.filter(question=question)
	activity_dicts = []
	activity_dict = {}
	for activityquestion in questions_activities:
		activity = Activity.objects.filter(id=activityquestion.activity.id)[0]
		
		activity_dict = {
					    "id"  : activity.pk,
					    "title": activity.title,
					    "points": activityquestion.points,
					    "number": activityquestion.number,
		}
				
		activity_dicts.append(activity_dict)

	return JsonResponse(activity_dicts, safe=False)


def ajax_get_questions(request, activity_id):
	activity = Activity.objects.filter( id = activity_id)[0]
	
	components =  ActivityComponent.objects.filter(activity = activity).order_by('number')
	question_ids = []
	activityquestions =  Activityquestion.objects.filter(activity=activity)
	for activityquestion in activityquestions:
		question_ids.append(activityquestion.question.id)

	questions = Question.objects.filter(pk__in=question_ids)
	
	children_of_activity = []
	activity_dict = {}
	activity_dicts = []
	questions_dicts = []
	components_dicts = []
	for question in questions:
		question_dict = {}
		if question.bloc.title == "Text avec plusieurs checkboxs" or question.bloc.title == "Text avec plusieurs radios":
			inputQuestionBoxs = InputQuestionBox.objects.filter(question = question)
			children_of_question = []
			for inputQuestionBox in inputQuestionBoxs:
				children_of_inputquestion = []
				inputResponseQuestionBoxs = CheckedResponseInputQuestion.objects.filter(input_question_box = inputQuestionBox, owner=request.user)
				for inputResponseQuestionBox in inputResponseQuestionBoxs:
					inputResponseQuestion_dict = {}
					inputResponseQuestion_dict = {
					    "id": inputResponseQuestionBox.pk,
					    "checked": inputResponseQuestionBox.checked,
					   		   
					 }
					
					children_of_inputquestion.append(inputResponseQuestion_dict)
					
				
				inputQuestion_dict = {}
				inputQuestion_dict = {
				    "id"  : inputQuestionBox.pk,
				    "title": inputQuestionBox.title,
				    "color": inputQuestionBox.color,
				    "is_answer": inputQuestionBox.is_answer,
				    "input_type": inputQuestionBox.input_type,
				    "children": children_of_inputquestion, 				   
				 }
				
				children_of_question.append(inputQuestion_dict)	
			
			activityquestion =  Activityquestion.objects.filter(activity=activity, question=question)[0]
			question_dict = {
				    "id"  : question.pk,
				    "title": question.title,
				    "description": question.description,
				    "points": activityquestion.points,
				    "number": activityquestion.number,
				    "bloc": question.bloc.title,				   
				    "children":children_of_question,
				    "children_count":questions.count(),
				}
			questions_dicts.append(question_dict)
	children_of_docs = []
	if activity.a_type == 2:
		materialActivityDocs = MaterialActivityDoc.objects.filter(activity = activity)
		
		for doc in materialActivityDocs:
			doc_dict = {}
			doc_dict = {
				"id"  : doc.pk,
				"url": doc.doc_link,
				"title": doc.title,
				"description": doc.description,
				"color":doc.color,
				"has_answer":doc.has_answer,
			 }		
			children_of_docs.append(doc_dict)	
			
			
	components_dict = ComponentSerializer(components, many=True).data
	
				
			
	activity_dict = {
				    "id"  : activity.pk,
				    "title": activity.title,
				    "seance": activity.seance.title,
				    "type": activity.a_type,
				    "bloc": activity.bloc.title,
				    "state": activity.state,				   
				    "children_questions":questions_dicts,
				    "children_docs":children_of_docs,
				    "children_components":components_dict,
				}
				
	activity_dicts.append(activity_dict)
	#print(activity_dicts)
	return JsonResponse(activity_dicts, safe=False)








def component_getChilds(component):
	children = []
		
	node_dict = {
		"id"  : "node_component_%s" % component.pk,
		"name": "Component: %s" % component.number,
		"data": {"theme_id": component.activity.seance.theme.pk, "seance_id": component.activity.seance.pk,  "activity_id": component.activity.pk},
		"children":children,
		}
    
 
	return node_dict  



def json_component_getChilds(request, component_id):
	component = get_object_or_404(ActivityComponent, id=component_id)
	
	ct_json = component_getChilds(component)
	return JsonResponse(ct_json)
 

	

def activity_getChilds(activity):
	#print(seance)	 
	children = []
	question_ids = []
	activityquestions =  Activityquestion.objects.filter(activity=activity)
	for activityquestion in activityquestions:
		question_ids.append(activityquestion.question.id)

	for question in Question.objects.filter(pk__in=question_ids):
		children.append(question_getChilds(question)) 
	
	for component in ActivityComponent.objects.filter(activity=activity):
		children.append(component_getChilds(component))
	
		

	for matdoc in MaterialActivityDoc.objects.filter(activity=activity):
		
		if  matdoc.doc_type() == "F":
			children.append(matActivityFile_getChilds(matdoc)) 
		
	
		if  matdoc.doc_type() == "L":
			children.append(matActivityLink_getChilds(matdoc)) 
 
	node_dict = {
		"id"  : "node_activity_%s" % activity.pk,
		"name": "%s" % activity.title,
		"data": {"theme_id": activity.seance.theme.pk,  "seance_id": activity.seance.pk, "bloc_id": activity.bloc.pk },
		"children":children,
		}
    
 
	return node_dict  

 

def json_activity_getChilds(request, activity_id):
	activity = get_object_or_404(Activity, id=activity_id)
	
	ct_json = activity_getChilds(activity)
	return JsonResponse(ct_json)
 



def control_getChilds(control):
	#print(seance)	 
	children = []
	question_ids = []
	activityquestions =  Activityquestion.objects.filter(activity=control)
	for activityquestion in activityquestions:
		question_ids.append(activityquestion.question.id)
	
	
	for question in Question.objects.filter(pk__in=question_ids):
		children.append(question_getChilds(question)) 
	
	for component in ActivityComponent.objects.filter(activity=control):
		children.append(component_getChilds(component))
	
		

	for matdoc in MaterialActivityDoc.objects.filter(activity=control):
		
		if  matdoc.doc_type() == "F":
			children.append(matActivityFile_getChilds(matdoc)) 
		
	
		if  matdoc.doc_type() == "L":
			children.append(matActivityLink_getChilds(matdoc)) 
 
	node_dict = {
		"id"  : "node_control_%s" % control.pk,
		"name": "Control %s" % control.title,
		"data": {"theme_id": control.seance.theme.pk,  "seance_id": control.seance.pk, "bloc_id": control.bloc.pk },
		"children":children,
		}
    
 
	return node_dict  


def json_control_getChilds(request, control_id):
	control = get_object_or_404(Control, id=control_id)
	
	ct_json = control_getChilds(control)
	return JsonResponse(ct_json)
 




def matActivityLink_getChilds(matactivitydoc):
	children = []
	
	node_dict = {
			"id"  : "node_link_%s" % matactivitydoc.pk,
			"name": "Link: %s" % matactivitydoc.title,
			"data": {"activity_id":matactivitydoc.activity.pk},
			"children":children,
			}		
    
 
	return node_dict  


def json_matActivityLink_getChilds(request, matactivitydoc_id):
	matactivitydoc = get_object_or_404(MaterialActivityDoc, id=matactivitydoc_id)
	
	ct_json = matActivityLink_getChilds(matactivitydoc)
	return JsonResponse(ct_json)




def matActivityFile_getChilds(matactivitydoc):
	children = []
	for matresponseactivitydoc in MaterialResponseActivityDoc.objects.filter(activity_doc=matactivitydoc):
		if matresponseactivitydoc.m_type == 3:
			children.append(matResponseActivityFile_getChilds(matresponseactivitydoc))
		elif matresponseactivitydoc.m_type == 4:
			children.append(matResponseActivityCorrectionFile_getChilds(matresponseactivitydoc))	
		

	node_dict = {
			"id"  : "node_file_%s" % matactivitydoc.pk,
			"name": "File: %s" % matactivitydoc.title,
			"data": {"theme_id": matactivitydoc.activity.seance.theme.pk,  "seance_id": matactivitydoc.activity.seance.pk, "activity":matactivitydoc.activity.pk, "m_type":matactivitydoc.m_type, "url":matactivitydoc.doc_link() },
			"children":children,
		     }	
     
	return node_dict  
	



def json_matActivityFile_getChilds(request, matactivitydoc_id):
	matactivitydoc = get_object_or_404(MaterialActivityDoc, id=matactivitydoc_id)
	
	ct_json = matActivityFile_getChilds(matactivitydoc)
	return JsonResponse(ct_json)






def json_matResponseActivityFile_getChilds(request, matresponseactivitydoc_id):
	matresponseactivitydoc = get_object_or_404(MaterialResponseActivityDoc, id=matresponseactivitydoc_id)
	
	ct_json = matResponseActivityFile_getChilds(matresponseactivitydoc)
	return JsonResponse(ct_json)



def matResponseActivityFile_getChilds(matresponseactivitydoc):
	children = []
	node_dict = {
			"id"  : "node_responsefile_%s" % matresponseactivitydoc.pk,
			"name": "Response File: %s" % matresponseactivitydoc.title,
			"data": {"theme_id": matresponseactivitydoc.activity_doc.activity.seance.theme.pk,  "seance_id": matresponseactivitydoc.activity_doc.activity.seance.pk, "activity":matresponseactivitydoc.activity_doc.activity.pk, "m_type":matresponseactivitydoc.m_type, "url":matresponseactivitydoc.doc_link()},
			"children":children,
		     }	
    
 
	return node_dict  




def json_matResponseActivityCorrectionFile_getChilds(request, matresponseactivitydoc_id):
	matresponseactivitydoc = get_object_or_404(MaterialResponseActivityDoc, id=matresponseactivitydoc_id)
	
	ct_json = matResponseActivityCorrectionFile_getChilds(matresponseactivitydoc)
	return JsonResponse(ct_json)





def matResponseActivityCorrectionFile_getChilds(matresponseactivitydoc):
	children = []
	node_dict = {
			"id"  : "node_responsecorrectionfile_%s" % matresponseactivitydoc.pk,
			"name": "Correction File: %s" % matresponseactivitydoc.title,
			"data": {"theme_id": matresponseactivitydoc.activity_doc.activity.seance.theme.pk,  "seance_id": matresponseactivitydoc.activity_doc.activity.seance.pk, "activity":matresponseactivitydoc.activity_doc.activity.pk, "m_type":matresponseactivitydoc.m_type, "url":matresponseactivitydoc.doc_link()},
			"children":children,
		     }	
    
 
	return node_dict  






def seance_getChilds(seance):
	#print(seance)	 
	children = []
	control_ids = []	
	controls = Control.objects.filter(seance=seance)
	
	for control in controls:
		control_ids.append(control.id)

		
	for activity in Activity.objects.filter(seance=seance).exclude(pk__in=control_ids):
		children.append(activity_getChilds(activity)) 
		
	for control in controls:
		children.append(control_getChilds(control))

	
	node_dict = {
		"id"  : "node_seance_%s" % seance.pk,
		"name": "%s" % seance.title,
		"data": {"theme_id": seance.theme.pk},
		"children":children,
		}
    
 
	return node_dict  
	


def json_seance_getChilds(request, seance_id):
	seance = get_object_or_404(Seance, id=seance_id)
	
	ct_json = seance_getChilds(seance)
	return JsonResponse(ct_json)
 
 


 	

def objectif_getChilds(objectif):
	#print(objectif)	 
	children = []
	
	
	node_dict = {
		"id"  : "node_objectif_%s" % objectif.pk,
		"name": "%s" % objectif.name,
		#"data": {"linkUrl": "#TODO", "linkName":"#TODO",  "relationWeight":rel_weight, "relationId":rel_id},
		"children":children,
		}
    
 
	return node_dict  



def json_objectif_getChilds(request, objectif_id):
	objectif = get_object_or_404(Objectif, id=objectif_id)
	
	ct_json = objectif_getChilds(objectif)
	return JsonResponse(ct_json)
 
 
 



def examen_getChilds(exam):
	#print(type(theme))	 
	children = []
	
	
	for seance in Seance.objects.filter(theme=exam):
		children.append(seance_getChilds(seance)) 
		
	for objectif in Objectif.objects.filter(theme=exam):
		children.append(objectif_getChilds(objectif)) 
		
	node_dict = {
		"id"  : "node_examen_%s" % exam.pk,
		"name": "%s" %  exam.title,
		#"data": {"linkUrl": "#TODO", "linkName":"#TODO",  "relationWeight":rel_weight, "relationId":rel_id},
		"children":children,
		}
    
 
	return node_dict  






def theme_getChilds(theme):
	#print(type(theme))	 
	children = []
	
	
	for seance in Seance.objects.filter(theme=theme):
		children.append(seance_getChilds(seance)) 
		
	for objectif in Objectif.objects.filter(theme=theme):
		children.append(objectif_getChilds(objectif)) 
		
	node_dict = {
		"id"  : "node_theme_%s" % theme.pk,
		"name": "%s" %  theme.title,
		#"data": {"linkUrl": "#TODO", "linkName":"#TODO",  "relationWeight":rel_weight, "relationId":rel_id},
		"children":children,
		}
    
 
	return node_dict  



def json_theme_getChilds(request, theme_id):
	theme = get_object_or_404(Theme, id=theme_id)
	
	ct_json = theme_getChilds(theme)
	return JsonResponse(ct_json)
 


#def json_examen_getChilds(request, examen_id):
	#examen = get_object_or_404(Examen, id=examen_id)
	
	#ct_json = theme_getChilds(examen)
	#return JsonResponse(ct_json)






def ajax_get_themes_from_sequence_id(request, sequence_id):
	sequence = Sequence.objects.filter(created_by=request.user, id=sequence_id)[0]
	themes = Theme.objects.filter(sequence=sequence, is_visible=True)
	results = ThemeSerializer(themes, many=True).data
	return JsonResponse(results, safe=False)




def ajax_get_themes(request, sequence_id, classe_id):
	sequence = Sequence.objects.filter(created_by=request.user, id=sequence_id)[0]
	classe = Classe.objects.filter(created_by=request.user, id=classe_id)[0]
	themes = Theme.objects.filter(sequence=sequence, classes=classe, is_visible=True )
	results = ThemeSerializer(themes, many=True).data
	return JsonResponse(results, safe=False)








def json_examen_getChilds(request, examen_id):
	examen = get_object_or_404(Examen, id=examen_id)
	
	ct_json = examen_getChilds(examen)
	return JsonResponse(ct_json)
 




       
def json_sequence_getChilds(request, sequence_id):
	sequence = get_object_or_404(Sequence, id=sequence_id)
	
	children = [] 
	examen_ids = []
	examens = Examen.objects.filter(sequence=sequence)
	for exam in examens:
		examen_ids.append(exam.id)	
	for theme in Theme.objects.filter(sequence=sequence).exclude(pk__in=examen_ids):
		children.append(theme_getChilds(theme))
	
	for exam in examens:
		children.append(examen_getChilds(exam))
	#print(children)
	node_dict = {
		"id"  : "node_sequence_%s" % sequence.pk,
		"name": "Sequence %s" % sequence.numero,
		#"data": {"linkUrl": "#TODO", "linkName":"#TODO",  "relationWeight":rel_weight, "relationId":rel_id},
		"children":children,
		}
    
	ct_json = node_dict
	return JsonResponse(ct_json)
  




def ajax_get_sessions_data(request):
	sessions = Session.objects.filter(created_by=request.user)
	results = SessionSerializer(sessions, many=True).data
	return JsonResponse(results, safe=False)

    

@login_required    
def create_class(request):
    # # # BAD BAD BAD ASS fast and hacky #TODO
    if request.method == 'POST':
        name = request.POST.get('name', "None")
        classe = Classe.objects.create(name=name, created_by=request.user)
    return redirect("lessonapp:my_lessons")
    
    
def ajax_get_classes(request):
	classes = Classe.objects.filter(created_by=request.user)
	results = ClasseSerializer(classes, many=True).data
	return JsonResponse(results, safe=False)

    
  
@login_required    
def create_categorie(request):
    # # # BAD BAD BAD ASS fast and hacky #TODO
    if request.method == 'POST':
        name = request.POST.get('name', "None")
        categorie = Categorie.objects.create(name=name, created_by=request.user)
        sequence_id = request.POST.get('sequence_id')
        return redirect("lessonapp:sequence_edit", sequence_id=sequence_id)
    return redirect("lessonapp:my_lessons")
    

@login_required    
def create_objectif(request):
    # # # BAD BAD BAD ASS fast and hacky #TODO
    if request.method == 'POST':
        name = request.POST.get('name', "None")
        theme_id = request.POST.get('theme_id')
        theme = Theme.objects.get(id=theme_id)
        sequence_id = request.POST.get('sequence_id')
        objectif = Objectif.objects.create(name=name, theme=theme)
        return redirect("lessonapp:sequence_edit", sequence_id=sequence_id)
    return redirect("lessonapp:my_lessons")

    

@login_required(login_url="/users/login/")
def create_theme(request, sequence_id,  template="create_theme.html"):
    status=0
    if request.method == 'POST':
        form = CreateThemeForm(request.POST, request.FILES, user=request.user, sequence_id=sequence_id)
        if form.is_valid():
            theme = form.save("theme")
            #log_it(request, thread, ADDITION)
            status=1
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateThemeForm(user=request.user, sequence_id=sequence_id)
        
    sequence = get_object_or_404(Sequence, id=sequence_id)
    context_dict = {"form": form ,"sequence":sequence, "status":status}
    return render(request, 'lessonapp/create_theme.html', context_dict)



@login_required(login_url="/users/login/")
def create_examen(request, sequence_id,  template="create_theme.html"):
    if request.method == 'POST':
        form = CreateExamenForm(request.POST, user=request.user, sequence_id=sequence_id)
        if form.is_valid():
            theme = form.save()
            #log_it(request, thread, ADDITION)
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateExamenForm(user=request.user, sequence_id=sequence_id)
        
    sequence = get_object_or_404(Sequence, id=sequence_id)
    context_dict = {"form": form ,"sequence":sequence }
    return render(request, 'lessonapp/create_examen.html', context_dict)




@login_required    
def create_seance(request, theme_id, sequence_id):
    if request.method == 'POST':
        form = CreateSeanceForm(request.POST, user=request.user, theme_id=theme_id)
        if form.is_valid():
            seance = form.save()
            #log_it(request, thread, ADDITION)
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateSeanceForm(user=request.user, theme_id=theme_id)
    
    theme = get_object_or_404(Theme, id=theme_id)
    context_dict = {"form": form}
    return render(request, 'lessonapp/create_seance.html', { 'form': form , "theme":theme, "sequence_id":sequence_id })
    
    
    


@login_required    
def create_activity(request, seance_id, theme_id, sequence_id):
    if request.method == 'POST':
        form = CreateActivityForm(request.POST, user=request.user, seance_id=seance_id)
        if form.is_valid():
            activity = form.save("activity")
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateActivityForm(user=request.user, seance_id=seance_id)
        
    seance = get_object_or_404(Seance, id=seance_id)
    theme = get_object_or_404(Theme, id=theme_id)
    sequence = get_object_or_404(Sequence, id=sequence_id)
    context_dict = {"form": form}
    return render(request, 'lessonapp/create_activity.html', { 'form': form, "seance":seance, "theme":theme, "sequence":sequence })



@login_required    
def create_control(request, seance_id, theme_id, sequence_id):
    if request.method == 'POST':
        form = CreateControlForm(request.POST, user=request.user, seance_id=seance_id)
        if form.is_valid():
            control = form.save()
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateControlForm(user=request.user, seance_id=seance_id)
        
    seance = get_object_or_404(Seance, id=seance_id)
    theme = get_object_or_404(Theme, id=theme_id)
    sequence = get_object_or_404(Sequence, id=sequence_id)
    context_dict = {"form": form}
    return render(request, 'lessonapp/create_control.html', { 'form': form, "seance":seance, "theme":theme, "sequence":sequence })






@login_required    
def create_component(request, activity_id, seance_id, theme_id, choice_id, sequence_id):
	if request.method == 'POST':
		if choice_id == 3:
			form = CreateActivityComponentForm(request.POST, request.FILES, user=request.user, activity_id=activity_id, choice_id=choice_id, nodetype_id=24)
		else:
			form = CreateActivityComponentForm(request.POST, user=request.user, activity_id=activity_id, choice_id=choice_id, nodetype_id=24) 
		if form.is_valid():
			activity_component = form.save()
			#return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
	else:
		form = CreateActivityComponentForm(user=request.user, activity_id=activity_id, choice_id=choice_id, nodetype_id=24)
    
	activity = get_object_or_404(Activity, id=activity_id)    
	seance = get_object_or_404(Seance, id=seance_id)
	theme = get_object_or_404(Theme, id=theme_id)
	sequence = get_object_or_404(Sequence, id=sequence_id)
	context_dict = {"form": form}
	return render(request, 'lessonapp/create_component.html', { 'form': form, "activity":activity, "seance":seance, "theme":theme, "sequence":sequence, "choice_id":choice_id })
   





@login_required    
def create_file(request, activity_id, seance_id, theme_id, sequence_id, nodetype_id):
	if request.method == 'POST':
		if nodetype_id == 21 or nodetype_id == 41 or nodetype_id == 414:
			form = CreateMaterialFileForm(request.POST, request.FILES, user=request.user, activity_id=activity_id, nodetype_id=nodetype_id)
		elif nodetype_id == 51:
			form = CreateMaterialFileForm(request.POST, request.FILES, user=request.user, seance_id=seance_id, nodetype_id=nodetype_id)
			if form.is_valid():
				File = form.save()
				#log_it(request, thread, ADDITION)
				#return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
	else:
		if nodetype_id == 21 or  nodetype_id == 41 or nodetype_id == 414:
			form = CreateMaterialFileForm(user=request.user, activity_id=activity_id, nodetype_id=nodetype_id)
		elif nodetype_id == 51:
			form = CreateMaterialFileForm(user=request.user, seance_id=seance_id, nodetype_id=nodetype_id)
	 
	 
	     
	if nodetype_id == 21 or nodetype_id == 41 or nodetype_id == 414:
		activity = get_object_or_404(Activity, id=activity_id)
	else:
		
		activity = None
    
         
	seance = get_object_or_404(Seance, id=seance_id)
	theme = get_object_or_404(Theme, id=theme_id)
	context_dict = {"form": form}
	return render(request, 'lessonapp/create_file.html', { 'form': form, "activity":activity, "seance":seance, "theme":theme, "sequence_id":sequence_id, "nodetype_id":nodetype_id })
  



@login_required
def create_link(request, activity_id, seance_id, theme_id, sequence_id,  nodetype_id):
	if request.method == 'POST':
		if nodetype_id == 41 or nodetype_id == 414:
			form = CreateMaterialLinkForm(request.POST, request.FILES, user=request.user, activity_id=activity_id, nodetype_id=21)
		elif nodetype_id == 51:
			form = CreateMaterialLinkForm(request.POST, request.FILES, user=request.user, seance_id=seance_id, nodetype_id=51)
			
			if form.is_valid():
				Link = form.save()
				#log_it(request, thread, ADDITION)
				#return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
	else:
		if nodetype_id == 41 or nodetype_id == 414:
			form = CreateMaterialLinkForm(user=request.user, activity_id=activity_id, nodetype_id=21)
		elif nodetype_id == 51:
			form = CreateMaterialLinkForm(user=request.user, seance_id=seance_id, nodetype_id=51)
			
    
	if nodetype_id == 41 or nodetype_id == 414:
		activity = get_object_or_404(Activity, id=activity_id)
	else:
		
		activity = None  
	seance = get_object_or_404(Seance, id=seance_id)
	theme = get_object_or_404(Theme, id=theme_id)
	context_dict = {"form": form}
	return render(request, 'lessonapp/create_link.html', { 'form': form, "activity":activity, "seance":seance, "theme":theme, "sequence_id":sequence_id })
  


  

  
@login_required    
def create_question(request, activity_id, seance_id, theme_id,  sequence_id):
    if request.method == 'POST':
        form = CreateQuestionForm(request.POST, user=request.user, activity_id=activity_id)
        if form.is_valid():
            question = form.save()
            #log_it(request, thread, ADDITION)
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateQuestionForm(user=request.user, activity_id=activity_id)
        
    activity = get_object_or_404(Activity, id=activity_id)
    seance = get_object_or_404(Seance, id=seance_id)
    theme = get_object_or_404(Theme, id=theme_id)
    sequence = get_object_or_404(Sequence, id=sequence_id)
    context_dict = {"form": form}
    return render(request, 'lessonapp/create_question.html', { 'form': form, "activity":activity, "seance":seance, "theme":theme, "sequence":sequence })
    
    

@login_required    
def update_value(request):
    if request.method == 'POST':
        value = request.POST.get('value')
        case = request.POST.get('case')
        question_id = request.POST.get('question_id')
        question = Question.objects.get(id=question_id)
        activity_id = request.POST.get('activity_id')
        activity = Activity.objects.get(id=activity_id)
        sequence_id = request.POST.get('sequence_id')
        if case == "1":
        	activityquestion = Activityquestion.objects.filter(activity=activity, question=question).update(points = value)
        else: 
        	activityquestion = Activityquestion.objects.filter(activity=activity, question=question).update(number = value)
        return redirect("lessonapp:sequence_edit", sequence_id=sequence_id)
    return redirect("lessonapp:my_lessons")

    




@login_required
def create_checkbox(request, question_id,  sequence_id):
    if request.method == 'POST':
        form = CreateInputBoxForm(request.POST, user=request.user, question_id=question_id, nodetype_id=32)
        if form.is_valid():
            Checkbox = form.save()
            #log_it(request, thread, ADDITION)
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateInputBoxForm(user=request.user, question_id=question_id, nodetype_id=32)
        
    question = get_object_or_404(Question, id=question_id)
    #activity = get_object_or_404(Activity, id=activity_id)
    #seance = get_object_or_404(Seance, id=seance_id)
    sequence = get_object_or_404(Sequence, id=sequence_id)
    context_dict = {"form": form}
    return render(request, 'lessonapp/create_checkbox.html', { 'form': form, "question":question,  "sequence":sequence})



@login_required
def save_response_input(request, inputbox_id, checked):
	inputbox=   InputQuestionBox.objects.filter(id = inputbox_id)[0]
	if not CheckedResponseInputQuestion.objects.filter(input_question_box=inputbox, owner=request.user).exists():
		checkedResponseInputQuestion = CheckedResponseInputQuestion(input_question_box=inputbox, owner=request.user, checked=checked)
		checkedResponseInputQuestion.save()	   
		return JsonResponse({"success":True})
	else:
		CheckedResponseInputQuestion.objects.filter(input_question_box=inputbox, owner=request.user).update(checked = checked)
		return JsonResponse({"success":True})
	return JsonResponse({"success":False})




@login_required
def activity_save_state(request, activity_id, state):
	if Activity.objects.filter(id = activity_id).exists():
		activity = Activity.objects.filter(id = activity_id)[0]
		activity.state = state
		activity.save()
		return JsonResponse({"success":True})
	
	return JsonResponse({"success":False})
		
	
		


 

@login_required
def create_radio(request, question_id, sequence_id):
    if request.method == 'POST':
        form = CreateInputBoxForm(request.POST, user=request.user, question_id=question_id, nodetype_id=33)
        if form.is_valid():
            Radio = form.save()
            #log_it(request, thread, ADDITION)
            #return redirect('lessonapp:sequence_edit', sequence_id=sequence_id)
    else:
        form = CreateInputBoxForm(user=request.user, question_id=question_id, nodetype_id=33)
        
    question = get_object_or_404(Question, id=question_id)
    #activity = get_object_or_404(Activity, id=activity_id)
    #seance = get_object_or_404(Seance, id=seance_id)
    sequence = get_object_or_404(Sequence, id=sequence_id)
    context_dict = {"form": form}
    return render(request, 'lessonapp/create_radio.html', { 'form': form, "question":question, "sequence":sequence})
 
       
   
   

    
    
