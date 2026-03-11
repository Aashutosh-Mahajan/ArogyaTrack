"""
medical/web_views.py
─────────────────────────────────────────────────────
Template-based views for Medical Records
"""
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.generic import ListView, View
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import PatientVisitRecord


class MedicalRecordsListView(LoginRequiredMixin, ListView):
    """
    Display patient's medical records with search and filter functionality.
    """
    model = PatientVisitRecord
    template_name = "medical/records_list.html"
    context_object_name = "records"
    paginate_by = 10

    def get_queryset(self):
        queryset = PatientVisitRecord.objects.filter(patient=self.request.user)
        
        # Search functionality
        search_query = self.request.GET.get("search", "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(diagnosis__icontains=search_query) |
                Q(doctor_name__icontains=search_query) |
                Q(department__icontains=search_query) |
                Q(tests_performed__icontains=search_query)
            )
        
        # Filter by year
        year = self.request.GET.get("year")
        if year:
            queryset = queryset.filter(visit_date__year=year)
        
        # Filter by department
        department = self.request.GET.get("department")
        if department:
            queryset = queryset.filter(department=department)
        
        # Filter by doctor
        doctor = self.request.GET.get("doctor")
        if doctor:
            queryset = queryset.filter(doctor_name__icontains=doctor)
        
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get unique values for filters
        all_records = PatientVisitRecord.objects.filter(patient=self.request.user)
        context["years"] = all_records.dates("visit_date", "year", order="DESC")
        context["departments"] = all_records.values_list("department", flat=True).distinct().order_by("department")
        context["doctors"] = all_records.values_list("doctor_name", flat=True).distinct().order_by("doctor_name")
        
        # Preserve filter values
        context["search_query"] = self.request.GET.get("search", "")
        context["selected_year"] = self.request.GET.get("year", "")
        context["selected_department"] = self.request.GET.get("department", "")
        context["selected_doctor"] = self.request.GET.get("doctor", "")
        
        return context


class DownloadMedicalRecordPDFView(LoginRequiredMixin, View):
    """
    Generate and download PDF report for a medical record.
    """
    
    def get(self, request, record_id):
        record = get_object_or_404(PatientVisitRecord, id=record_id, patient=request.user)
        
        # Create the HttpResponse object with PDF headers
        response = HttpResponse(content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="medical_record_{record.id}.pdf"'
        
        # Create the PDF object
        doc = SimpleDocTemplate(response, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            textColor=colors.HexColor("#2c3e50"),
            spaceAfter=30,
            alignment=1  # Center
        )
        
        heading_style = ParagraphStyle(
            "CustomHeading",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=colors.HexColor("#34495e"),
            spaceAfter=12,
            spaceBefore=12,
        )
        
        normal_style = ParagraphStyle(
            "CustomNormal",
            parent=styles["Normal"],
            fontSize=11,
            spaceAfter=8,
        )
        
        # Title
        story.append(Paragraph("Medical Record Report", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Patient Information Table
        patient_data = [
            ["Patient:", request.user.get_full_name() or request.user.email],
            ["Visit Date:", record.visit_date.strftime("%d %B %Y | %I:%M %p")],
        ]
        
        patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
        patient_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#ecf0f1")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2c3e50")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#bdc3c7")),
        ]))
        
        story.append(patient_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Doctor Information
        story.append(Paragraph("Doctor Information", heading_style))
        doctor_data = [
            ["Doctor Name:", record.doctor_name],
            ["Department:", record.department],
        ]
        
        doctor_table = Table(doctor_data, colWidths=[2*inch, 4*inch])
        doctor_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#ecf0f1")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2c3e50")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#bdc3c7")),
        ]))
        
        story.append(doctor_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Diagnosis
        story.append(Paragraph("Diagnosis", heading_style))
        story.append(Paragraph(record.diagnosis, normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Tests Performed
        story.append(Paragraph("Tests Performed", heading_style))
        story.append(Paragraph(record.tests_performed, normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Prescription
        story.append(Paragraph("Prescription", heading_style))
        story.append(Paragraph(record.prescription, normal_style))
        story.append(Spacer(1, 0.3*inch))
        
        # Footer
        footer_style = ParagraphStyle(
            "Footer",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#7f8c8d"),
            alignment=1,
        )
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph(f"Generated on: {record.created_at.strftime('%d %B %Y')}", footer_style))
        story.append(Paragraph("Health Surveillance System", footer_style))
        
        # Build PDF
        doc.build(story)
        
        return response
