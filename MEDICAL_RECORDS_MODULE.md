# Medical Records Module Documentation

## Overview

Complete Medical Records module for the Health-Surveillance System with Django templates, Bootstrap 5 UI, search/filter functionality, and PDF report generation.

## 📋 Features

✅ **Patient Visit Records System**
- Store complete medical visit history
- Date-wise ordering (newest first)
- Professional Bootstrap 5 card-based UI

✅ **Search & Filter Functionality**
- Search by diagnosis, doctor, department, or tests
- Filter by year, department, and doctor name
- Active filters display with clear option

✅ **PDF Report Generation**
- Download individual medical records as PDF
- Professional formatting with reportlab
- Includes all visit details

✅ **Dummy Data Management**
- Django management command to generate realistic test data
- 15+ medical scenarios covering different departments
- Date range: March 2025 - February 2026

## 🗂 Files Created

### Models
- `backend/medical/models.py` - Added `PatientVisitRecord` model

### Views
- `backend/medical/web_views.py` - Template-based views for list and PDF

### URLs
- `backend/medical/web_urls.py` - URL patterns for web interface
- `backend/config/urls.py` - Updated to include medical web URLs

### Templates
- `backend/templates/base.html` - Base template with Bootstrap 5
- `backend/templates/medical/records_list.html` - Medical records list with filters

### Management Commands
- `backend/medical/management/commands/populate_medical_records.py` - Dummy data generator

### Admin
- `backend/medical/admin.py` - Updated with PatientVisitRecord admin

### Migrations
- `backend/medical/migrations/0003_patientvisitrecord.py` - Database migration

## 🚀 Usage

### 1. Access Medical Records

**URL:** `http://localhost:8000/medical/records/`

Login required. Shows medical records for the authenticated user.

### 2. Generate Dummy Data

```bash
# Navigate to backend directory
cd backend

# Generate records for a specific user
python manage.py populate_medical_records --email user@example.com --records 15

# Generate records for first available user
python manage.py populate_medical_records --records 15
```

**Options:**
- `--email` - Email of the patient user
- `--records` - Number of records to create (default: 15)

### 3. Search and Filter

**Search:**
- Enter keywords in the search bar to find records by diagnosis, doctor, department, or tests

**Filters:**
- **Year:** Filter by visit year
- **Department:** Filter by medical department
- **Doctor:** Filter by doctor name

All filters can be combined and are applied via GET parameters.

### 4. Download PDF Reports

Click the "Download Report (PDF)" button on any medical record card to generate and download a professional PDF report.

## 🎨 UI Features

### Professional Card Design
- Each record displayed as a Bootstrap card
- Color-coded department badges
- Clean, medical-professional aesthetic
- Responsive layout

### Date Formatting
Records show dates as: `14 Feb 2026 | 09:30 AM`

### Department Color Badges
- Cardiology: Blue
- General Medicine: Purple
- Orthopedics: Orange
- Neurology: Pink
- Dermatology: Green

## 🏥 Medical Scenarios Included

The dummy data generator includes 15+ realistic medical scenarios:

1. **Viral Fever** - General Medicine
2. **Mild Hypertension** - Cardiology
3. **Lower Back Pain** - Orthopedics
4. **Migraine with Aura** - Neurology
5. **Allergic Dermatitis** - Dermatology
6. **Type 2 Diabetes Follow-up** - General Medicine
7. **Seasonal Allergic Rhinitis** - General Medicine
8. **Knee Pain (Osteoarthritis)** - Orthopedics
9. **Tension Headache** - Neurology
10. **Routine Health Check-up** - General Medicine
11. **ECG Follow-up** - Cardiology
12. **Acne Vulgaris** - Dermatology
13. **GERD** - General Medicine
14. **Common Cold** - General Medicine
15. **Hypertension Follow-up** - Cardiology

Each scenario includes:
- Realistic diagnosis
- Appropriate tests
- Proper prescriptions
- Department-specific doctors

## 📊 Database Schema

### PatientVisitRecord Model

```python
class PatientVisitRecord(models.Model):
    patient = ForeignKey(User)           # Patient who visited
    doctor_name = CharField              # Doctor's name
    department = CharField               # Medical department
    diagnosis = TextField                # Diagnosis details
    tests_performed = TextField          # Tests conducted
    prescription = TextField             # Prescribed medications/treatment
    visit_date = DateTimeField           # Date and time of visit
    created_at = DateTimeField           # Record creation time
```

**Ordering:** `-visit_date` (newest first)

## 🔧 Technical Details

### Dependencies
- Django 4.2+
- reportlab (for PDF generation)
- Bootstrap 5.3 (CDN)
- Bootstrap Icons (CDN)

### Class-Based Views
- `MedicalRecordsListView` - List view with pagination, search, and filters
- `DownloadMedicalRecordPDFView` - PDF generation view

### Authentication
- All views require authentication (`LoginRequiredMixin`)
- Users can only see their own records

### Pagination
- 10 records per page
- Full pagination controls with first/last/previous/next

## 📱 Responsive Design

The UI is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1366px+)
- Tablet (768px+)
- Mobile (320px+)

## 🎯 Next Steps (Optional Enhancements)

Future improvements you could add:

1. **Export All Records** - Download all records as one PDF
2. **Email Reports** - Email PDF reports to patients
3. **Attach Documents** - Upload test reports, X-rays, etc.
4. **Doctor Dashboard** - For doctors to add records
5. **Appointment Booking** - Link records to appointments
6. **Medical History Timeline** - Visual timeline view
7. **Analytics Dashboard** - Health trends and charts

## 🐛 Troubleshooting

### Issue: Migration Error
```bash
python manage.py migrate medical
```

### Issue: No Records Showing
1. Check if you're logged in
2. Generate dummy data for your user
3. Check URL: `http://localhost:8000/medical/records/`

### Issue: PDF Download Not Working
- Ensure reportlab is installed: `pip install reportlab`
- Check console for errors

### Issue: Static Files Not Loading
- In development, Django serves static files automatically
- For production, run: `python manage.py collectstatic`

## 📝 API Endpoints

### Web Interface
- `GET /medical/records/` - List medical records (template view)
- `GET /medical/records/<id>/download/` - Download PDF report

### Search & Filter Parameters
- `?search=keyword` - Search across all fields
- `?year=2025` - Filter by year
- `?department=Cardiology` - Filter by department
- `?doctor=Dr.%20Sharma` - Filter by doctor name

## ✅ Testing Checklist

- [x] Model created and migrated
- [x] Admin panel registration working
- [x] List view displays records
- [x] Search functionality working
- [x] Filters working (year, department, doctor)
- [x] PDF download working
- [x] Pagination working
- [x] Responsive design on mobile
- [x] Date formatting correct
- [x] Department badges color-coded
- [x] Dummy data command working
- [x] Authentication required

## 📄 License

Part of the Health-Surveillance System project.

---

**Created:** February 2026  
**Version:** 1.0.0  
**Module:** Medical Records
