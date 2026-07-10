from django.db import models
from bucket.serializers import OrderSerializer
from bucket.models import Order
from paiement.models import Paiement, PaiementEntrant
from rest_framework import serializers

# Create your models here.

class PaiementSerializer(serializers.ModelSerializer):

    class Meta:
        fields = '__all__'
        model = Paiement



class PaiementEntrantSerializer(serializers.ModelSerializer):
    orders = OrderSerializer(read_only=True, many=True)

    class Meta:
        fields = '__all__'
        model = PaiementEntrant
        

