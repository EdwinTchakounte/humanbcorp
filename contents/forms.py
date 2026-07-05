from django import forms
from . import models

from contents.models import Space, Publication


class CreateSpaceForm(forms.ModelForm):
    class Meta:
        model = models.Space
        fields = ['title',]


class CreatePublicationForm(forms.ModelForm):

    #tags = TagField()

    class Meta:
        model = models.Publication
        fields = ['categorie', 'title', 'description', 'price','image','is_private','liste_tags']
    
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')                 # !!! !!! !!! needed
        self.space_id = kwargs.pop('space_id')  
        super(CreatePublicationForm, self).__init__(*args, **kwargs)
        if int(self.space_id) == int(0):
        	self.fields['spaces'] = forms.ModelMultipleChoiceField(queryset=Space.objects.filter(owner=self.user), required=False)
        else:
        	self.fields['spaces'] = forms.ModelMultipleChoiceField(queryset=Space.objects.filter(owner=self.user, id=self.space_id), required=False)
        		      	

    def save(self):
        data = self.cleaned_data
        pub = Publication(categorie=data["categorie"],title=data["title"],description=data["description"], price=data["price"],image=data['image'],is_private=data['is_private'])
        pub.save()
        # Ajoutez les tags à la publication
        for tag in data["liste_tags"]:
            pub.liste_tags.add(tag)
        # Add to Spaces, if nothing provided use default one
        if len(data["spaces"])>0:
            for space in data["spaces"]:
                space.publications.add(pub)
        else:
            space = Space.objects.filter(owner=self.user, is_default=True)[0]
            space.publications.add(pub)
        

        return pub
    def label_from_instance(self, obj):
        return obj.title 

