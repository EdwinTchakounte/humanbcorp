
from django.urls import path
from . import views

app_name = 'paiement'

urlpatterns = [
    path("entrant/", views.paiement_entrant, name="paiement_entrant"),
    path("ajax_get_paiement_data", views.ajax_get_paiement_data, name="get_ajax_paiement_data"),
    path("ajax_get_all_paiements_data", views.ajax_get_all_paiements_data, name="get_ajax_all_paiements_data"),
    path("read_enter_paiements/", views.read_enter_paiements, name="read_enter_paiements"),
    path("read_enter_all_paiements/", views.read_enter_all_paiements, name="read_enter_all_paiements"),
    path("ajax_get_order_data", views.ajax_get_order_data, name="get_ajax_order_data"),
    path("read_my_orders/", views.read_my_orders, name="read_my_orders"),
    
]
