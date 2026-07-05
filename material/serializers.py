from django.db import models
from material.models import Component
from rest_framework import serializers

# Create your serializers here.



class ComponentSerializer(serializers.ModelSerializer):
	class Meta:
		fields = '__all__'
		model = Component





