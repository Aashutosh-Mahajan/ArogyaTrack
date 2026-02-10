from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import AdherenceTracker, DoseSchedule
from .serializers import (
    AdherenceTrackerSerializer,
    DoseScheduleSerializer,
    RecordDoseTakenSerializer,
    AdherenceMetricsSerializer,
)
from .services import AdherenceService
from patients.models import Profile


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_adherence_tracker(request, tracker_id):
    """Get adherence tracker details"""
    tracker = get_object_or_404(AdherenceTracker, id=tracker_id)
    
    # Check permission - patient can view their own, doctor can view their patients'
    if request.user.role == 'patient':
        if tracker.patient.user != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = AdherenceTrackerSerializer(tracker)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_patient_trackers(request, patient_id):
    """Get all adherence trackers for a patient"""
    patient = get_object_or_404(Profile, id=patient_id)
    
    # Check permission
    if request.user.role == 'patient':
        if patient.user != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    trackers = AdherenceTracker.objects.filter(patient=patient).order_by('-created_at')
    serializer = AdherenceTrackerSerializer(trackers, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_upcoming_doses(request):
    """Get upcoming doses for the authenticated patient"""
    if request.user.role != 'patient':
        return Response({'error': 'Only patients can view upcoming doses'}, status=status.HTTP_403_FORBIDDEN)
    
    # Get active profile
    active_profile = Profile.objects.filter(user=request.user).first()
    if not active_profile:
        return Response({'error': 'No active profile found'}, status=status.HTTP_404_NOT_FOUND)
    
    hours_ahead = int(request.query_params.get('hours', 24))
    doses = AdherenceService.get_upcoming_doses(str(active_profile.id), hours_ahead)
    
    serializer = DoseScheduleSerializer(doses, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_missed_doses(request):
    """Get missed doses for the authenticated patient"""
    if request.user.role != 'patient':
        return Response({'error': 'Only patients can view missed doses'}, status=status.HTTP_403_FORBIDDEN)
    
    # Get active profile
    active_profile = Profile.objects.filter(user=request.user).first()
    if not active_profile:
        return Response({'error': 'No active profile found'}, status=status.HTTP_404_NOT_FOUND)
    
    doses = AdherenceService.get_missed_doses(str(active_profile.id))
    
    serializer = DoseScheduleSerializer(doses, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_dose_taken(request):
    """Record that a dose was taken"""
    if request.user.role != 'patient':
        return Response({'error': 'Only patients can record doses'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = RecordDoseTakenSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    dose_schedule_id = serializer.validated_data['dose_schedule_id']
    taken_at = serializer.validated_data.get('taken_at')
    
    # Verify the dose belongs to the user
    try:
        dose_schedule = DoseSchedule.objects.get(id=dose_schedule_id)
        if dose_schedule.tracker.patient.user != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    except DoseSchedule.DoesNotExist:
        return Response({'error': 'Dose schedule not found'}, status=status.HTTP_404_NOT_FOUND)
    
    success = AdherenceService.record_dose_taken(str(dose_schedule_id), taken_at)
    
    if success:
        return Response({
            'message': 'Dose recorded successfully',
            'dose_schedule_id': str(dose_schedule_id),
        })
    else:
        return Response({'error': 'Dose already recorded or not found'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_adherence_metrics(request, tracker_id):
    """Get adherence metrics for a tracker"""
    tracker = get_object_or_404(AdherenceTracker, id=tracker_id)
    
    # Check permission
    if request.user.role == 'patient':
        if tracker.patient.user != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    metrics = AdherenceService.calculate_adherence(str(tracker_id))
    
    if metrics is None:
        return Response({'error': 'Tracker not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = AdherenceMetricsSerializer(metrics)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_refill_needed(request, tracker_id):
    """Check if refill is needed for a tracker"""
    tracker = get_object_or_404(AdherenceTracker, id=tracker_id)
    
    # Check permission
    if request.user.role == 'patient':
        if tracker.patient.user != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    
    refill_needed = AdherenceService.check_refill_needed(str(tracker_id))
    
    return Response({
        'tracker_id': str(tracker_id),
        'refill_needed': refill_needed,
    })
