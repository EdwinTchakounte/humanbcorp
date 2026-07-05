from django.db import models
from lessonapp.models import Session, Sequence, Classe, Theme, Activity, Activityquestion
from rest_framework import serializers

# Create your serializers here.



class SessionSerializer(serializers.ModelSerializer):
	class Meta:
		fields = '__all__'
		model = Session




class SequenceSerializer(serializers.ModelSerializer):
	class Meta:
		fields = '__all__'
		model = Sequence


class ClasseSerializer(serializers.ModelSerializer):
	class Meta:
		fields = '__all__'
		model = Classe




class ThemeSerializer(serializers.ModelSerializer):
	class Meta:
		fields = '__all__'
		model = Theme
		
		
class ActivityquestionSerializer(serializers.ModelSerializer):
	class Meta:
		fields = '__all__'
		model = Activityquestion

		

	
		


