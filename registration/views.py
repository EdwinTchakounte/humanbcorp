from django.shortcuts import render,  redirect
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.contrib.sites.shortcuts import get_current_site
from registration.models import RegistrationManager, RegistrationProfile
from registration.forms import  RegistrationForm
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from django.contrib.auth import login, logout
import json
from django.core import serializers
from django.views.decorators.csrf import csrf_protect
from django.core.mail import send_mail
from django.contrib import messages

# Create your views here.

@csrf_protect
def new_user_view(request, template="registration_form.html"):
	if request.method == 'POST':
		form = RegistrationForm(request.POST)
		if form.is_valid():
			new_user = form.save()
			login(request, new_user, backend="allauth.account.auth_backends.AuthenticationBackend")
			return redirect("/")
		   
	else:
		form = RegistrationForm()
	context_dict = {"form": form}
	return render(request, 'registration/registration_form.html', { 'form': form })
	    


@csrf_protect
def admin_new_user_view(request, template="registration_form.html"):
	group_type = "Admin"
	if request.user.groups.filter(name__icontains="Second_Admin").exists():
		group_type = "Second_Admin"
	
	if request.method == 'POST':
		form = RegistrationForm(request.POST, group_type=group_type, user_id=request.user.id)
		if form.is_valid():
			new_user = form.save()
			login(request, new_user, backend="allauth.account.auth_backends.AuthenticationBackend")
			return redirect("/")
		   
	else:
		form = RegistrationForm(group_type=group_type, user_id=request.user.id)
	context_dict = {"form": form}
	return render(request, 'registration/registration_admin_add_form.html', context_dict)
	


def new_participant(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        new_user = RegistrationProfile.objects.create_participant_user(username, email, password)
        response_data = {}
        response_data['id'] = new_user.id
        response_data['username'] = username
        response_data['email'] = email
        response_data['password'] = password
        return JsonResponse(response_data)    
    else:
        return JsonResponse({'message': 'Error!'}, status=400)    





def ajax_get_users(request): 
	username_query = request.GET.get('username_query', '')
	users = User.objects.filter(username__startswith=username_query)
	#users = User.objects.all()
	users_results = []
	
	for u in users:
		response_data = {}
		response_data['id'] = u.id
		response_data['username'] = u.username
		response_data['first_name'] = u.first_name
		response_data['email'] = u.email
		users_results.append(response_data)
        	#usernames.append(u.username + " " + u.first_name)
	return JsonResponse(users_results, safe=False)
	
	
def ajax_get_user(request, user_id): 
	user = User.objects.get(id=user_id)
	response_data = {}
	response_data['id'] = user.id
	response_data['username'] = user.username
	response_data['email'] = user.email
	response_data['password'] = user.password
	return JsonResponse(response_data)



        

def activate_view(request, *args, **kwargs):
	activation_key = kwargs.get('activation_key', '')
	site = get_current_site(request)
	activated = RegistrationProfile.objects.activate_user(activation_key)
	#if not activated:
		#return redirect("/")
	#signals.user_activated.send(sender=self.__class__, user=user, request=self.request)
	return redirect("/") 
        
        
def login_view(request):
	#next_url = request.GET.get("next_url")
	page_id = request.GET.get("page_id")
	page_type = request.GET.get("page_type")
	if request.method == "POST":
		form = AuthenticationForm(data=request.POST)
		if form.is_valid():
			login(request, form.get_user())
			page_id = request.POST.get("page_id")
			page_type = request.POST.get("page_type")
			if page_type == "t":
				return redirect("lessonapp:read_theme", theme_id=page_id)
			elif page_type == "reserve":
				return redirect("bucket:create_reservation", publication_id=page_id)
			elif page_type == "new_space":
				return redirect("contents:create_space")
			elif page_type == "new_publication":
				return redirect("contents:create_publication", publication_id=page_id)
			elif page_type == "event_themes":
				return redirect("calendarapp:event-themes")
			elif page_type == "event_details":
				return redirect("calendarapp:event_details", event_id=page_id)
			elif page_type == "calendar":
				return redirect("calendarapp:calendar")
			
			else:
				return redirect("/")
			
	else:
		form = AuthenticationForm()
	return render (request, "registration/login.html", {"form":form, "page_id":page_id, "page_type":page_type})
	
	
def logout_view(request):
	if request.method == "POST":
		logout(request)
		return redirect("/")	
		
		

def send_email(request):
    if request.method == 'POST':
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        company = request.POST.get('company')
        service = request.POST.get('service')
        phone = request.POST.get('phone')
        email = request.POST.get('email')
        message = request.POST.get('message')

        # Sujet et contenu du mail
        subject = f"HBC-RH — Nouvelle demande de {first_name} {last_name}"
        full_message = f"""
        Vous avez reçu une nouvelle demande via le formulaire de contact HBC-RH :

        Nom : {first_name} {last_name}
        Entreprise : {company}
        Email : {email}
        Téléphone : {phone}
        Service souhaité : {service}

        Message :
        {message}
        """

        try:
            send_mail(
                subject,
                full_message,
                email,  # Adresse de l'expéditeur
                ['recrutementhbcrh@gmail.com'],  # Adresse de réception HBC-RH
                fail_silently=False,
            )
            messages.success(request, "Votre message a été envoyé avec succès !")
        except Exception as e:
            messages.error(request, f"Erreur lors de l'envoi du message : {e}")

        return redirect('/')  # Redirige où tu veux (page d'accueil par ex.)

    return redirect('/')
