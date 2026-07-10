
from django.urls import path
from . import views

app_name = 'registration'

urlpatterns = [
    path('new_user/', views.new_user_view, name="new_user"),
    path('admin_new_user/', views.admin_new_user_view, name="admin_new_user"),
    path('new_participant/', views.new_participant, name="new_participant"),
    path('activate/<activation_key>', views.activate_view, name="activate"),
    path('login/', views.login_view, name="login"),
    path('logout/', views.logout_view, name="logout"),
    path('ajax_get_users/', views.ajax_get_users, name="ajax_get_users"),
    path('ajax_get_user/<user_id>', views.ajax_get_user, name="ajax_get_user"),
    path('send_email/', views.send_email, name="send_email"),
]
