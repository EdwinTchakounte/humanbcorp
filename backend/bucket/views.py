from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.template import RequestContext
from django.http import HttpResponse, JsonResponse
import json as simplejson
from django.core import serializers
from django.contrib.auth.models import User
from .models import BucketOfContents, BucketOfInscriptions, Inscription, Order, OrderInscription, Reservation
from contents.models import Publication, Space
from bucket.serializers import BucketOfContentsSerializer, InscriptionSerializer
from contents.serializers import PublicationSerializer
import decimal
from django.db.models import Q
from calendarapp.models import EventMember, Event, Meeting, EventTheme
from django.utils import formats



JSON_DICT = {"success":True}
JSON_DICT_FALSE = {"success":False}



def bucket(request, template="bucket.html"):
    #bucket = BucketOfContents.objects.get_or_create(owner=request.user)
    #context_dict = {"bucket":bucket}
    return render(request, 'bucket/bucket.html', { })

def cart(request, template="cart.html"):
    bucket = BucketOfInscriptions.objects.get_or_create(owner=request.user)
    inscriptions = bucket.inscriptions.all()
    context_dict = {"order":0}
    if inscriptions.count() > 0:
    	orderInscription = OrderInscription.objects.get(inscription=inscriptions[0])
    	context_dict = {"order":orderInscription.order}
    
    return render(request, 'bucket/cart.html', context_dict )
    
def ajax_get_contents_data(request):
    bucket = BucketOfContents.objects.filter(owner=request.user)
    results = BucketOfContentsSerializer(bucket, many=True).data
    return JsonResponse(results, safe=False)
    

def ajax_get_cart_data(request):
	bucket = BucketOfInscriptions.objects.get_or_create(owner=request.user)
	
	inscriptions_dict = {}
	inscriptions_dicts = []
   
	
	#inscriptions = Inscription.objects.filter(order=order, status=1).order_by("participant")
	for inscription in bucket.inscriptions.all():
		publication_dict = {
			"id": inscription.publication.id,
			"title": inscription.publication.title,
			"description": inscription.publication.description,
			"price": inscription.publication.price,
			"is_private": inscription.publication.is_private,			
			
		}
			#publications_dicts.append(PublicationSerializer(inscription.publication, many=True).data)
		user = inscription.participant
			
		inscriptions_dict = {
			"id"  : inscription.pk,
			"participant": user.pk,
			"participant_name": user.username,
			"publications": [publication_dict],
			}
		# check if this inscription was already saved inside inscriptions_dicts
		itemFound = False
		for item in inscriptions_dicts:
			if item["participant"] == inscriptions_dict["participant"]:
				item["publications"].append(publication_dict)
				itemFound = True
		if itemFound == False:
			inscriptions_dicts.append(inscriptions_dict)
				
			
  
	#print(inscriptions_dicts)
	return JsonResponse(inscriptions_dicts, safe=False)
    

def add_publication_to_bucket(request, publication_id):
    bucket = BucketOfContents.objects.get_or_create(owner=request.user)
    publication = get_object_or_404(Publication, pk=publication_id)
    bucket.add_publication(request.user, publication)
    ct_json = JSON_DICT
    return JsonResponse(ct_json)


    



def add_or_create_inscription2(participant_id, publication_id, status):
	foundUser = User.objects.get(id=participant_id)
	publication = Publication.objects.filter(pk=publication_id)[0]
	if Inscription.objects.filter(participant=foundUser, status__in=[0, 1], publication=publication).exists():
		inscription = Inscription.objects.get(participant=foundUser, publication=publication)

	else:	
		inscription = Inscription.objects.create(participant=foundUser, status=status, publication=publication)
	return inscription


def check_inscription_exist(request, participant_id, publication_id):
	#bucket = BucketOfInscriptions.objects.get_or_create(owner=request.user)
	foundUser = User.objects.get(id=int(participant_id))
	publication = Publication.objects.filter(pk=publication_id)[0]
	ct_json_false = JSON_DICT_FALSE
	ct_json = JSON_DICT
	if Inscription.objects.filter(participant=foundUser, status__in=[0, 1], publication=publication).exists():
		inscription = Inscription.objects.get(participant=foundUser, status__in=[0, 1], publication=publication)
		#print(inscription)
		return JsonResponse(ct_json)
									
	else:	
		return JsonResponse(ct_json_false)
	return JsonResponse(ct_json_false)
		



def add_inscription_into_order(request, bucket, inscription, order):	
	if not OrderInscription.objects.filter(order=order, inscription=inscription).exists():
		bucket.inscriptions.add(inscription)
		order.total_amount = decimal.Decimal(order.total_amount) + decimal.Decimal(inscription.publication.price)
		order.save()
		OrderInscription.objects.create(order=order, inscription=inscription)
	


def ajax_get_reservations(request):
	reservations_list = []
	admin = False
	user = request.user
	# Fail-closed. Un visiteur anonyme n'appartient à aucun groupe : il tombait
	# donc dans la branche « else », prévue pour les administrateurs, et
	# récupérait TOUTES les réservations — e-mails et téléphones des parents —
	# sans la moindre authentification, en étant qui plus est marqué admin=True.
	# Le privilège doit être accordé explicitement, jamais obtenu par défaut.
	if not user.is_authenticated:
		return JsonResponse([], safe=False)
	if user.groups.filter(name='Simple_Customer').exists():
		reservations = Reservation.objects.filter(inscription__participant=user)
	elif user.groups.filter(name='Parent').exists():
		reservations = Reservation.objects.filter(created_by=user)
	elif user.is_superuser or user.is_staff or user.groups.filter(name__icontains='admin').exists():
		reservations = Reservation.objects.all()
		admin = True
	else:
		reservations = Reservation.objects.none()
	
	
	
	for reservation in reservations:
		events_list = []
		if not OrderInscription.objects.filter(inscription=reservation.inscription).exists():
			if reservation.event is not None:
				event_dict = {
					"id"  : reservation.event.id,
					"title": reservation.event.title,
					"start_time":  formats.date_format(reservation.event.start_time, "N j, Y, P"), 
					"end_time": formats.date_format(reservation.event.end_time, "N j, Y, P"), 
				}
				events_list.append(event_dict)
			else:
				event_dict = {
					"id"  : 0,
					"title": "En attente du Test gratuit",
					"start_time": "---",
					"end_time": "---",
				}
				events_list.append(event_dict)
				
			
			reservation_dict = {
				"reservation_id":reservation.pk,
				"id"  : reservation.inscription.publication.pk,
				"title": reservation.inscription.publication.title,
				"price": reservation.inscription.publication.price,
				"events":events_list,
				"list_attente": reservation.list_attente,
				"email_parent":reservation.email_parent,
				"telephone_parent":reservation.telephone_parent,
				"admin":admin,
			}
			reservations_list.append(reservation_dict)
	
	return JsonResponse(reservations_list, safe=False)	
		



def  ajax_get_reservated_users(request):
    # Anonyme : `created_by=AnonymousUser` lève un TypeError (500 exposant la
    # trace). Rien à renvoyer à qui n'est pas connecté.
    if not request.user.is_authenticated:
        return JsonResponse([], safe=False)
    reservations = Reservation.objects.filter(created_by=request.user)
    users_results = []
    seen_ids = set()  # Pour éviter les doublons

    for reservation in reservations:
        participant = reservation.inscription.participant

        if participant.id not in seen_ids:
            users_results.append({
                'id': participant.id,
                'username': participant.username,
                'first_name': participant.first_name,
                'email': participant.email
            })
            seen_ids.add(participant.id)

    return JsonResponse(users_results, safe=False)

	
	
def ajax_get_test_events(request, publication_id):
	publication = Publication.objects.filter(pk=publication_id)[0]
	events_list =[]
	for event in publication.events.all().order_by('created_at'):
		if event.is_test == True:
			if Reservation.objects.filter(event=event).count() < 1:
				event_dict = {
					"id"  : event.pk,
					"title": event.title,
					"start_time":  formats.date_format(event.start_time, "N j, Y, P"), 
					"end_time": formats.date_format(event.end_time, "N j, Y, P"), 
				}
				events_list.append(event_dict)
	return JsonResponse(events_list, safe=False)
		



def create_reservation(request, publication_id):
	if not request.user.is_authenticated:
		return redirect("/registration/login/?page_id=%s&page_type=reserve" %   publication_id )
	publication = Publication.objects.filter(pk=publication_id)[0]		
	context_dict = {"publication":publication}
    
	return render(request, 'bucket/reservations.html', context_dict )
    



def add_reservations_of_inscriptions(request):
	ct_json = JSON_DICT_FALSE
	if request.method == 'POST':
		publication_id = request.POST.get('publication_id')
		number_of_participants = request.POST.get('index')
		for index in range(1, int(number_of_participants) + 1):
			user_name = str(request.POST.get('participant_name_'+ str(index)))
			user_id = request.POST.get('participantId_'+ str(index))
			event_id = request.POST.get('reserved_event_'+ str(index))
			email_parent = request.POST.get('email_'+ str(index))
			telephone_parent = request.POST.get('telephone_'+ str(index))
			
			
			
			
			
			if int(publication_id) != int(0) :
				publication = Publication.objects.filter(pk=publication_id)[0]
				inscription = add_or_create_inscription2(user_id, publication_id, 0)
				if event_id is None:
					reservation = Reservation.objects.create(created_by=request.user, inscription=inscription, email_parent=email_parent, telephone_parent=telephone_parent, list_attente=True)
				else:
					event = Event.objects.filter(pk=event_id)[0]
					reservation = Reservation.objects.create(created_by=request.user, event=event, inscription=inscription, email_parent=email_parent, telephone_parent=telephone_parent, list_attente=False)
				ct_json = JSON_DICT
				#return redirect("calendarapp:event-themes")
				

				
			else:
				space_id = request.POST.get('space_id')
				space = Space.objects.filter(pk=space_id)[0]
				for publication in space.get_publications():
					if not publication.is_private:
						inscription = add_or_create_inscription2(user_id, publication_id, 0)
						if event_id is None:
							reservation = Reservation.objects.create(created_by=request.user, inscription=inscription, email_parent=email_parent, telephone_parent=telephone_parent, list_attente=True)
						else:
							reservation = Reservation.objects.create(created_by=request.user, event=event, inscription=inscription, email_parent=email_parent, telephone_parent=telephone_parent, list_attente=False)
				ct_json = JSON_DICT
				#return redirect("calendarapp:event-themes")

				
		
	return JsonResponse(ct_json)
	#return redirect("calendarapp:event-themes")

	




def add_publications_to_bucket_of_inscriptions(request):
	if request.method == 'POST':
		bucket = BucketOfInscriptions.objects.get_or_create(owner=request.user)
		order = Order.objects.get_or_create(buyer=request.user, status=1)
				
		publication_id = request.POST.get('publication_id')
		number_of_participants = request.POST.get('index')
		for index in range(1, int(number_of_participants) + 1):
			user_name = str(request.POST.get('participant_name_'+ str(index)))
			user_id = request.POST.get('participantId_'+ str(index))
			if int(publication_id) != int(0) :
				publication = Publication.objects.filter(pk=publication_id)[0]
				inscription = add_or_create_inscription2(user_id, publication_id, 1)
				add_inscription_into_order(request, bucket, inscription, order)
				
			else:
				space = Space.objects.filter(pk=space_id)[0]
				for publication in space.get_publications():
					if not publication.is_private:
						inscription = add_or_create_inscription2(user_id, publication_id, 1)
						add_inscription_into_order(request, bucket, inscription, order)
				
		ct_json = {"success":True}
	return JsonResponse(ct_json)




	

def from_reseravtion_make_order(request, reservation_id):
	ct_json = JSON_DICT_FALSE
	reservation = Reservation.objects.filter(pk=reservation_id)[0]
	order = Order.objects.get_or_create(buyer=request.user, status=1)
	inscription = reservation.inscription
	inscription.status = 1
	inscription.save()
	bucket = BucketOfInscriptions.objects.get_or_create(owner=request.user)
	add_inscription_into_order(request, bucket, inscription, order)
	ct_json = JSON_DICT
	return JsonResponse(ct_json)

def remove_publication_from_bucket(request, publication_id):
    bucket = BucketOfContents.objects.get_or_create(owner=request.user)
    publication = get_object_or_404(Publication, pk=publication_id)
    bucket.remove_publication(request.user, publication)
    ct_json = JSON_DICT
    return JsonResponse(ct_json)
    
def remove_inscription_from_bucket(request, inscription_id):
    bucket = BucketOfInscriptions.objects.get_or_create(owner=request.user)
    inscription = get_object_or_404(Inscription, pk=inscription_id)
    bucket.remove_inscription(inscription)
    
    
    if OrderInscription.objects.filter(inscription=inscription).exists():
    	orderInscription = OrderInscription.objects.get(inscription=inscription)
    	order = orderInscription.order    
    	orderInscription.delete()
    
    	inscription.delete()
    	if not OrderInscription.objects.filter(order=order).exists():
    		order.delete()
    	else:
    		order.total_amount = decimal.Decimal(order.total_amount) - decimal.Decimal(inscription.publication.price)
    		order.save()
     
    ct_json = JSON_DICT
    return JsonResponse(ct_json)
    

 
   
  
      
 
@login_required(login_url="/users/login/")
def convert_to_space(request):
    # # # BAD BAD BAD ASS fast and hacky #TODO
    if request.method == 'POST':
        title = request.POST.get('title2', "None")
        is_private = request.POST.get('is_private2', False)
        bucket = BucketOfContents.objects.get_or_create(owner=request.user)
        space = bucket.convert_to_space(title, is_private, True)
    return redirect("contents:private_spaces", private=False)
    
 



