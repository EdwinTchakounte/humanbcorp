from django.db import models
from contents.models import Space, Publication, Tags
from rest_framework import serializers

# Create your models here.


class TagsSerializer(serializers.ModelSerializer):
    
    class Meta:
        fields = '__all__'
        model = Tags





class PublicationSerializer(serializers.ModelSerializer):
    liste_tags = TagsSerializer(read_only=True, many=True)
    class Meta:
        fields = '__all__'
        model = Publication



class SpaceSerializer(serializers.ModelSerializer):
    publications = PublicationSerializer(read_only=True, many=True)

    class Meta:
        fields = '__all__'
        model = Space




