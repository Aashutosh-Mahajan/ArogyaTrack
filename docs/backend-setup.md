# Backend Setup Guide

Complete guide for setting up the ArogyaTrack Django REST API backend.

---

## Prerequisites

| Software | Minimum Version | Installation |
|---|---|---|
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) |
| PostgreSQL | 14+ | [postgresql.org](https://www.postgresql.org/download/) |
| Redis | 5.0+ (optional) | [redis.io](https://redis.io/download/) |
| Git | 2.30+ | [git-scm.com](https://git-scm.com/) |

Verify your installations:

```bash
python --version       # Should output 3.10 or higher
psql --version         # Should output 14.x or higher
redis-cli --version    # Optional — 5.x or higher
```

---

## Project Overview

The backend is a **Django 4.2** application using **Django REST Framework** with the following Django apps:

| App | Purpose |
|---|---|
| `accounts` | Authentication, RBAC, OTP, email verification, audit logging |
| `patients` | Patient profiles, health cards, family members |
| `medical` | Medical records, ICD-10 diagnoses, lab results, allergies, vitals |
| `prescriptions` | Digital prescriptions, drug interactions, QR codes |
| `pharmacy` | Pharmacy inventory, dispensing, batch/expiry tracking |
| `adherence` | Medication adherence, dose scheduling, reminders |
| `surveillance` | Disease surveillance, ML pipeline (DBSCAN, Isolation Forest, Prophet, XGBoost) |
| `dashboard` | Patient health dashboard, alerts, KPIs, bulk downloads |
| `cdss` | Clinical Decision Support System |

---

## Directory Structure

```
backend/
├── accounts/               # Authentication, RBAC, audit
├── adherence/              # Medication adherence tracking
├── cdss/                   # Clinical Decision Support
├── config/                 # Django settings, URLs, WSGI, ASGI, Celery
│   ├── settings.py         # Main settings (DB, JWT, CORS, REST, cache)
│   ├── urls.py             # Root URL configuration
│   ├── celery.py           # Celery app configuration
│   ├── wsgi.py             # WSGI entry point
│   └── asgi.py             # ASGI entry point
├── dashboard/              # Patient dashboard, health alerts
├── medical/                # Medical records, diagnoses, lab results
├── patients/               # Patient profiles, health cards
├── pharmacy/               # Pharmacy inventory, dispensing
├── prescriptions/          # Digital prescriptions, drug interactions
├── surveillance/           # Disease surveillance, ML pipeline
├── media/                  # Uploaded files (PDFs, images, certificates)
├── static/                 # Static files (CSS, JS for admin)
├── templates/              # HTML templates (admin, email, reports)
├── manage.py               # Django management command entry point
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (not committed)
└── .env.example            # Environment variable template
```

---

## Step 1: Create a Virtual Environment

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

```bash
# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

---

## Step 2: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Key Packages Installed

| Package | Purpose |
|---|---|
| `django` | Web framework |
| `djangorestframework` | REST API layer |
| `djangorestframework-simplejwt` | JWT authentication |
| `django-cors-headers` | CORS handling for frontend requests |
| `psycopg2-binary` | PostgreSQL database adapter |
| `celery` | Asynchronous task queue |
| `redis` | Redis client (cache, Celery broker) |
| `python-dotenv` | Environment variable loading from `.env` |
| `qrcode[pil]` | QR code generation |
| `PyJWT` | JWT encoding/decoding for health cards |
| `reportlab` | PDF report generation |
| `numpy`, `pandas` | Data processing |
| `scikit-learn` | DBSCAN clustering, Isolation Forest anomaly detection |
| `prophet` | Time-series forecasting |
| `xgboost` | Risk scoring models |

---

## Step 3: Configure Environment Variables

Copy the example environment file:

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Edit `backend/.env` with your local settings:

```env
# Django Core
SECRET_KEY=your-secret-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database — Option A: Full connection URI (for Neon / cloud PostgreSQL)
# DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Database — Option B: Individual settings (for local PostgreSQL)
DB_NAME=health_surveillance
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# JWT
JWT_SECRET=your-jwt-secret-key

# Redis (optional — system falls back to in-memory cache if unavailable)
REDIS_URL=redis://localhost:6379/0

# Email (console backend prints to terminal in development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=noreply@localhost
```

---

## Step 4: Set Up PostgreSQL Database

### Create the Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Inside the PostgreSQL shell
CREATE DATABASE health_surveillance;
\q
```

Alternatively, using pgAdmin or any PostgreSQL GUI, create a database named `health_surveillance`.

### Using Neon (Cloud PostgreSQL)

If you are using Neon instead of a local PostgreSQL instance, set `DATABASE_URL` in your `.env` file with the connection string provided by Neon. The system auto-enables SSL for Neon connections.

---

## Step 5: Run Database Migrations

```bash
python manage.py migrate
```

This creates all required tables including users, patients, medical records, prescriptions, surveillance data, and audit logs.

---

## Step 6: Create a Superuser

```bash
python manage.py createsuperuser
```

Follow the prompts to set up an admin account. This account can access the Django admin panel at `http://localhost:8000/admin/`.

---

## Step 7: Start the Development Server

```bash
python manage.py runserver 8000
```

The API will be accessible at **http://localhost:8000/api/**.

---

## API URL Structure

| Prefix | App | Description |
|---|---|---|
| `/api/auth/` | accounts | Authentication, registration, OTP |
| `/api/patients/` | patients | Patient profiles, health cards |
| `/api/doctors/` | medical | Medical records, diagnoses, lab results |
| `/api/prescriptions/` | prescriptions | Digital prescriptions, drug interactions |
| `/api/pharmacy/` | pharmacy | Pharmacy inventory, dispensing |
| `/api/adherence/` | adherence | Medication adherence, reminders |
| `/api/surveillance/` | surveillance | Disease surveillance, ML pipeline |
| `/api/dashboard/` | dashboard | Patient dashboard, alerts, KPIs |
| `/api/cdss/` | cdss | Clinical Decision Support |
| `/admin/` | — | Django admin panel |

---

## Optional Services

### Redis (Caching & Celery)

Redis is used for caching and as the Celery message broker. It is **optional** for local development — the system falls back to Django's in-memory `LocMemCache` if Redis is unavailable.

To start Redis:

```bash
# Windows (via WSL or Redis for Windows)
redis-server

# Linux
sudo systemctl start redis

# macOS (via Homebrew)
brew services start redis
```

### Celery (Asynchronous Tasks)

Celery processes background tasks including the ML pipeline, medication reminders, and alert generation. To start a Celery worker:

```bash
# Ensure virtual environment is activated
celery -A config worker --loglevel=info
```

For periodic tasks (e.g., scheduled reminders):

```bash
celery -A config beat --loglevel=info
```

---

## Management Commands

| Command | Description |
|---|---|
| `python manage.py migrate` | Apply database migrations |
| `python manage.py createsuperuser` | Create an admin account |
| `python manage.py runserver 8000` | Start the development server |
| `python manage.py collectstatic` | Collect static files for production |
| `python manage.py makemigrations` | Generate new migration files after model changes |

---

## JWT Authentication

The backend uses **djangorestframework-simplejwt** for token-based authentication.

| Setting | Value |
|---|---|
| Access Token Lifetime | 60 minutes |
| Refresh Token Lifetime | 1 day |
| Algorithm | HS256 |
| Signing Key | `JWT_SECRET` from `.env` |
| Auth Header | `Authorization: Bearer <access_token>` |

### Token Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/token/` | POST | Obtain access + refresh token pair |
| `/api/auth/token/refresh/` | POST | Refresh an expired access token |

---

## Troubleshooting

### Port 8000 already in use

```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux / macOS
lsof -i :8000
kill -9 <PID>
```

### Database connection errors

1. Ensure PostgreSQL is running
2. Verify `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` in `.env`
3. Confirm the database exists: `psql -U postgres -l`

### Migration errors after pulling new changes

```bash
python manage.py makemigrations
python manage.py migrate
```

### CORS errors from the frontend

Ensure `CORS_ALLOWED_ORIGINS` in `backend/.env` includes `http://localhost:3000`, or set `DEBUG=True` which auto-allows `localhost:3000`.
