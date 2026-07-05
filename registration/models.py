import random
import re
import datetime
from django.utils import timezone
from django.db import models
from django.contrib.auth.models import Group
from django.contrib.auth.models import User

#from django.utils.hashcompat import sha_constructor
from hashlib import sha1 as sha_constructor
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import send_mail, BadHeaderError
from django.http import HttpResponse, HttpResponseRedirect
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.contrib.sites.shortcuts import get_current_site


# Create your models here.



SHA1_RE = re.compile('^[a-f0-9]{40}$')

class RegistrationManager(models.Manager):
	  
	def create_inactive_user(self, firstname, username, email, password, site, send_email=True):    	
		new_user = User.objects.create_user(username, first_name=firstname, email=email,  password=password)
		new_user.is_active = False
		new_user.save()

		registration_profile = self.create_profile(new_user)

		if send_email:
			registration_profile.send_activation_email(site)

		return new_user
		
		
	def create_participant_user(self, username, email, password, group=None, user_id=None):
		new_user = User.objects.create_user(username, email, password)
		new_user.is_active = True
		if not group:
			group_obj, _ = Group.objects.get_or_create(name="Simple_Customer") 
		else:
			group_name = f"{user_id}_{group}"
			group_obj, _ = Group.objects.get_or_create(name=group_name)

		new_user.groups.add(group_obj)	
		new_user.save()
		return new_user	 
			                         
                             
	def create_profile(self, user):
		salt = sha_constructor(str(random.random()).encode('utf-8')).hexdigest()[:5]
		salt = salt.encode('utf-8')
		username = user.username
		#if isinstance(username, unicode):
		username = username.encode('utf-8')
		activation_key = sha_constructor(salt+username).hexdigest()
		return self.create(user=user,activation_key=activation_key)
		
		
	def activate_user(self, activation_key):
		if SHA1_RE.search(activation_key):
			try:
		        	profile = self.get(activation_key=activation_key)
			except self.model.DoesNotExist:
		        	return False
		if not profile.activation_key_expired():
			user = profile.user
			user.is_active = True
			user.save()
			profile.activation_key = self.model.ACTIVATED
			profile.save()
			return user
		return False
		    	
   
    	

class RegistrationProfile(models.Model):
	ACTIVATED = u"ALREADY_ACTIVATED"
    
	user = models.ForeignKey(User, unique=True, verbose_name='user', on_delete=models.CASCADE)
	activation_key = models.CharField(verbose_name='activation key', max_length=40)
	parent = models.ForeignKey(
		User,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="children"
	)
    
	objects = RegistrationManager()
    
	class Meta:
		verbose_name = 'registration profile'
		verbose_name_plural = 'registration profiles'
    
	def __unicode__(self):
		return u"Registration information for %s" % self.user
		
		
	def activation_key_expired(self):
		expiration_date = datetime.timedelta(days=settings.ACCOUNT_ACTIVATION_DAYS)
		return self.user.date_joined + expiration_date <= timezone.now()
    		
    
    
		
	def send_activation_email(self, site):
		print(self.user.email)
		current_site = site
		subject = 'Activate your account'
		context = {
			'user': self.user,
			'domain': current_site,
			'uid': urlsafe_base64_encode(force_bytes(self.user.pk)),
			'token': self.activation_key,
		}
		html_content = render_to_string('registration/activation_email.html', context)
		email = EmailMultiAlternatives(subject, None, to=[self.user.email])
		email.attach_alternative(html_content, "text/html")
		email.send()
            
		"""ctx_dict = {'activation_key': self.activation_key,
                    'expiration_days': settings.ACCOUNT_ACTIVATION_DAYS,
                    'site': site}
		subject = render_to_string('registration/activation_email_subject.txt',
                                   ctx_dict)
		subject = ''.join(subject.splitlines())
		message = render_to_string('registration/activation_email.txt', ctx_dict)
		
		try:
			send_mail(subject, message, 'remeetsa@gmail.com', ['fokamfekamcedric@gmail.com'])
		except BadHeaderError:
			return HttpResponse('Invalid header found.')
		
		#self.user.email_user(subject, message, settings.DEFAULT_FROM_EMAIL)"""
		
		
                      
      
	
	
      
        
    
