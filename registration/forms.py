"""
Forms and validation code for user registration.

"""


from django.contrib.auth.models import User, Group
from . import models
from django import forms
from django.utils.translation import gettext_lazy as _
from registration.models import RegistrationManager, RegistrationProfile


# I put this on all required fields, because it's easier to pick up
# on them with CSS or JavaScript if they have a class of "required"
# in the HTML. Your mileage may vary. If/when Django ticket #3515
# lands in trunk, this will no longer be necessary.
attrs_dict = {'class': 'required'}


class RegistrationForm(forms.Form):

	firstname = forms.RegexField(regex=r'^[\w.@+-]+$',
                                max_length=30,
                                widget=forms.TextInput(attrs=attrs_dict),
                                label=_("Firstname"),
                                error_messages={'invalid': _("This value must contain only letters, numbers and underscores.")})

	username = forms.RegexField(regex=r'^[\w.@+-]+$',
                                max_length=30,
                                widget=forms.TextInput(attrs=attrs_dict),
                                label=_("Username"),
                                error_messages={'invalid': _("This value must contain only letters, numbers and underscores.")})
                        
	email = forms.EmailField(widget=forms.TextInput(attrs=dict(attrs_dict,
                                                               maxlength=75)),
                             label=_("E-mail"))
                             
	password1 = forms.CharField(widget=forms.PasswordInput(attrs={'id': 'password', 'class': 'required', 'placeholder': 'Enter your password'}, render_value=False),
                                label=_("Password"))
                                
	password2 = forms.CharField(widget=forms.PasswordInput(attrs=attrs_dict, render_value=False),
                                label=_("Password (again)"))
                                
                                
	def __init__(self, *args, **kwargs):
		self.group_type = kwargs.pop('group_type', None)
		self.user_id = kwargs.pop('user_id', None)
		super().__init__(*args, **kwargs)
		
		if self.group_type is not None and self.group_type != "":
			if self.group_type.lower() == "admin":
				groups = Group.objects.all()
			elif self.group_type.lower() == "second_admin":
				groups = Group.objects.filter(name__icontains="Second_Admin")
			
			self.fields['group'] = forms.ModelChoiceField(
				queryset=groups,
				label=_("User group"),
				empty_label=None,
				required=True
			)
			
			
			self.fields['parent'] = forms.ModelChoiceField(
				queryset=User.objects.filter(groups__name="Parent"),
				required=False,
				label=_("Parent user")
			)
					

                                
	def clean_username(self):
		try:
			 user = User.objects.get(username__iexact=self.cleaned_data['username'])
		except User.DoesNotExist:
			return self.cleaned_data['username']
		raise forms.ValidationError(_("A user with that username already exists."))
		
		
		
	def clean_email(self):
		if User.objects.filter(email__iexact=self.cleaned_data['email']):
			raise forms.ValidationError(_("This email address is already in use. Please supply a different email address."))
		return self.cleaned_data['email']
	
	
	
	def clean(self):
		if 'password1' in self.cleaned_data and 'password2' in self.cleaned_data:
			if self.cleaned_data['password1'] != self.cleaned_data['password2']:
				raise forms.ValidationError(_("The two password fields didn't match."))
				
			return self.cleaned_data
			
			
			
	def save(self):
		data = self.cleaned_data
		group = data.get('group')
		parent = data.get('parent')
		new_user = RegistrationProfile.objects.create_participant_user( data['username'], data['email'], data['password1'], group, self.user_id)
		#new_user = RegistrationProfile.objects.create_inactive_user(data['firstname'], data['username'], data['email'], data['password1'], site="127.0.0.1:8000/", send_email=True)
		RegistrationProfile.objects.filter(user=new_user).update(parent=parent)
				
		return new_user
		
		
	
			
	
	
	
   


