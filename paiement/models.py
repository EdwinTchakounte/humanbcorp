from django.db import models
from django.contrib.auth.models import User
from abstracts.models import Abstract
from bucket.models import Bucket, BucketOfInscriptions,Order


# Create your models here.
class Paiement(Abstract):
     owner = models.ForeignKey(User, on_delete=models.CASCADE)
     
     SUCCESS = 1
     FAILED = 2
     PENDING = 3
     STATUS_CHOICES = ( (SUCCESS, '1'),(FAILED, '2'),(PENDING, '3'))
     status= models.IntegerField(STATUS_CHOICES, default=3)
     
     montant = models.CharField(max_length=255, default=None)
     
     PREMIERE_TRANCHE = 1
     DEUXIEME_TRANCHE = 2
     TROISIEME_TRANCHE = 3
     ENTIER_TRANCHE = 4
     TRANCHE_CHOICES = ( (PREMIERE_TRANCHE, '1'),(DEUXIEME_TRANCHE, '2'),(TROISIEME_TRANCHE, '3'), (ENTIER_TRANCHE, '4'))
     tranche = models.IntegerField(TRANCHE_CHOICES, default=4)
     
     api_key = models.CharField(max_length=255, null=True, default=None)
     
     CASH = 1
     MOBILE_MONEY = 2
     PAYPAL = 3
     PAIEMENT_CHOICES = ( (CASH, '1'),(MOBILE_MONEY, '2'),(PAYPAL, '3'))
     method = models.IntegerField(PAIEMENT_CHOICES, default=1)
     
     parent = models.IntegerField(null=True, default=None)



class PaiementEntrant(Paiement):
    """ User paid order of inscriptions
    """    
    order = models.ForeignKey(Order,  on_delete=models.CASCADE)






 



