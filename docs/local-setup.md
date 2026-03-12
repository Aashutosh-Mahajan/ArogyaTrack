# Local Development Setup Guide

Complete end-to-end guide for setting up the entire ArogyaTrack project on your local machine from scratch.

---

## Prerequisites

Install the following software before proceeding:

| Software | Minimum Version | Required | Installation |
|---|---|---|---|
| Git | 2.30+ | Yes | [git-scm.com](https://git-scm.com/) |
| Python | 3.10+ | Yes | [python.org](https://www.python.org/) |
| Node.js | 18.0+ | Yes | [nodejs.org](https://nodejs.org/) |
| npm | 9.0+ | Yes | Included with Node.js |
| PostgreSQL | 14+ | Yes | [postgresql.org](https://www.postgresql.org/) |
| Redis | 5.0+ | Optional | [redis.io](https://redis.io/) |
| Flutter SDK | 3.10+ | For mobile only | [flutter.dev](https://flutter.dev/) |

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────┐
│                  Your Local Machine                   │
│                                                      │
│   Frontend (Next.js)        → http://localhost:3000  │
│   Backend  (Django REST)    → http://localhost:8000  │
│   Admin Panel (Vite+React)  → http://localhost:5173  │
│   PostgreSQL                → localhost:5432         │
│   Redis (optional)          → localhost:6379         │
│                                                      │
│   Frontend ──REST API──▶ Backend ──SQL──▶ PostgreSQL │
│                              │                       │
│                              ├──▶ Redis (cache)      │
│                              └──▶ /media/ (files)    │
└──────────────────────────────────────────────────────┘
```

---

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd algosmiths
```

---

## Step 2: Backend Setup

### 2.1 Create Python Virtual Environment

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

### 2.2 Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2.3 Configure Backend Environment Variables

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Open `backend/.env` and update the following values:

```env
SECRET_KEY=any-random-string-for-development
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=health_surveillance
DB_USER=postgres
DB_PASSWORD=<your-postgres-password>
DB_HOST=localhost
DB_PORT=5432

JWT_SECRET=any-random-string-for-jwt

REDIS_URL=redis://localhost:6379/0
```

> **Tip:** For development, any random string works for `SECRET_KEY` and `JWT_SECRET`. In production, use cryptographically strong values.

### 2.4 Set Up the PostgreSQL Database

Ensure PostgreSQL is running, then create the database:

```bash
psql -U postgres
```

```sql
CREATE DATABASE health_surveillance;
\q
```

### 2.5 Run Database Migrations

```bash
python manage.py migrate
```

### 2.6 Create a Superuser (Admin Account)

```bash
python manage.py createsuperuser
```

### 2.7 Start the Backend Server

```bash
python manage.py runserver 8000
```

Verify: Open **http://localhost:8000/admin/** in your browser — the Django admin login page should appear.

> **Leave this terminal open.** Open a new terminal for the frontend.

---

## Step 3: Frontend Setup

### 3.1 Install Node.js Dependencies

```bash
cd frontend
npm install
```

### 3.2 Configure Frontend Environment Variables

```bash
# Windows
copy .env.local.example .env.local

# Linux / macOS
cp .env.local.example .env.local
```

The default values in `.env.local.example` point to `http://localhost:8000/api` and should work without modification.

### 3.3 Start the Frontend Development Server

```bash
npm run dev
```

Verify: Open **http://localhost:3000** in your browser — the ArogyaTrack login page should appear.

---

## Step 4: Mobile App Setup (Optional)

### 4.1 Install Flutter Dependencies

```bash
cd mobile_app
flutter pub get
```

### 4.2 Configure Mobile Environment Variables

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Edit `mobile_app/.env`:

```env
API_BASE_URL=http://<your-local-ip>:8000/api
```

> **Important:** Use your machine's local IP (e.g., `192.168.1.x`) instead of `localhost` for mobile devices and emulators to connect to the backend.

### 4.3 Run on a Device or Emulator

```bash
flutter run
```

---

## Step 5: ML Models Setup (Optional)

The ML models power the surveillance module (clustering, forecasting, anomaly detection, risk scoring). Pre-trained models are included in `ml_models/saved_models/`. To retrain:

```bash
cd ml_models
python -m venv .venv

# Activate
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

pip install numpy pandas scikit-learn prophet xgboost
python train_all_refined.py
```

---

## Step 6: Optional Services

### Redis

Redis is used for caching and as the Celery message broker. The system works without Redis (falls back to in-memory cache), but it is recommended for full functionality.

```bash
# Windows (via WSL)
redis-server

# Linux
sudo systemctl start redis

# macOS
brew services start redis
```

### Celery (Background Tasks)

Celery processes background jobs (ML pipeline, reminders, alerts). Open a separate terminal:

```bash
cd backend
venv\Scripts\activate           # or source venv/bin/activate
celery -A config worker --loglevel=info
```

---

## Quick Start Scripts

Instead of manual setup, use the provided startup scripts (after completing steps 2 and 3 at least once):

### Windows

```bash
start-dev.bat
```

### Linux / macOS

```bash
chmod +x start-dev.sh
./start-dev.sh
```

These scripts start both the backend and frontend servers simultaneously.

---

## Service Summary

After setup, the following services should be running:

| Service | URL | Terminal |
|---|---|---|
| Django Backend API | http://localhost:8000 | Terminal 1 |
| Django Admin Panel | http://localhost:8000/admin/ | Terminal 1 |
| Next.js Frontend | http://localhost:3000 | Terminal 2 |
| Celery Worker (optional) | — | Terminal 3 |
| Redis (optional) | localhost:6379 | Background service |
| PostgreSQL | localhost:5432 | Background service |

---

## Environment Files Reference

| File | Location | Template |
|---|---|---|
| Backend `.env` | `backend/.env` | `backend/.env.example` |
| Frontend `.env.local` | `frontend/.env.local` | `frontend/.env.local.example` |
| Mobile `.env` | `mobile_app/.env` | `mobile_app/.env.example` |

---

## Verification Checklist

After completing setup, verify each component:

- [ ] **PostgreSQL** — `psql -U postgres -l` lists `health_surveillance`
- [ ] **Backend** — http://localhost:8000/admin/ shows Django admin login
- [ ] **Frontend** — http://localhost:3000 shows the ArogyaTrack login page
- [ ] **API Connection** — Frontend login form can reach the backend (check browser DevTools Network tab for `/api/auth/` requests)
- [ ] **Superuser Login** — Can log in to Django admin with the superuser credentials

---

## Troubleshooting

### Backend won't start — "port already in use"

```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux / macOS
lsof -i :8000
kill -9 <PID>
```

### Frontend shows "Network Error" or CORS errors

1. Confirm the backend is running on port 8000
2. Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local` is set to `http://localhost:8000/api`
3. Ensure `DEBUG=True` in `backend/.env` (auto-allows CORS from localhost in debug mode)

### Database migration errors

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### "Module not found" after git pull

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

---

## Detailed Component Guides

For in-depth setup documentation for individual components:

- [Frontend Setup](frontend-setup.md)
- [Backend Setup](backend-setup.md)
