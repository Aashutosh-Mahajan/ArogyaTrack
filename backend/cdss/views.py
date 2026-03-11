"""
cdss/views.py
─────────────────────────────────────────────────────
Clinical Decision Support System — single analysis endpoint.
Display-only: never writes to the database.
"""

import json
import logging

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsApprovedDoctor
from medical.models import (
    Allergy,
    ChronicCondition,
    HealthMetric,
    LabTestResult,
    MedicalRecord,
)
from patients.models import Profile
from prescriptions.models import DrugInteraction, Prescription, PrescriptionMedicine

from .anonymizer import anonymize_patient_data

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Clinical Decision Support System (CDSS) assistant.
You provide evidence-based clinical suggestions for doctor review.
You must NEVER make definitive diagnoses — always frame suggestions as possibilities for the doctor to evaluate.
All suggestions must be evidence-based and cite reasoning.
Respond with valid JSON only — no prose, no markdown, no code fences.
Return exactly 6 sections in this JSON structure:
{
  "risk_level": { "level": "LOW|MEDIUM|HIGH|CRITICAL", "explanation": "..." },
  "possible_diagnoses": [{ "icd_10_code": "...", "disease_name": "...", "confidence": "High|Medium|Low", "reasoning": "..." }],
  "drug_interaction_alerts": [{ "drug_a": "...", "drug_b": "...", "severity": "...", "description": "...", "recommendation": "..." }],
  "recommended_tests": [{ "test_name": "...", "reason": "...", "urgency": "Urgent|Routine|Follow-up" }],
  "lab_insights": [{ "parameter": "...", "value": "...", "interpretation": "...", "action_needed": true|false }],
  "early_warnings": [{ "flag": "...", "reason": "...", "priority": "Critical|High|Medium" }]
}"""


class CDSSAnalyzeView(APIView):
    """
    POST /api/cdss/analyze/

    Accepts patient_id and current_symptoms, fetches patient data,
    anonymizes it, sends to OpenAI, and returns structured suggestions.
    """

    permission_classes = [permissions.IsAuthenticated, IsApprovedDoctor]

    def post(self, request):
        # ── STEP A: Validate request ──
        patient_id = request.data.get("patient_id")
        current_symptoms = request.data.get("current_symptoms", "").strip()

        if not patient_id:
            return Response(
                {"detail": "patient_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not current_symptoms:
            return Response(
                {"detail": "current_symptoms is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── STEP B: Fetch raw patient data ──
        try:
            patient = Profile.objects.get(id=patient_id)
        except Profile.DoesNotExist:
            return Response(
                {"detail": "Patient not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        records = (
            MedicalRecord.objects.filter(patient=patient)
            .prefetch_related("diagnoses")
            .order_by("-created_at")[:5]
        )
        allergies = Allergy.objects.filter(profile=patient)
        chronic = ChronicCondition.objects.filter(profile=patient, is_active=True)
        active_prescriptions = Prescription.objects.filter(
            patient=patient, status=Prescription.Status.PENDING
        )
        active_meds = PrescriptionMedicine.objects.filter(
            prescription__in=active_prescriptions
        ).select_related("medicine")
        med_ids = [pm.medicine_id for pm in active_meds]
        db_interactions = (
            DrugInteraction.objects.filter(
                medicine_a_id__in=med_ids, medicine_b_id__in=med_ids
            )
            .exclude(severity=DrugInteraction.Severity.MINOR)
            .select_related("medicine_a", "medicine_b")
        )
        vitals = HealthMetric.objects.filter(patient=patient.user).order_by("-recorded_at")[:10]
        labs = LabTestResult.objects.filter(patient=patient.user).order_by("-tested_at")[:10]

        # ── STEP C: Anonymize (SECURITY LAYER) ──
        try:
            anon_data = anonymize_patient_data(
                patient=patient,
                records=records,
                allergies=allergies,
                chronic=chronic,
                active_meds=active_meds,
                db_interactions=db_interactions,
                vitals=vitals,
                labs=labs,
                current_symptoms=current_symptoms,
            )
        except Exception:
            logger.exception("Anonymizer failure for CDSS request")
            return Response(
                {"detail": "Failed to process patient data securely."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # ── STEP D: Build OpenAI prompt (ONLY anonymized data) ──
        user_prompt = (
            "Analyze the following anonymized patient data and return clinical suggestions.\n\n"
            f"Patient Profile: {json.dumps(anon_data['patient_profile'])}\n"
            f"Chronic Conditions: {json.dumps(anon_data['chronic_conditions'])}\n"
            f"Allergies: {json.dumps(anon_data['allergies'])}\n"
            f"Past Diagnoses: {json.dumps(anon_data['past_diagnoses'])}\n"
            f"Current Medications: {json.dumps(anon_data['current_medications'])}\n"
            f"Known Drug Interactions: {json.dumps(anon_data['drug_interactions'])}\n"
            f"Recent Vitals: {json.dumps(anon_data['recent_vitals'])}\n"
            f"Recent Lab Results: {json.dumps(anon_data['recent_labs'])}\n"
            f"Current Symptoms: {anon_data['current_symptoms']}\n\n"
            "Return exactly the 6-section JSON as described in your instructions."
        )

        # ── STEP E: Call OpenAI ──
        try:
            import openai

            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            completion = client.chat.completions.create(
                model="gpt-4.1",
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            raw_content = completion.choices[0].message.content
        except Exception:
            logger.exception("OpenAI API call failed during CDSS analysis")
            return Response(
                {"detail": "AI analysis service is temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ── STEP F: Parse JSON response ──
        try:
            result = json.loads(raw_content)
        except (json.JSONDecodeError, TypeError):
            logger.error("Failed to parse OpenAI response as JSON: %s", raw_content[:500])
            return Response(
                {"detail": "Failed to parse AI response. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result, status=status.HTTP_200_OK)
