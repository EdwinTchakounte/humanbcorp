from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404 , redirect
from django.template import RequestContext
from django.http import Http404, HttpResponse,  HttpResponseRedirect, JsonResponse
from django.db.models import Q
from django.core import serializers


from contents.forms import  CreatePublicationForm
from contents.models import Space, Publication
from contents.serializers import SpaceSerializer
from django.views.generic import TemplateView, ListView
from itertools import chain



# Create your views here.

class SearchResultsView(ListView):
	model = Publication
	template_name = 'contents/search_results.html'
    
	def get_queryset(self):  # new
		query = self.request.GET.get("q")
		if query:
			qsets = [] 
			results = []
			for q in query.split(" "):    
				qset = ((Q(title__icontains=q) | Q(description__icontains=q) | Q(liste_tags__name__in=[q]))   )
				
				results = list(chain(results , Publication.objects.filter(qset, is_private=False).distinct() ))
				
			results  = list(set(results))
			
		else:
			results = Publication.objects.all()
		object_list = {"results": results,"query": query}
		return  object_list

#@login_required(login_url="/users/login/")
def create_publication(request, space_id=0, template="new_publication.html"):
    if not request.user.is_authenticated:
        return redirect("/registration/login/?page_id=%s&page_type=new_publication" %  space_id )
		
    if request.method == 'POST':
        form = CreatePublicationForm(request.POST,request.FILES, user=request.user, space_id=space_id)
        if form.is_valid():
            pub = form.save()
            #log_it(request, thread, ADDITION)
            return redirect("contents:private_spaces", private=False)
    else:
        form = CreatePublicationForm(user=request.user, space_id=space_id)
    context_dict = {"form": form}
    return render(request, 'contents/new_publication.html', { 'form': form })





def create_child(request):
	if request.method == 'POST':
		publication_id = request.POST.get('publication_id')
		publication_title = request.POST.get('publication_title')
		space_id = request.POST.get('space_id_of_child')
        
		publication = Publication.objects.filter(pk=publication_id)[0]
		child_publication = Publication(categorie=publication.categorie,title=publication_title,description=publication.description, price=publication.price,image=publication.image,is_private=True)
		child_publication.save()
		space = Space.objects.filter(pk=space_id)[0]
		space.publications.add(child_publication)
	return redirect("contents:private_spaces", private=False)




def show_publication(request, space_id=None, publication_id=None, template="show_publication.html"):
    publication = get_object_or_404(Publication, pk=publication_id)
    context_dict = {'publication': publication , 'space_id': space_id}
    return render(request, 'contents/show_publication.html', context_dict)



def show_publications(request, private=False, for_user=True, template="show_publications.html"):
    user_wants_private = private == True
    user_is_not_auth = not request.user.is_authenticated()
    if user_wants_private and user_is_not_auth:
        raise Http404
    if user_wants_private:
        publications = Publication.objects.filter(space__is_private=True)
    else:
        publications = Publication.objects.filter(space__is_private=False)
    if for_user:
        publications = publications.objects.filter(space__owner=request.user)
    context_dict = {'publications': publications}
    return render(request, 'contents/show_publications.html', { 'publications': publications })





def ajax_get_publication(request, publication_id): 
	publication = Publication.objects.get(id=publication_id)
	response_data = {}
	response_data['id'] = publication.id
	response_data['title'] = publication.title
	return JsonResponse(response_data)






#@login_required(login_url="/users/login/")
def create_space(request):
    if not request.user.is_authenticated:
        return redirect("/registration/login/?page_id=%s&page_type=new_space" %  0 )
	
    if request.method == 'POST':
        title = request.POST.get('title', "None")
        is_private = request.POST.get('is_private', False)
        space = Space.objects.create(title=title, is_private=is_private, owner=request.user)
    return redirect("contents:private_spaces", private=False)
    
    
def show_spaces(request, private=0, for_user=1, template="show_spaces.html"):
    admin = request.user.groups.filter(name='Admin').exists()
    context_dict = {'private':0, 'for_user':1, 'admin':admin }
    return render(request, 'contents/show_spaces.html', context_dict)
    
def show_space_of_content(request, space_id=None, template="show_space.html"):
    admin = request.user.groups.filter(name='Admin').exists()
    context_dict = { 'space_id': space_id , 'admin':admin}
    return render(request, 'contents/show_space.html', context_dict)
    
def ajax_get_space_data(request, space_id=None):
    spaces = Space.objects.filter(pk=space_id)
    results = SpaceSerializer(spaces, many=True).data
    return JsonResponse(results, safe=False)
    
    

def show_all_spaces(request, template="show_spaces.html"):
   context_dict = {"private":0, "for_user":0}
   return render(request, 'contents/show_spaces.html', context_dict)

def ajax_get_spaces_data(request, private, for_user=1):
	user_wants_private = int(private) == int(1)
	user_is_not_auth = not request.user.is_authenticated
	if user_wants_private and user_is_not_auth:
		raise Http404
	
	if int(for_user) == int(1):
		spaces = Space.objects.filter(owner=request.user)
	else: 
		if int(private) == int(1):
			spaces = Space.objects.filter(is_private=bool(True))
		else:
			spaces = Space.objects.filter(is_private=bool(False))
    
   
	results = SpaceSerializer(spaces, many=True).data
	return JsonResponse(results, safe=False)
	
	
	
def rel_publications(request, publication_id_1, publication_id_2):
    ct_json = {"success":False}
    #bucket = BucketOfContents.objects.get_or_create(owner=request.user)
    publication_1 = get_object_or_404(Publication, pk=publication_id_1)
    publication_2 = get_object_or_404(Publication, pk=publication_id_2)
    if publication_1.relate_to(publication_2):
        ct_json =  {"success":True}
    return JsonResponse(ct_json)

def json_publication_relations(request, publication_id):
    publication = get_object_or_404(Publication, pk=publication_id)
    node_dict = publication.as_dict_node(parent=True)
    ct_json = node_dict
    return JsonResponse(ct_json)


 
   
    
