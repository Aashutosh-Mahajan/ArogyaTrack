"""
patients/storage.py
─────────────────────────────────────────────────────
Secure file storage paths for patient/doctor documents
"""
import os
from datetime import datetime
from django.utils.text import slugify


def patient_id_proof_path(instance, filename):
    """
    Generate secure path for patient ID proof uploads.
    
    Path format: uploads/patients/{user_id}/id_proof/{timestamp}_{filename}
    """
    ext = filename.split('.')[-1]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_filename = f"{timestamp}_{slugify(filename.split('.')[0])}.{ext}"
    return f"uploads/patients/{instance.user.id}/id_proof/{safe_filename}"


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
