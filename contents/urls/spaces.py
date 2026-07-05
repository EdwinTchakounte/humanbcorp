from django.urls import path
from .. import views


app_name = 'contents'

urlpatterns = [
	path("create/", views.create_space, name="create_space"),
	path("show_spaces/<private>", views.show_spaces, name="public_spaces"),
	path("show_spaces/<private>", views.show_spaces, name="private_spaces"),
	path("show_all_spaces/", views.show_all_spaces, name="all_public_spaces"),
	path("from_content/<space_id>/", views.show_space_of_content, name="show_space_of_content"),
	path("ajax_get_spaces_data/<private>/<for_user>", views.ajax_get_spaces_data, name="get_ajax_spaces"),
	path("ajax_get_space_data/<space_id>", views.ajax_get_space_data, name="get_ajax_space"),
    
]
