from django.contrib import admin
from bucket import models
from .models import Inscription, Order, Reservation


# Register your models here.
#admin.site.register(Bucket)

@admin.register(models.Bucket)
class BucketAdmin(admin.ModelAdmin):
    model = models.Bucket
    list_display = [
        "id",
        "owner",
        "is_active",
        "is_deleted",
        "created_at",
        "updated_at",
    ]
    list_filter = ["is_active", "is_deleted"]
    search_fields = ["owner"]


@admin.register(models.BucketOfContents)
class BucketOfContentsAdmin(admin.ModelAdmin):
    model = models.BucketOfContents
    list_display = ["id"]
    list_filter = ["id"]
    


admin.site.register(Order)  
#@admin.register(models.Order)
class OrderAdmin(admin.ModelAdmin):
    model = models.Order




admin.site.register(Inscription)  
#@admin.register(models.Inscription)
class InscriptionAdmin(admin.ModelAdmin):
    model = models.Inscription
    #list_display = ["participant", "publication", "status", "order", "events"]
    #list_filter = ["participant"]




@admin.register(models.OrderInscription)
class OrderInscriptionAdmin(admin.ModelAdmin):
    model = models.OrderInscription
    #list_display = ["id"]
    #list_filter = ["id"]
  

    
@admin.register(models.BucketOfInscriptions)
class BucketOfInscriptionsAdmin(admin.ModelAdmin):
    model = models.BucketOfInscriptions
    #list_display = ["id"]
    #list_filter = ["id"]
    

  

admin.site.register(Reservation)  
#@admin.register(models.Order)
class ReservationAdmin(admin.ModelAdmin):
    model = models.Reservation

   
  



 
    

    
