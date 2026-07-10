from django.contrib import admin
from .models import Space , Publication, Relation, Tags, Category

# Register your models here.
admin.site.register(Space)
admin.site.register(Publication)
admin.site.register(Relation)
admin.site.register(Category)

class TagsAdmin(admin.ModelAdmin):
    list_display=('name',)

admin.site.register(Tags,TagsAdmin)
