from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.template import RequestContext
from django.http import HttpResponse, JsonResponse
import json as simplejson
from django.core import serializers
from django.db.models import Case, When, Value, IntegerField
from django.contrib.auth.models import User
from bucket.models import Bucket, BucketOfInscriptions, Inscription, Order, OrderInscription
from .models import Paiement, PaiementEntrant
from paiement.serializers import PaiementEntrantSerializer
from django.db.models import Q



# Create your views here.
JSON_DICT = {"success":True}
JSON_DICT_FALSE = {"success":False}


def remove_inscriptions_from_bucket(order):
	bucket = BucketOfInscriptions.objects.filter(owner=order.buyer)[0]
	orderInscriptions = OrderInscription.objects.filter(order=order)
	for orderInscription in orderInscriptions:
		inscription = orderInscription.inscription
		bucket.remove_inscription(inscription)
		inscription.status = 2
		inscription.save()
	if bucket.inscriptions.all().count() == 0:
		bucket.delete()
		


def paiement_entrant(request):
	if request.method == 'POST':
		payerId = request.POST.get('payerId')
		payer = User.objects.get(id=payerId)
		
		orderId = request.POST.get('orderId')
		order = Order.objects.get(id=orderId)
		paiement_tranche = request.POST.get('tranche_name')

		# paiement first tranche
		if paiement_tranche == 1:			
			montant_tranche = request.POST.get('montant_tranche');
			#get last paiement successful
			#PaiementEntrant.objects.order_by('id')[0]
			
			paiement_entrant = PaiementEntrant.objects.create(owner=payer, tranche=paiement_tranche, montant=montant_tranche,  status=1,order=order)
			order.status = 3
			order.save()			
			remove_inscriptions_from_bucket(order)
			
		# Paiement entier		
		else:
			montant = order.total_amount;
			paiement_entrant = PaiementEntrant.objects.create(owner=payer, montant=montant,  status=1, order=order)
			order.status = 2
			order.save()
			remove_inscriptions_from_bucket(order)
		
			
	return redirect("paiement:read_enter_paiements")




def get_json_paiements(entrants_paiements, group):
	paiements_dicts = []
	for entrant_paiement in entrants_paiements:
		orderInscriptions = OrderInscription.objects.filter(order=entrant_paiement.order)		
		totalPrice = 0
		orders_dicts = []
		inscriptions_dicts = []
		for orderInscription in orderInscriptions:
			if (group == 1) or (group == 3) or (
    				group == 2 and
    				orderInscription.inscription.publication.spaces.filter(owner=request.user).exists() 
			):
				totalOrderPrice = 0
				
				publication_dict = {
					"id": orderInscription.inscription.publication.id,
					"title": orderInscription.inscription.publication.title,
					"description": orderInscription.inscription.publication.description,
					"price": orderInscription.inscription.publication.price,
					"is_private": orderInscription.inscription.publication.is_private,
				}
				totalPrice = totalPrice + orderInscription.inscription.publication.price
				totalOrderPrice = totalOrderPrice + orderInscription.inscription.publication.price
					
				user = orderInscription.inscription.participant
					
				inscriptions_dict = {
					"id"  : orderInscription.inscription.pk,
					"participant": user.pk,
					"participant_name": user.username,
					"status": orderInscription.inscription.status,
					"publications": [publication_dict],
				}
				inscriptions_dicts.append(inscriptions_dict)
		order_dict = {
			"id"  : entrant_paiement.order.pk,
			"created_by_name": entrant_paiement.order.buyer.username,
			"created_by_id": entrant_paiement.order.buyer.id,
			"status": entrant_paiement.order.status,
			"totalOrderPrice":entrant_paiement.order.total_amount,
			"inscriptions": inscriptions_dicts,
		}
		orders_dicts.append(order_dict)
		
		entrant_paiements_dict = {
			"id"  : entrant_paiement.pk,
			"success": entrant_paiement.status,
			"montant": entrant_paiement.montant,
			"api_key": entrant_paiement.api_key,
			"tranche": entrant_paiement.tranche,
			"totalPrice":entrant_paiement.order.total_amount,
			"parent": entrant_paiement.parent,
			"orders": orders_dicts,
		}		
					
		paiements_dicts.append(entrant_paiements_dict)	
	
	
	#results = PaiementEntrantSerializer(entrants_paiements, many=True).data
	#print("-------Paiement_dicts-----------------")
	#print(paiements_dicts)
	return JsonResponse(paiements_dicts, safe=False)
	

def ajax_get_paiement_data(request):
	entrants_paiements = PaiementEntrant.objects.filter(owner=request.user)
	return get_json_paiements(entrants_paiements, 3)


def ajax_get_all_paiements_data(request):
	group = 3  # par défaut utilisateur simple

	entrants_paiements = PaiementEntrant.objects.all().order_by("status")

	user_group = request.user.groups.first()  # récupère le premier groupe

	if user_group and user_group.name == "Admin":
		group = 1

	elif user_group and user_group.name == "Second_Admin":
		group = 2

	else:
		entrants_paiements = PaiementEntrant.objects.filter(owner=request.user)
		group = 3

	return get_json_paiements(entrants_paiements, group)
	
	

def ajax_get_order_data(request):
	orders_dicts = []
	#orders =  Order.objects.filter(buyer=request.user).order_by("status")
	if request.user.groups.filter(name='Simple_Customer').exists() or request.user.groups.filter(name='Parent').exists() or request.user.groups.filter(name='Teacher').exists() or request.user.groups.filter(name='Second_Admin').exists():
		# il serait plus juste de choisir uniquement les orders venant publications cree par user.id
		orders = Order.objects.filter(buyer=request.user.id).order_by('status')

	else:
		orders =  Order.objects.all().order_by('status')

	
	for order in orders:
		orderInscriptions = OrderInscription.objects.filter(order=order)
		inscriptions_dicts = []

		for orderInscription in orderInscriptions:
			publication_dict = {
				"id": orderInscription.inscription.publication.id,
				"title": orderInscription.inscription.publication.title,
				"description": orderInscription.inscription.publication.description,
				"price": orderInscription.inscription.publication.price,
				"is_private": orderInscription.inscription.publication.is_private,
			}
			user = orderInscription.inscription.participant
				
			inscriptions_dict = {
				"id"  : orderInscription.inscription.pk,
				"status": orderInscription.inscription.status,
				"participant": user.pk,
				"participant_name": user.username,
				"publications": [publication_dict],
			}
			inscriptions_dicts.append(inscriptions_dict)
		order_dict = {
			"id"  : order.pk,
			"created_by_name": order.buyer.username,
			"created_by_id": order.buyer.id,
			"status": order.status,
			"totalOrderPrice":order.total_amount,
			"inscriptions": inscriptions_dicts,
		}
		orders_dicts.append(order_dict)
		
	
	return JsonResponse(orders_dicts, safe=False)






@login_required
def read_enter_paiements(request):
	context_dict = {}
	template="paiement/show_paiements.html"
	return render(request, template, context_dict)
	
	

@login_required
def read_enter_all_paiements(request):
	context_dict = {}
	template="paiement/show_all_paiements.html"
	return render(request, template, context_dict)
	

	
	
@login_required
def read_my_orders(request):
	user_group = request.user.groups.first()  # récupère le premier groupe

	if user_group and user_group.name == "Admin":
		payeurs = User.objects.filter(
		    Q(groups__name='Parent') | Q(groups__name='Admin') | Q(groups__name='Second_Admin')
		).distinct()
		
	elif user_group and user_group.name == "Second_Admin":
		payeurs = User.objects.filter(
		    Q(groups__name='Parent')  | Q(groups__name='Second_Admin')
		).distinct()
	else:
		payeurs = User.objects.filter(
		    Q(groups__name='Parent') 
		).distinct()	
	context_dict = { 'payeurs': payeurs, }
	template="paiement/show_orders.html"
	return render(request, template, context_dict)


