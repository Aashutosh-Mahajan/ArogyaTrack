"""
accounts/storage.py
─────────────────────────────────────────────────────
Secure file storage paths for doctor documents
"""
from datetime import datetime
from django.utils.text import slugify


def doctor_license_path(instance, filename):
    """
    Generate secure path for doctor license certificate uploads.
    
    Path format: uploads/doctors/{user_id}/license/{timestamp}_{filename}
    """
    ext = filename.split('.')[-1]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_filename = f"{timestamp}_{slugify(filename.split('.')[0])}.{ext}"
    return f"uploads/doctors/{instance.user.id}/license/{safe_filename}"


def doctor_degree_path(instance, filename):
    """
    Generate secure path for doctor degree certificate uploads.
    
    Path format: uploads/doctors/{user_id}/degree/{timestamp}_{filename}
    """
    ext = filename.split('.')[-1]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_filename = f"{timestamp}_{slugify(filename.split('.')[0])}.{ext}"
    return f"uploads/doctors/{instance.user.id}/degree/{safe_filename}"


def doctor_govt_id_path(instance, filename):
    """
    Generate secure path for doctor government ID uploads.
    
    Path format: uploads/doctors/{user_id}/govt_id/{timestamp}_{filename}
    """
    ext = filename.split('.')[-1]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_filename = f"{timestamp}_{slugify(filename.split('.')[0])}.{ext}"
    return f"uploads/doctors/{instance.user.id}/govt_id/{safe_filename}"
