from django.urls import path
from .. import views
from ..views import SearchResultsView


app_name = 'contents'

urlpatterns = [
	path("create/child/", views.create_child, name="create_child"),
	path("new/<space_id>", views.create_publication, name="create_publication"),
	path("new/", views.create_publication, name="create_publication"),
	path("search/", SearchResultsView.as_view(), name="search_results"),
	path("<space_id>/<publication_id>/", views.show_publication, name="show_publication"),
	path("<publication_id>/", views.show_publication, name="show_publication"),
	path('ajax_get_publication/<publication_id>', views.ajax_get_publication, name="ajax_get_publication"),
	
	
    
]

