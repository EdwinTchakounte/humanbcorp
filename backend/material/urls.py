
from django.urls import path
from . import views

app_name = "material"

urlpatterns = [
    #path("new_file/<event_id>/<nodetype_id>/", views.new_file, name="event_new_file"),
    #path("new_link/<event_id>/<nodetype_id>/", views.new_link, name="event_new_link"),
    #path("new_inputbox/<question_id>/<nodetype_id>/", views.new_inputbox, name="question_new_inputbox"),
    path("show_material/<material_id>/", views.show_material, name="documents_show_material"),
    path("show_materials/<event_id>/", views.show_materials, name="documents_show_materials"),
       
    
]
