from django.db import models
from django.contrib.auth.models import User
from calendarapp.models import Event
from django.db.models import Q
from django.db.models import Sum



# Create your models here.

class Tags(models.Model):
    name=models.CharField(max_length=30)
   

  
    def __str__(self):
        return self.name
        


class Category(models.Model):
    name =  models.CharField(max_length=200)
      	
    def __str__(self):
        return self.name



class Publication(models.Model):
    parent = models.ForeignKey(
        'self',  # utiliser 'self' pour référencer le même modèle
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        default=None,
        related_name='children'  # optionnel, pour accéder aux sous-publications
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    date = models.DateTimeField(auto_now_add=True)
    price = models.DecimalField(max_digits=8, decimal_places=2, default='00000.00')
    events = models.ManyToManyField(Event, blank=True)
    categorie = models.ForeignKey(Category, on_delete=models.CASCADE, default=None)
    liste_tags=models.ManyToManyField(Tags,null=True)
    image = models.ImageField(upload_to='img',null=True)
    is_private = models.BooleanField(null=True,default=True)
    # Contenu pédagogique rattaché à cette formation payante (LMS lessonapp).
    # Réf. par chaîne pour éviter tout import circulaire contents <-> lessonapp.
    themes = models.ManyToManyField(
        "lessonapp.Theme", blank=True, related_name="publications"
    )
    
	  
 
    def __unicode__(self):
        return "%s" % (self.title)
    
    def __str__(self):
        return self.title
        
    def get_absolute_url(self):
        return "/publications/%i/" % self.id
        
	
       
    def is_public_avail(self):
        """ Is this Publication in some Public Space?
        """
        for space in self.spaces.all():
            if space.is_private == False:
                return True
        return False
    
    def is_in_user_space(self, user):
        """ Is this Publication in some Public Space?
        """
        if self.spaces.filter(owner=user).count() > 0:
            return True
        return False
        
    def relations(self):
        return Relation.objects.filter(Q(publication_1=self)|Q(publication_2=self))
    
    def get_ordered_relations(self):
        relations = Relation.objects.filter_with_score(Q(publication_1=self)|Q(publication_2=self))
        relations = sorted(relations, key=lambda k: -k.score)
        return relations
   
    def get_related_publications(self):
        other_publications = []
        for relation in self.relations():
            other_publications.append(relation.get_other_publication(self))
        return other_publications
        
    def relate_to(self, publication, comment=""):
        return Relation.objects.check_create(publication_1=self, publication_2=publication, comment=comment)

    def as_dict_node(self, parent=False, rel_weight=0, rel_id=None):
        children = []
        if parent:
            for rel in self.get_ordered_relations():
                publication = rel.get_other_publication(self)
                children.append(publication.as_dict_node(rel_weight=rel.cumul_votes(), rel_id=rel.pk))
        node_dict = {
                    "id"  : "node%s" % self.pk,
                    "name": "%s" % self.title,
                    "data": {"linkUrl": "#TODO", "linkName":"#TODO", "is_private":self.is_private, "relationWeight":rel_weight, "relationId":rel_id},
                    "children":children,
                }
        return node_dict
    
       




class Space(models.Model):
    title = models.CharField(max_length=255)
    is_private = models.BooleanField()
    owner = models.ForeignKey(User,  on_delete=models.CASCADE, default=None)
    publications = models.ManyToManyField(Publication, related_name='spaces')
    is_default = models.BooleanField(default=False)

    def __unicode__(self):
        return "%s" % (self.title)
        
    def __str__(self):
        return self.title
        
    def get_publications(self):   
    	return self.publications.all()
    	
    def save(self, *args, **kwargs):
        """ This will assert that there is only one default space per owner
        """
        if self.is_default == True:
            try:
                space = Space.objects.get(owner=self.owner, is_default=True)
            except Space.DoesNotExist:
                return super(Space, self).save(*args, **kwargs)
            return False
        return super(Space, self).save(*args, **kwargs)
        
        
        
       
def create_default_space(sender, user, request, **kwargs):
    """ This function will be executed after a user registers
        it creates the default space
    """
    kwargs ={"title": "%s's Space" % (user.username),
                "is_private": True,
                "owner": user,
                "is_default":True
            }
    Space.objects.create(**kwargs)

#from registration.signals import user_registered
#user_registered.connect(create_default_space)




class RelationManager(models.Manager):

    def check_create(self,*args,**kwargs):
        if not kwargs["publication_2"] in kwargs["publication_1"].get_related_publications():
            self.create(*args,**kwargs)
            return True
        return False

    def filter_with_score(self, *args, **kwargs):
        qs = self.filter(*args, **kwargs).annotate(score=Sum('voterelation__rating'))
        for a in qs:
            if a.score == None:
                a.score = 0
        return qs

class Relation(models.Model):
    comment = models.CharField(max_length=255)
    publication_1 = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name="publication_1")
    publication_2 = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name="publication_2")
    
    objects=RelationManager()

    def get_other_publication(self, pub):
        if self.publication_1 == pub:
            return self.publication_2
        elif self.publication_2 == pub:
            return self.publication_1
        else:
            return None
    
    def rate(self, rating):
        if rating:
            return VoteRelation.objects.create(relation=self, rating=rating)
        return None

    def cumul_votes(self):
        ##if self.voterelation_set.get_query_set():
            ##return self.voterelation_set.aggregate(Sum("rating"))["rating__sum"]
        ##else:
    		##return 0
    	return 0
    
    def save(self, *args, **kwargs):
        if self.publication_1.id == self.publication_2.id:
            # So navigation doesn't get annoying
            # Threads with same doc allowed
            # but no relations between them
            return None
        super(Relation, self).save(*args, **kwargs)

    def __unicode__(self):
        return "Relation %s between %s" % (self.publication_1, self.publication_2)
        
        
        
       
       
class Vote(models.Model):
    rating = models.IntegerField()

    class Meta:
        abstract = True

    def __int__(self):
        return self.rating

    def __unicode__(self):
        if self.rating > 0:
            return "Vote up!"
        return "Vote down!"

class VoteRelation(Vote):
    relation = models.ForeignKey(Relation, on_delete=models.CASCADE)





