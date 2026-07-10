
from django.urls import path
from . import views

app_name = 'bucket'

urlpatterns = [
    path("", views.bucket, name="bucket"),
    path("cart/", views.cart, name="cart"),
    path("convert/", views.convert_to_space, name="convert_to_space"),
    #path('rel/publications/<publication_id_1>/<publication_id_2>', views.rel_publications, name="bucket_rel_publication"),
    path('add/publication/<publication_id>', views.add_publication_to_bucket, name="bucket_add_publication"),
    path('check_inscription_exist/<participant_id>/<publication_id>', views.check_inscription_exist, name="bucket_check_inscription_exist"),
    path('from_reseravtion_make_order/<reservation_id>', views.from_reseravtion_make_order, name="from_reseravtion_make_order"),
    path('add_reservations_of_inscriptions/', views.add_reservations_of_inscriptions, name="add_reservations_of_inscriptions"),
    path('remove/publication/<publication_id>', views.remove_publication_from_bucket, name="bucket_remove_publication"),
    path('remove/inscription/<inscription_id>', views.remove_inscription_from_bucket, name="bucket_remove_inscription"),
    
    path('add_publications_to_bucket_of_inscriptions/', views.add_publications_to_bucket_of_inscriptions, name="add_publications_to_bucket_of_inscriptions"),
    
    path('create/reservation/<publication_id>', views.create_reservation, name="create_reservation"),
    #path('remove/publication/<publication_id>/<inscription_id>', views.remove_publication_from_inscription, name="inscription_remove_publication"),
    path("ajax_get_contents_data", views.ajax_get_contents_data, name="get_ajax_contents"),
    path("ajax_get_cart_data", views.ajax_get_cart_data, name="get_ajax_cart_data"),
    path("ajax_get_reservations", views.ajax_get_reservations, name="get_ajax_reservations"),
    path("ajax_get_reservated_users", views.ajax_get_reservated_users, name="get_ajax_reservated_users"),
    path("ajax_get_test_events/<publication_id>", views.ajax_get_test_events, name="get_ajax_test_events"),
    
    
    
]
