from django.urls import path
from .. import views

#from bucket import views


app_name = 'contents'

urlpatterns = [
	path("publication/<publication_id>", views.json_publication_relations, name="json_publication_relations"),
	path('publications/<publication_id_1>/<publication_id_2>', views.rel_publications, name="content_rel_publication"),
	  	
    
]

