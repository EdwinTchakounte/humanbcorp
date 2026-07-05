
from django.urls import path
from . import views

app_name = 'lessonapp'

urlpatterns = [
    path("", views.my_lessons, name="my_lessons"),
    path("read_lessons/", views.read_lessons, name="read_lessons"),
    
    path("categorie/create/", views.create_categorie, name="create_categorie"),
    
    path("class/create/", views.create_class, name="create_class"),
    path("class/ajax_get_classes/", views.ajax_get_classes, name="get_ajax_classes" ),
    
    path("objectif/create/", views.create_objectif, name="create_objectif"),
    path("objectif/getChilds/<int:objectif_id>/", views.json_objectif_getChilds, name="json_objectif_Childs"),
    
   
    path("question/create/<int:activity_id>/<int:seance_id>/<int:theme_id>/<int:sequence_id>", views.create_question, name="create_question"),
    path("question/getChilds/<int:question_id>/", views.json_question_getChilds, name="json_question_Childs"),
    path("question/ajax_get_questions/<int:activity_id>/", views.ajax_get_questions, name="get_ajax_questions" ),
    path("question/ajax_get_question_activities/<int:question_id>", views.ajax_get_question__activities, name="get_question__activities"),
    path("question/update_value/", views.update_value, name="update_value"),
    
    
    path("file/create/<int:activity_id>/<int:seance_id>/<int:theme_id>/<int:sequence_id>/<int:nodetype_id>", views.create_file, name="create_file"),
    path("file/getChilds/<int:matactivitydoc_id>/", views.json_matActivityFile_getChilds, name="json_matActivityFile_Childs"),
    path("response_file/getChilds/<int:matresponseactivitydoc_id>/", views.json_matResponseActivityFile_getChilds, name="json_matResponseActivityFile_Childs"),
    path("response_correction_file/getChilds/<int:matresponseactivitydoc_id>/", views.json_matResponseActivityCorrectionFile_getChilds, name="json_matResponseActivityCorrectionFile_Childs"),
    path("link/create/<int:activity_id>/<int:seance_id>/<int:theme_id>/<int:sequence_id>/<int:nodetype_id>", views.create_link, name="create_link"),
    path("link/getChilds/<int:matactivitydoc_id>/", views.json_matActivityLink_getChilds, name="json_matActivityLink_Childs"),
    
    
    path("checkbox/create/<int:question_id>/<int:sequence_id>", views.create_checkbox, name="create_checkbox"),
    path("checkbox/getChilds/<int:inputbox_id>/", views.json_checkbox_getChilds, name="json_checkbox_Childs"),
    path("radio/create/<int:question_id>/<int:sequence_id>", views.create_radio, name="create_radio"),
    path("radio/getChilds/<int:inputbox_id>/", views.json_radio_getChilds, name="json_radio_Childs"),
    path("reponse/input/create/<int:inputbox_id>/<int:checked>", views.save_response_input, name="save_response_input"),

    path("activity/create/<int:seance_id>/<int:theme_id>/<int:sequence_id>", views.create_activity, name="create_activity"),
    path("activity/getChilds/<int:activity_id>/", views.json_activity_getChilds, name="json_activity_Childs"),
    path("control/create/<int:seance_id>/<int:theme_id>/<int:sequence_id>", views.create_control, name="create_control"),
    path("control/getChilds/<int:control_id>/", views.json_control_getChilds, name="json_control_Childs"),
    path("activity/save_state/<int:activity_id>/<int:state>", views.activity_save_state, name="activity_save_state"),
    
    path("component/create/<int:activity_id>/<int:seance_id>/<int:theme_id>/<int:choice_id>/<int:sequence_id>", views.create_component, name="create_component"),
    path("component/getChilds/<int:component_id>/", views.json_component_getChilds, name="json_component_Childs"),

  
    path("seance/create/<int:theme_id>/<int:sequence_id>", views.create_seance, name="create_seance"),
    path("seance/getChilds/<int:seance_id>/", views.json_seance_getChilds, name="json_seance_Childs"),
    
    
    path("session/create/", views.create_session, name="create_session"),
    path("session/ajax_get_sessions_data/", views.ajax_get_sessions_data, name="get_ajax_sessions" ),
   
    
    path("sequence/create/", views.create_sequence, name="create_sequence"),
    path('sequence/edit/<int:sequence_id>/', views.edit_sequence, name='sequence_edit'),
    path("sequence/getChilds/<int:sequence_id>/", views.json_sequence_getChilds, name="json_sequence_Childs"),
    path("sequence/ajax_get_sequences_data/", views.ajax_get_sequences_data, name="get_ajax_sequences" ),
    path("sequence/ajax_get_sequences_from_session_id/<int:session_id>/", views.ajax_get_sequences_from_session_id, name="get_ajax_sequences_from_session_id" ),
    path("sequence/ajax_get_sessions_sequences_data/", views.ajax_get_sessions_sequences_data, name="get_ajax_sessions_sequences" ),
    
    path("theme/create/<int:sequence_id>", views.create_theme, name="create_theme"),
    path("theme/getChilds/<int:theme_id>/", views.json_theme_getChilds, name="json_theme_Childs"),
    path("examen/getChilds/<int:examen_id>/", views.json_examen_getChilds, name="json_examen_Childs"),
    path("theme/ajax_get_themes_from_sequence_id/<int:sequence_id>/", views.ajax_get_themes_from_sequence_id, name="get_ajax_themes_from_sequence_id" ),
    
    path("theme/ajax_get_themes/<int:sequence_id>/<int:classe_id>/", views.ajax_get_themes, name="get_ajax_themes" ),
     
    path("read_theme/<int:theme_id>", views.read_theme, name="read_theme"),
    path("examen/create/<int:sequence_id>", views.create_examen, name="create_examen"),
    path("examen/getChilds/<int:examen_id>/", views.json_examen_getChilds, name="json_examen_Childs")
	  
    
    
   
    
    
]
