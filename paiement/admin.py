from django.contrib import admin
from paiement import models
# Register your models here.

@admin.register(models.Paiement)
class PaiementAdmin(admin.ModelAdmin):
    model = models.Paiement
  

@admin.register(models.PaiementEntrant)
class PaiementEntrantAdmin(admin.ModelAdmin):
    model = models.PaiementEntrant
    #list_display = ["id"]
    #list_filter = ["id"]



