from django.contrib import admin
from material import models


@admin.register(models.Document)
class DocumentAdmin(admin.ModelAdmin):
    model = models.Document
    list_display = [
        "id",
        "title",
        "is_active",
        "is_deleted",
        "created_at",
        "updated_at",
    ]
    list_filter = ["is_active", "is_deleted"]
    search_fields = ["title"]


@admin.register(models.File)
class FileAdmin(admin.ModelAdmin):
    model = models.File
    list_display = ["id", "filename", "size", "mime_type"]
    list_filter = ["filename"]
    
    
    
@admin.register(models.Link)
class LinkAdmin(admin.ModelAdmin):
    model = models.Link
    list_display = ["id", "url"]
    list_filter = ["url"]
    




   
@admin.register(models.Material)
class MaterialAdmin(admin.ModelAdmin):
    model = models.Material
    list_display = ["id", "title", "description", "color", "has_answer"]
    list_filter = ["title"]
    


@admin.register(models.InputBox)
class InputBoxAdmin(admin.ModelAdmin):
    model = models.InputBox
    list_display = ["id", "title", "input_type", "color", "is_answer"]
    list_filter = ["title"]


    
@admin.register(models.InputQuestionBox)
class InputQuestionBox(admin.ModelAdmin):
    model = models.InputQuestionBox
    list_display = ["id", "question"]
    list_filter = ["question"]
    
    
@admin.register(models.CheckedResponseInputQuestion)
class CheckedResponseInputQuestion(admin.ModelAdmin):
    model = models.CheckedResponseInputQuestion
    list_display = ["id", "owner", "input_question_box", "checked"]
    list_filter = ["input_question_box"]
  
  
  

@admin.register(models.Component)
class ComponentAdmin(admin.ModelAdmin):
    model = models.InputBox
    list_display = ["id", "color", "is_answer","title", "paragraph", "image", "number"]
    list_filter = ["number"]



@admin.register(models.ActivityComponent)
class ActivityComponent(admin.ModelAdmin):
    model = models.ActivityComponent
    list_display = ["id", "activity"]
    list_filter = ["activity"]
  

    

@admin.register(models.MaterialEventDoc)
class MaterialEventDoc(admin.ModelAdmin):
    model = models.MaterialEventDoc
  


@admin.register(models.MaterialPublicationDoc)
class MaterialPublicationDoc(admin.ModelAdmin):
    model = models.MaterialPublicationDoc
  
  

@admin.register(models.MaterialSeanceDoc)
class MaterialSeanceDoc(admin.ModelAdmin):
    model = models.MaterialSeanceDoc
    list_display = ["id", "seance"]
    list_filter = ["seance"]
    


@admin.register(models.MaterialActivityDoc)
class MaterialActivityDoc(admin.ModelAdmin):
    model = models.MaterialActivityDoc
    list_display = ["id", "activity"]
    list_filter = ["activity"]
    
    
@admin.register(models.MaterialResponseActivityDoc)
class MaterialResponseActivityDoc(admin.ModelAdmin):
    model = models.MaterialResponseActivityDoc
    list_display = ["id", "activity_doc", "owner"]
    list_filter = ["activity_doc"]
    
         

@admin.register(models.MaterialQuestionDoc)
class MaterialQuestionDoc(admin.ModelAdmin):
    model = models.MaterialQuestionDoc
    list_display = ["id", "question"]
    list_filter = ["question"]
    
    

    

    
    
