from django.db import models
from contents.models import Space, Publication
from contents.serializers import PublicationSerializer
from bucket.models import Bucket, BucketOfContents, BucketOfInscriptions, Inscription, Order
from rest_framework import serializers

# Create your models here.

class BucketSerializer(serializers.ModelSerializer):

    class Meta:
        fields = '__all__'
        model = Bucket



class BucketOfContentsSerializer(serializers.ModelSerializer):
    publications = PublicationSerializer(read_only=True, many=True)

    class Meta:
        fields = '__all__'
        model = BucketOfContents
        

class OrderSerializer(serializers.ModelSerializer):

    class Meta:
        fields = '__all__'
        model = Order



class InscriptionSerializer(serializers.ModelSerializer):
    #publication_title = serializers.CharField(source='publication.title')
    #publication_description = serializers.CharField(source='publication.description')
    #publication_price = serializers.DecimalField(source='publication.price', max_digits=8, decimal_places=2)
    publication = PublicationSerializer(read_only=True, many=True)
    #participant_id = serializers.IntegerField(source='participant.id')
    #participant_username = serializers.CharField(source='participant.username')
    #bucket_id = serializers.IntegerField(source='bucket.id')
    
    class Meta:
        fields = '__all__'
        model = Inscription
        
        #fields = ( 'publications', 'participant_id', 'participant_username', 'bucket_id')
        
