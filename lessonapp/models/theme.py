from django.db import models

#from accounts.models import User
from abstracts.models import Abstract
from lessonapp.models import Sequence, Categorie, Classe, Duration



class Theme(Abstract):
    title = models.CharField(max_length=400)
    is_visible = models.BooleanField(null=False,default=False)
    image = models.ImageField(upload_to='img',null=True)
    sequence = models.ForeignKey(Sequence,  on_delete=models.CASCADE, default=None)
    categorie = models.ForeignKey(Categorie, on_delete=models.CASCADE, default=None)
    classes = models.ManyToManyField(Classe)
    COURS = 1
    EXAMEN = 2
    TYPES_CHOICES = ( (COURS, 'Cours'),(EXAMEN, 'Examen'))
    t_type = models.IntegerField(TYPES_CHOICES, default=1)
    
    
    def __unicode__(self):
        return "%s" % (self.title)
        
    def __str__(self):
        return self.title
        
   
    def get_classes(self):   
    	return self.classes.all()
    	
    def get_image(self):   
    	return self.image
    	
    def save(self, *args, **kwargs):
       
        return super(Theme, self).save(*args, **kwargs)
        
        
        

class Examen(Theme):
    is_oral = models.BooleanField(null=False,default=False)
    is_chrono = models.BooleanField(null=False,default=False)
    duration =  models.ForeignKey(Duration, on_delete=models.CASCADE, default=None)
    note = models.IntegerField(default=0)
    



    
    

  
        
    
  
