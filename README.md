<div align="center">

# ArogyaTrack

### A Comprehensive Healthcare Platform for Disease Surveillance, Digital Prescriptions, and Medication Management

[![Django](https://img.shields.io/badge/Django-4.2-092E20?style=flat&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Flutter](https://img.shields.io/badge/Flutter-3.10-02569B?style=flat&logo=flutter&logoColor=white)](https://flutter.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

</div>

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [Backend (Django)](#1-backend-django)
  - [Frontend (Next.js)](#2-frontend-nextjs)
  - [Mobile App (Flutter)](#3-mobile-app-flutter)
  - [ML Models](#4-ml-models)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Module Documentation](#module-documentation)
- [Environment Variables](#environment-variables)

---

## Overview

**ArogyaTrack** is a full-stack, multi-platform healthcare application designed to digitize and streamline clinical workflows across hospitals, pharmacies, and public health agencies. It combines real-time disease surveillance powered by machine learning analytics, digital prescription management with QR-based dispensing, comprehensive patient health records, and medication adherence tracking — all governed by role-based access control and audit logging.

The platform is built around four primary user roles — **Patients**, **Doctors**, **Pharmacists**, and **Administrators** — with each role receiving a tailored dashboard and feature set aligned to their clinical responsibilities.

---

## How It Works

ArogyaTrack connects every stakeholder in the healthcare chain through a unified digital workflow. Below is a step-by-step walkthrough of how the system operates end-to-end.

### 1. Patient Onboarding
A patient registers via the web or mobile app using OTP-based verification tied to their phone number. Upon registration, a unique patient ID (format: `HS-YYYY-XXXXXX`) is auto-generated. The patient completes their profile — personal details, blood group, emergency contacts, existing allergies, and chronic conditions. A **QR-encoded Health Card** is generated containing a signed JWT token, allowing any verified doctor or pharmacist to instantly access the patient's medical summary by scanning the card.

### 2. Doctor Registration & Approval
Doctors register by uploading their medical certification documents. An administrator reviews and approves each doctor through the admin dashboard. Once approved, doctors gain access to the clinical portal where they can scan patient QR codes, view medical histories, create new medical records, and issue digital prescriptions.

### 3. Clinical Consultation & Medical Records
During a consultation, the doctor scans the patient's Health Card QR code using the built-in camera scanner. This grants time-limited access to the patient's medical history. The doctor records the visit — symptoms, diagnoses (with ICD-10 codes), vitals (blood pressure, temperature, heart rate), lab test orders, and clinical notes. Diagnoses are categorized by medical department (Cardiology, Neurology, Orthopedics, etc.) and severity level. All records are timestamped and immutably linked to the doctor's account for audit compliance.

### 4. Digital Prescription & Drug Safety
After diagnosis, the doctor creates a digital prescription directly within the platform. Each prescription includes medicines with dosage, frequency, duration, and special instructions. The system automatically checks for **drug-drug interactions** from its built-in interaction database, flagging conflicts by severity (Minor, Moderate, Major, or Contraindicated). It also cross-references the patient's allergy records to prevent allergen-drug conflicts. A unique QR code and a cryptographic security hash are generated for each prescription, enabling tamper-proof verification at the pharmacy.

### 5. Pharmacy Dispensing
The pharmacist scans the prescription QR code at the pharmacy counter. The system validates the hash, displays the full prescription, and shows the patient's allergy profile. The pharmacist dispenses medicines from their tracked inventory — the system records batch numbers, expiry dates, and quantities. Each prescription transitions through statuses: **Pending → Partially Dispensed → Fully Dispensed**. Inventory levels are updated in real-time, and low-stock alerts are triggered automatically.

### 6. Medication Adherence & Reminders
Once medicines are dispensed, dose schedules are created for the patient. The system sends reminders via email, SMS, or push notifications at prescribed intervals. Patients mark doses as taken through the app. The adherence module calculates a compliance percentage and identifies missed doses. Doctors can view their patients' adherence dashboards to assess treatment effectiveness, and the system escalates alerts for critically low adherence.

### 7. Patient Dashboard & Health Alerts
Patients see an aggregated health snapshot on their dashboard — recent diagnoses, upcoming doses, lab result trends, and active prescriptions. The system computes a risk score based on vitals (e.g., BP > 140, sugar > 150), abnormal lab results, and missed doses. Alerts are generated at four severity levels (Low, Medium, High, Critical) and displayed prominently. Patients can download their complete medical records as PDFs or request a bulk ZIP export.

### 8. Disease Surveillance & ML Analytics (Admin)
In the background, anonymized and K-anonymized disease data flows into the surveillance module. Four machine learning models operate on this data:
- **DBSCAN** performs geospatial clustering to identify disease outbreak hotspots across districts
- **Isolation Forest** (v5.0 ensemble with Gradient Boosting corrector) detects anomalous disease patterns and sudden case spikes across 59 engineered features
- **Prophet** generates time-series forecasts predicting case counts for the coming weeks with confidence intervals
- **XGBoost** computes risk scores per region factoring in case density, population, sanitation index, and environmental data (temperature, humidity, rainfall)

Administrators access an interactive surveillance dashboard with heat maps, regional comparisons (cases per 100,000 population), anomaly alerts, and forecast trend lines. When thresholds are breached, the system generates outbreak alerts automatically.

### 9. Audit Trail & Compliance
Every action across the platform — login attempts, record access, prescription creation, dispensing events, file downloads — is logged in an immutable audit trail. The system enforces rate limiting to prevent abuse, and all API access is authenticated via JWT tokens with automatic refresh. Doctor-patient access is time-limited and tracked, ensuring data is only visible during authorized consultation windows.

---

## Key Features

### Patient Health Records
- Comprehensive medical records with ICD-10 coded diagnoses
- Multi-department tracking (Cardiology, Neurology, Orthopedics, etc.)
- Allergy and chronic condition management
- Lab result tracking with reference ranges and normality flags
- PDF report generation and bulk download with ZIP support
- QR-encoded health cards for quick doctor/pharmacist access

### Disease Surveillance & Outbreak Detection
- Real-time disease tracking across geographic regions
- DBSCAN-based geospatial clustering for outbreak identification
- Isolation Forest ensemble anomaly detection for sudden case spikes
- Prophet time-series forecasting with seasonality detection
- XGBoost risk scoring per region
- Interactive heat maps with severity-based color coding

### Digital Prescription Management
- End-to-end digital prescriptions with QR code generation
- Drug interaction database with severity classification (Minor → Contraindicated)
- Prescription lifecycle tracking (Pending → Partially Dispensed → Fully Dispensed)
- Security hash verification for tamper detection
- Role-based download access control

### Pharmacy & Dispensing
- QR scan-to-dispense workflow for prescription fulfillment
- Real-time inventory management with batch and expiry tracking
- Automated stock level alerts
- Dispensing record audit trail

### Medication Adherence Tracking
- Dose scheduling with configurable reminders (Email, SMS, Push)
- Adherence percentage calculation and trend analysis
- Missed dose detection with escalation alerts
- Dedicated patient and doctor adherence dashboards

### Patient Health Dashboard
- Aggregated health snapshot with risk scoring
- Alert system for abnormal labs, low adherence, and outbreak proximity
- Key performance indicators for health metrics
- Recent medical records and lab result trending
- Bulk download of records with audit logging

### Authentication & Security
- JWT-based authentication with automatic token refresh
- Role-based access control (Patient, Doctor, Pharmacist, Admin)
- OTP-based registration and email verification
- Doctor credential approval workflow with certificate validation
- Rate limiting middleware (IP-based throttling)
- Comprehensive audit logging for compliance

---

## System Architecture

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      CLIENT LAYER                           │
                    │                                                             │
                    │  ┌───────────────┐  ┌────────────────┐  ┌───────────────┐  │
                    │  │  Next.js 14   │  │ Flutter Mobile │  │ Vite + React  │  │
                    │  │  Web App      │  │ Android / iOS  │  │ Admin Panel   │  │
                    │  │               │  │                │  │               │  │
                    │  │ • Patient     │  │ • QR Scanner   │  │ • Landing     │  │
                    │  │ • Doctor      │  │ • Health Cards │  │ • Analytics   │  │
                    │  │ • Pharmacist  │  │ • Push Alerts  │  │ • Overview    │  │
                    │  │ • Admin Maps  │  │ • Offline Mode │  │               │  │
                    │  │               │  │                │  │               │  │
                    │  │ Port 3000     │  │ Native Build   │  │ Port 5173     │  │
                    │  └───────┬───────┘  └───────┬────────┘  └───────┬───────┘  │
                    └──────────┼──────────────────┼──────────────────┼────────────┘
                               │                  │                  │
                               └──────────────────┼──────────────────┘
                                                  │
                                       ┌──────────▼──────────┐
                                       │  REST API Gateway   │
                                       │  JSON over HTTPS    │
                                       │  JWT Bearer Auth    │
                                       └──────────┬──────────┘
                                                  │
┌─────────────────────────────────────────────────┼──────────────────────────────────────────┐
│                          DJANGO REST BACKEND (Port 8000)                                   │
│                                                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐              │
│  │  Accounts   │  │   Medical   │  │ Prescriptions│  │    Surveillance     │              │
│  │             │  │   Records   │  │              │  │                     │              │
│  │ • JWT Auth  │  │ • ICD-10    │  │ • QR Codes   │  │ • DBSCAN Clustering │              │
│  │ • RBAC      │  │ • Diagnoses │  │ • Drug Checks│  │ • Isolation Forest  │              │
│  │ • OTP/Email │  │ • Lab Tests │  │ • Hash Verify│  │ • Prophet Forecast  │              │
│  │ • Audit Log │  │ • Allergies │  │ • PDF Export │  │ • XGBoost Risk      │              │
│  │ • Rate Limit│  │ • Vitals    │  │ • Lifecycle  │  │ • Heat Map Data     │              │
│  └─────────────┘  └─────────────┘  └──────────────┘  └─────────────────────┘              │
│                                                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐              │
│  │  Patients   │  │  Pharmacy   │  │  Adherence   │  │     Dashboard       │              │
│  │             │  │             │  │              │  │                     │              │
│  │ • Profiles  │  │ • Inventory │  │ • Dose Sched │  │ • Health Snapshot   │              │
│  │ • Health ID │  │ • Dispense  │  │ • Reminders  │  │ • Risk Alerts       │              │
│  │ • QR Cards  │  │ • Stock Mgmt│  │ • Compliance │  │ • KPI Metrics       │              │
│  │ • Family    │  │ • QR Scan   │  │ • Analytics  │  │ • Bulk Download     │              │
│  │ • Photos    │  │ • Batch/Exp │  │ • Multi-ch.  │  │ • Download Logs     │              │
│  └─────────────┘  └─────────────┘  └──────────────┘  └─────────────────────┘              │
│                                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Celery Task Queue                                      │  │
│  │           ML Pipeline Execution  •  Medication Reminders  •  Alert Generation       │  │
│  └──────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                            │
└────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┼─────────────────────┐
                    │                    │                     │
           ┌────────▼─────────┐  ┌───────▼────────┐  ┌────────▼──────────┐
           │   PostgreSQL     │  │     Redis      │  │   File Storage    │
           │                  │  │                │  │                   │
           │ • Patient Data   │  │ • Cache Layer  │  │ • PDF Reports     │
           │ • Medical Records│  │ • Session Store│  │ • QR Code Images  │
           │ • Surveillance   │  │ • Task Broker  │  │ • Uploaded Files   │
           │ • Audit Trail    │  │ • Task Results │  │ • Certificates    │
           │                  │  │                │  │                   │
           │ Port 5432        │  │ Port 6379      │  │ /media/           │
           └──────────────────┘  └────────────────┘  └───────────────────┘
```

**Architecture Summary:**

The system follows a layered architecture with clear separation of concerns:

- **Client Layer** — Three frontend applications (Next.js web app on port 3000, Flutter mobile for Android/iOS, and a Vite + React landing/admin panel on port 5173) communicate with the backend exclusively through a RESTful JSON API authenticated via JWT bearer tokens.

- **API & Application Layer** — A Django REST Framework backend (port 8000) exposes all business logic through modular Django apps: Accounts (auth, RBAC, audit), Medical Records (ICD-10 diagnoses, labs, vitals), Prescriptions (QR generation, drug interaction checks, hash verification), Pharmacy (inventory, dispensing, batch tracking), Patients (profiles, health cards, family), Adherence (dose scheduling, reminders, compliance), Surveillance (ML-powered clustering, anomaly detection, forecasting, risk scoring), and Dashboard (health snapshots, alerts, KPIs).

- **Task Layer** — Celery workers process asynchronous jobs including ML pipeline execution, scheduled medication reminders, and alert generation, using Redis as the message broker.

- **Data Layer** — PostgreSQL serves as the primary relational database storing all patient, medical, surveillance, and audit data. Redis provides caching and session management. File storage (`/media/`) holds generated PDFs, QR images, uploaded attachments, and doctor certificates.

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Runtime environment |
| Django | 4.2 | Web framework |
| Django REST Framework | 3.14+ | RESTful API layer |
| PostgreSQL | 14+ | Primary relational database |
| Redis | 5.0+ | Caching and Celery message broker |
| Celery | 5.3+ | Asynchronous task processing |
| SimpleJWT | 5.3+ | JWT authentication |
| ReportLab | 4.0+ | PDF report generation |

### Frontend (Web)
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14 | React framework with App Router |
| React | 18 | UI component library |
| TypeScript | 5.3 | Type-safe development |
| Tailwind CSS | 3.4 | Utility-first CSS framework |
| shadcn/ui + Radix UI | — | Accessible component primitives |
| TanStack React Query | 5.x | Server state management |
| Zustand | 4.5 | Client state management |
| Recharts / Chart.js | — | Data visualization |
| Leaflet | 1.9 | Interactive map rendering |
| html5-qrcode | 2.3 | QR code scanning |
| Zod | 3.22 | Schema validation |

### Mobile
| Technology | Version | Purpose |
|---|---|---|
| Flutter | 3.10+ | Cross-platform mobile framework |
| Dart | 3.10+ | Programming language |
| Dio | 5.7 | HTTP client |
| Provider | 6.1 | State management |
| flutter_secure_storage | 9.2 | Encrypted credential storage |
| mobile_scanner | 6.0 | QR/barcode scanning |
| fl_chart | 0.70 | Chart rendering |

### Machine Learning
| Technology | Version | Purpose |
|---|---|---|
| scikit-learn (Isolation Forest) | 1.3+ | Ensemble anomaly detection |
| scikit-learn (DBSCAN) | 1.3+ | Geospatial clustering |
| Prophet | 1.1+ | Time-series forecasting |
| XGBoost | 2.0+ | Gradient-boosted risk scoring |
| pandas | 2.0+ | Data manipulation |
| NumPy | 1.24+ | Numerical computation |

---

## Project Structure

```
algosmiths/
├── backend/                    # Django REST API
│   ├── accounts/               # Authentication, RBAC, audit logging
│   ├── adherence/              # Medication adherence tracking
│   ├── config/                 # Django settings, URLs, WSGI/ASGI
│   ├── dashboard/              # Patient health dashboard & alerts
│   ├── medical/                # Medical records, diagnoses, lab results
│   ├── patients/               # Patient profiles, health cards
│   ├── pharmacy/               # Pharmacy inventory, dispensing
│   ├── prescriptions/          # Digital prescriptions, drug interactions
│   ├── surveillance/           # Disease surveillance, ML pipeline
│   ├── manage.py               # Django management entry point
│   └── requirements.txt        # Python dependencies
│
├── frontend/                   # Next.js 14 web application
│   ├── app/                    # App Router pages and layouts
│   ├── components/             # Reusable UI components
│   ├── lib/                    # API client, utilities
│   ├── store/                  # Zustand state stores
│   ├── types/                  # TypeScript type definitions
│   └── package.json            # Node.js dependencies
│
├── mobile_app/                 # Flutter mobile application
│   ├── lib/                    # Dart source code
│   │   ├── config/             # API configuration
│   │   ├── screens/            # Application screens
│   │   ├── services/           # API and storage services
│   │   ├── widgets/            # Reusable widgets
│   │   └── providers/          # State management providers
│   ├── android/                # Android platform configuration
│   ├── ios/                    # iOS platform configuration
│   └── pubspec.yaml            # Flutter dependencies
│
├── ml_models/                  # Machine learning model training
│   ├── train_models/           # Training scripts
│   ├── saved_models/           # Serialized trained models
│   ├── test_models/            # Model evaluation scripts
│   └── test_results/           # Evaluation outputs
│
├── src/                        # Vite + React admin panel (legacy)
│   ├── components/             # React components
│   ├── pages/                  # Page-level components
│   └── main.jsx                # Application entry point
│
└── README.md                   # This file
```

---

## Prerequisites

Ensure the following software is installed on your system:

| Software | Minimum Version | Required |
|---|---|---|
| Python | 3.10 | Yes |
| Node.js | 18.0 | Yes |
| npm | 9.0 | Yes |
| PostgreSQL | 14.0 | Yes |
| Redis | 5.0 | Optional (caching/Celery) |
| Flutter SDK | 3.10 | For mobile development |
| Git | 2.30+ | Yes |

---

## Installation & Setup

### 1. Backend (Django)

#### Clone the Repository

```bash
git clone <repository-url>
cd algosmiths
```

#### Create and Activate a Virtual Environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

#### Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
# Django Core
SECRET_KEY=<your-secret-key>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (PostgreSQL)
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<dbname>
DB_NAME=health_surveillance
DB_USER=postgres
DB_PASSWORD=<your-password>
DB_HOST=localhost
DB_PORT=5432

# JWT
JWT_SECRET=<your-jwt-secret>

# Redis (Optional)
REDIS_URL=redis://localhost:6379/0

# Email (Console backend for development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=noreply@localhost
```

#### Initialize the Database

```bash
python manage.py migrate
python manage.py createsuperuser
```

#### Start the Backend Server

```bash
python manage.py runserver 8000
```

The API will be accessible at `http://localhost:8000/api/`.

---

### 2. Frontend (Next.js)

#### Install Node.js Dependencies

```bash
cd frontend
npm install
```

#### Configure Environment Variables

Create a `.env.local` file inside the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

#### Start the Development Server

```bash
npm run dev
```

The web application will be accessible at `http://localhost:3000`.

---

### 3. Mobile App (Flutter)

#### Install Flutter Dependencies

```bash
cd mobile_app
flutter pub get
```

#### Configure API Endpoint

Create a `.env` file in the `mobile_app/` directory with the backend URL:

```env
API_BASE_URL=http://<your-local-ip>:8000/api
```

#### Run on a Device or Emulator

```bash
# Android
flutter run

# iOS
flutter run --target-platform ios
```

---

### 4. ML Models

#### Set Up the ML Environment

```bash
cd ml_models
python -m venv .venv

# Activate the virtual environment
# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

pip install numpy pandas scikit-learn prophet xgboost
```

#### Train All Models

```bash
python train_all_refined.py
```

Trained models are saved to the `saved_models/` directory and are loaded by the surveillance module at runtime.

---

## Running the Application

### Quick Start (Windows)

```bash
start-dev.bat
```

This script starts the Django backend on port 8000 and the Next.js frontend on port 3000 simultaneously.

### Quick Start (Linux / macOS)

```bash
chmod +x start-dev.sh
./start-dev.sh
```

### Manual Start

Open three terminal sessions:

```bash
# Terminal 1 — Backend
cd backend
venv\Scripts\activate        # or source venv/bin/activate
python manage.py runserver 8000

# Terminal 2 — Frontend
cd frontend
npm run dev

# Terminal 3 — Celery Worker (optional, for async tasks)
cd backend
venv\Scripts\activate
celery -A config worker --loglevel=info
```

### Default Ports

| Service | URL |
|---|---|
| Django API | `http://localhost:8000` |
| Django Admin Panel | `http://localhost:8000/admin/` |
| Next.js Frontend | `http://localhost:3000` |
| Vite Admin Panel | `http://localhost:5173` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

---

## API Reference

All endpoints are prefixed with `/api/`. Authentication is required for most endpoints via the `Authorization: Bearer <token>` header.

### Authentication (`/api/auth/`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/send-otp/` | Send OTP for registration |
| `POST` | `/auth/verify-otp/` | Verify OTP code |
| `POST` | `/auth/register/doctor/` | Register a new doctor account |
| `POST` | `/auth/register/patient/` | Register a new patient account |
| `POST` | `/auth/register/pharmacist/` | Register a new pharmacist account |
| `POST` | `/auth/login/` | Authenticate and receive JWT tokens |
| `POST` | `/auth/token/` | Obtain JWT token pair |
| `POST` | `/auth/token/refresh/` | Refresh an expired access token |
| `POST` | `/auth/password-reset/request/` | Request password reset email |
| `POST` | `/auth/password-reset/confirm/` | Confirm password reset |
| `POST` | `/auth/verify-email/` | Verify email address |
| `GET` | `/auth/me/` | Retrieve authenticated user profile |
| `GET` | `/auth/admin/doctors/pending/` | List doctors pending approval (Admin) |
| `PATCH` | `/auth/admin/doctors/<id>/approval/` | Approve or reject a doctor (Admin) |

### Medical Records (`/api/doctors/`, `/api/patients/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/doctors/records/` | List medical records |
| `POST` | `/doctors/records/` | Create a new medical record |
| `GET` | `/doctors/records/<id>/` | Retrieve a specific record |
| `GET` | `/doctors/reports/<id>/download/` | Download a report attachment |
| `POST` | `/patients/<id>/allergies/` | Add patient allergy |
| `GET` | `/patients/<id>/allergies/` | List patient allergies |
| `POST` | `/patients/<id>/chronic-conditions/` | Add chronic condition |
| `GET` | `/patients/<id>/chronic-conditions/` | List chronic conditions |

### Prescriptions (`/api/prescriptions/`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/prescriptions/` | Create a digital prescription |
| `GET` | `/prescriptions/` | List prescriptions |
| `POST` | `/prescriptions/<id>/medicines/` | Add medicines to a prescription |
| `GET` | `/prescriptions/<id>/drug-interactions/` | Check drug interactions |
| `GET` | `/prescriptions/<id>/download/` | Download prescription PDF |

### Pharmacy (`/api/pharmacy/`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/pharmacy/scan-prescription/` | Scan a prescription QR code |
| `POST` | `/pharmacy/scan-patient/` | Scan a patient health card QR |
| `GET` | `/pharmacy/inventory/` | View pharmacy inventory |
| `POST` | `/pharmacy/dispense/` | Record a dispensing transaction |
| `GET` | `/pharmacy/<id>/` | Retrieve pharmacy details |

### Adherence (`/api/adherence/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/adherence/<patient_id>/summary/` | Get patient adherence summary |
| `POST` | `/adherence/<prescription_id>/mark-dose/` | Mark a dose as taken |
| `GET` | `/adherence/reminders/` | List active reminders |

### Surveillance (`/api/surveillance/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/surveillance/regions/` | List geographic regions |
| `GET` | `/surveillance/surveillance-data/` | Retrieve surveillance case data |
| `GET` | `/surveillance/clusters/` | Get DBSCAN-detected clusters |
| `GET` | `/surveillance/forecasts/` | Get Prophet forecasts |
| `GET` | `/surveillance/anomalies/` | List detected anomalies |
| `GET` | `/surveillance/risk-scores/` | Get XGBoost risk scores |
| `GET` | `/surveillance/alerts/` | List active alerts |
| `GET` | `/surveillance/heat-map/` | Get heat map visualization |
| `GET` | `/surveillance/heat-map-data/` | Get heat map raw data |
| `GET` | `/surveillance/disease-statistics/` | Disease statistics summary |
| `GET` | `/surveillance/regional-comparison/` | Compare regions by cases/100k |
| `GET` | `/surveillance/dashboard-overview/` | Surveillance dashboard summary |
| `GET` | `/surveillance/forecast-chart-data/` | Forecast chart datasets |
| `GET` | `/surveillance/ml-models/` | List available ML models |
| `GET` | `/surveillance/ml-pipeline-status/` | ML pipeline execution status |
| `POST` | `/surveillance/run-ml-pipeline/` | Trigger ML pipeline execution |
| `GET` | `/surveillance/daywise-comparison/` | Day-wise case comparison |

### Dashboard (`/api/dashboard/`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard/summary/` | Patient health summary |
| `GET` | `/dashboard/kpis/` | Key performance indicators |
| `GET` | `/dashboard/alerts/` | Health alerts for the patient |
| `POST` | `/dashboard/alerts/<id>/read/` | Mark alert as read |
| `POST` | `/dashboard/alerts/<id>/dismiss/` | Dismiss an alert |
| `GET` | `/dashboard/download-logs/` | Download audit logs |
| `POST` | `/dashboard/bulk-download/` | Bulk download records as ZIP |

---

## Module Documentation

| Module | Description | Documentation |
|---|---|---|
| Local Setup | Complete end-to-end local development setup | [docs/local-setup.md](docs/local-setup.md) |
| Backend Setup | Backend installation, services, and API configuration | [docs/backend-setup.md](docs/backend-setup.md) |
| Frontend Setup | Frontend installation, build, and environment config | [docs/frontend-setup.md](docs/frontend-setup.md) |
| JWT Authentication | Token-based auth with role management | [JWT_AUTHENTICATION_GUIDE.md](JWT_AUTHENTICATION_GUIDE.md) |
| Medical Records | Medical records module architecture | [MEDICAL_RECORDS_MODULE.md](MEDICAL_RECORDS_MODULE.md) |
| Localhost Setup | Localhost development configuration | [LOCALHOST_SETUP_GUIDE.md](LOCALHOST_SETUP_GUIDE.md) |
| Quick Start | Rapid development environment setup | [QUICKSTART.md](QUICKSTART.md) |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `SECRET_KEY` | Django secret key | — |
| `DEBUG` | Enable debug mode | `True` |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames | `localhost,127.0.0.1` |
| `DATABASE_URL` | Full PostgreSQL connection URI | — |
| `DB_NAME` | Database name | `health_surveillance` |
| `DB_USER` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | — |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `JWT_SECRET` | Secret key for JWT signing | — |
| `REDIS_URL` | Redis connection URI | `redis://localhost:6379/0` |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins (production) | — |
| `EMAIL_BACKEND` | Django email backend class | Console backend |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000/api` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:8000/ws` |
| `NEXT_PUBLIC_APP_NAME` | Application display name | `ArogyaTrack` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox token (optional, production maps) | — |

### Mobile App (`mobile_app/.env`)

| Variable | Description | Default |
|---|---|---|
| `API_BASE_URL` | Backend API base URL (use local IP, not localhost) | — |
| `APP_NAME` | Application display name | `ArogyaTrack` |

### Environment File Templates

| Location | Template File |
|---|---|
| `backend/.env` | `backend/.env.example` |
| `frontend/.env.local` | `frontend/.env.local.example` |
| `mobile_app/.env` | `mobile_app/.env.example` |

---

<div align="center">

**ArogyaTrack** — Built by **AlgoSmiths**

</div>
