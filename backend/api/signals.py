from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import AdminProfile

User = get_user_model()

@receiver(post_save, sender=User)
def create_or_update_admin_profile(sender, instance, created, **kwargs):
    # Ensure may profile kahit non-admin; harmless ito
    if created:
        AdminProfile.objects.create(user=instance)
    else:
        AdminProfile.objects.get_or_create(user=instance)
