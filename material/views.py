from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404 , redirect
from django.template import RequestContext
from django.http import Http404, HttpResponseRedirect
from calendarapp.models import Event

from material.models import File, Link, Material

from material.forms import CreateMaterialFileForm, CreateMaterialLinkForm



@login_required
def show_material(request, material_id=None, template="materials/show_material.html"):
    material = get_object_or_404(Material, pk=material_id)
    context_dict = {'material': material}
    return render(request, template, context_dict)

@login_required
def show_materials(request, event_id=None, template="materials/show_materials.html"):
    materials = Material.objects.filter(event__pk=event_id)
    context_dict = {'materials': materials}
    return render(request, template, context_dict)




