# 🏥 Healthcare Surveillance System - Localhost Development Setup

Complete configuration guide for running the system on **localhost** without TLS/HTTPS.

---

## 🎯 Architecture Overview

```
Frontend:  http://localhost:3000  (Next.js)
Backend:   http://localhost:8000  (Django REST API)
Database:  localhost:5432         (PostgreSQL)
Cache:     localhost:6379         (Redis)
```

**No HTTPS, No TLS, No Self-Signed Certificates** ✅

---

## 📋 Prerequisites

Install these before starting:

- **Python 3.10+** (for Django backend)
- **Node.js 18+** (for Next.js frontend)
- **PostgreSQL 14+** (database)
- **Redis** (optional, for caching/Celery)
- **Git** (for version control)

---

## 🔧 PART 1: Backend Configuration (Django)

### Step 1: Create Python Virtual Environment

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

**Key packages installed:**
- `django` - Web framework
- `djangorestframework` - REST API
- `django-cors-headers` - CORS handling
- `psycopg2-binary` - PostgreSQL adapter
- `djangorestframework-simplejwt` - JWT authentication

### Step 3: Configure Environment Variables

Create `.env` file in `backend/` directory:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
# Django Core
SECRET_KEY=your-secret-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (PostgreSQL)
DB_NAME=health_surveillance
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432

# JWT Secret (can be same as SECRET_KEY for development)
JWT_SECRET=your-jwt-secret-key

# Redis (Optional - for caching)
REDIS_URL=redis://localhost:6379/0

# Email (Console backend for development - prints to terminal)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=noreply@localhost
```

### Step 4: Updated settings.py Configuration

The `backend/config/settings.py` is already configured with:

```python
# ========================================================================
# CORS Configuration for Local Development
# ========================================================================

if DEBUG:
    # Development: Allow localhost only
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
else:
    # Production: Use environment variable
    CORS_ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# CSRF trusted origins (must match CORS origins)
if DEBUG:
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# ALLOWED_HOSTS
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# DEBUG must be True for development
DEBUG = True
```

### Step 5: Setup Database

```bash
# Start PostgreSQL (if not already running)
# Windows: Start from Services or pgAdmin
# Linux: sudo systemctl start postgresql
# Mac: brew services start postgresql

# Create database
psql -U postgres
CREATE DATABASE health_surveillance;
\q

# Run migrations
cd backend
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser
```

### Step 6: Start Django Backend

```bash
cd backend
python manage.py runserver 8000
```

**Expected output:**
```
System check identified no issues (0 silenced).
February 14, 2026 - 10:00:00
Django version X.X.X, using settings 'config.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

✅ Backend running at: **http://localhost:8000**

---

## 🎨 PART 2: Frontend Configuration (Next.js)

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

**Key packages:**
- `next` - React framework
- `axios` - HTTP client
- `html5-qrcode` - QR code scanner
- `zustand` - State management
- `react-query` - Data fetching

### Step 2: Configure Environment Variables

Create `.env.local` file in `frontend/` directory:

```bash
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:

```env
# ========================================================================
# LOCAL DEVELOPMENT CONFIGURATION
# ========================================================================

# Backend API URL (IMPORTANT: Use localhost, not IP address)
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# App Configuration
NEXT_PUBLIC_APP_NAME="Health Surveillance System"
NEXT_PUBLIC_APP_VERSION="1.0.0"

# Feature Flags
NEXT_PUBLIC_ENABLE_VIDEO_CALL=false
NEXT_PUBLIC_ENABLE_CONTACT_TRACING=false
```

### Step 3: Verify API Configuration

Check `frontend/lib/api.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,  // ✅ Uses environment variable
      headers: {
        'Content-Type': 'application/json',
      },
    });
    // ... interceptors
  }
}
```

✅ **No hardcoded IP addresses**
✅ **Uses environment variable**
✅ **Supports localhost without HTTPS**

### Step 4: Start Frontend Development Server

```bash
cd frontend
npm run dev
```

**Or specify port explicitly:**
```bash
npm run dev -- -p 3000
```

**Expected output:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

✅ Frontend running at: **http://localhost:3000**

---

## 📷 PART 3: Camera Configuration (No TLS Required)

### Browser Camera Access on Localhost

Modern browsers allow camera access on `localhost` **without HTTPS**:

✅ **Chrome/Edge**: Camera works on `http://localhost`  
✅ **Firefox**: Camera works on `http://localhost`  
✅ **Safari**: Camera works on `http://localhost`  

❌ **IP addresses require HTTPS**: `http://192.168.x.x` won't work  
✅ **Solution**: Always use `http://localhost:3000`

### Camera Implementation

The QR scanner in `frontend/app/doctor/scan-qr/page.tsx` uses:

```typescript
import { Html5Qrcode } from 'html5-qrcode';

const startScanning = async () => {
  try {
    const scanner = new Html5Qrcode("qr-reader");
    
    // Request camera access
    await scanner.start(
      { facingMode: "environment" }, // or "user" for front camera
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (decodedText) => {
        // QR code scanned successfully
        handleScan(decodedText);
        scanner.stop();
      },
      (errorMessage) => {
        // Frame parsing error (ignore - happens continuously)
      }
    );
    
    console.log("Camera started successfully");
  } catch (error) {
    console.error("Camera error:", error);
    
    // Handle specific errors
    if (error.name === 'NotAllowedError') {
      alert('Please allow camera access in your browser settings');
    } else if (error.name === 'NotFoundError') {
      alert('No camera found on this device');
    }
  }
};
```

### Test Camera Access

Create a test page `frontend/app/test-camera/page.tsx`:

```typescript
'use client';

import { useState } from 'react';

export default function TestCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      setStream(mediaStream);
      setError('');
      
      // Display in video element
      const video = document.getElementById('video') as HTMLVideoElement;
      if (video) {
        video.srcObject = mediaStream;
      }
      
      console.log('✅ Camera access granted');
    } catch (err: any) {
      console.error('❌ Camera error:', err);
      setError(err.message || 'Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Camera Test</h1>
      
      <div className="space-y-4">
        <button
          onClick={startCamera}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Start Camera
        </button>
        
        <button
          onClick={stopCamera}
          className="px-4 py-2 bg-red-600 text-white rounded ml-2"
        >
          Stop Camera
        </button>
        
        {error && (
          <div className="p-4 bg-red-100 text-red-800 rounded">
            Error: {error}
          </div>
        )}
        
        <video
          id="video"
          autoPlay
          playsInline
          className="w-full max-w-md border rounded"
        />
      </div>
    </div>
  );
}
```

---

## 🚀 PART 4: Complete Startup Sequence

### Development Startup Order

```bash
# 1. Start PostgreSQL
# Windows: Check Services or use pgAdmin
# Linux: sudo systemctl start postgresql
# Mac: brew services start postgresql

# 2. Start Redis (Optional)
# Windows: redis-server.exe
# Linux: sudo systemctl start redis
# Mac: brew services start redis

# 3. Start Django Backend (Terminal 1)
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python manage.py runserver 8000

# 4. Start Next.js Frontend (Terminal 2)
cd frontend
npm run dev

# 5. Open Browser
# http://localhost:3000
```

### Quick Start Script (Windows)

Create `start-dev.bat`:

```batch
@echo off
echo Starting Healthcare Surveillance System...

REM Start backend in new window
start cmd /k "cd backend && venv\Scripts\activate && python manage.py runserver 8000"

REM Wait 3 seconds
timeout /t 3

REM Start frontend in new window
start cmd /k "cd frontend && npm run dev"

REM Wait 3 seconds
timeout /t 3

REM Open browser
start http://localhost:3000

echo System started! Check the terminal windows for logs.
```

### Quick Start Script (Linux/Mac)

Create `start-dev.sh`:

```bash
#!/bin/bash
echo "Starting Healthcare Surveillance System..."

# Start backend in background
cd backend
source venv/bin/activate
python manage.py runserver 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend in background
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

# Open browser
if command -v xdg-open > /dev/null; then
  xdg-open http://localhost:3000
elif command -v open > /dev/null; then
  open http://localhost:3000
fi

echo "System started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
```

Make executable:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

## ✅ PART 5: Testing & Verification

### Test 1: Backend Health Check

```bash
# Test API is responding
curl http://localhost:8000/api/

# Expected: JSON response or 404 (normal, no root endpoint)
```

### Test 2: Frontend Connection

```bash
# Check frontend loads
curl http://localhost:3000

# Expected: HTML response
```

### Test 3: CORS Configuration

Open browser console at `http://localhost:3000`, then:

```javascript
// Test API call
fetch('http://localhost:8000/api/auth/login/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'test123'
  })
})
.then(res => res.json())
.then(data => console.log('✅ CORS working:', data))
.catch(err => console.error('❌ CORS error:', err));
```

**Expected**: Response from backend (even if invalid credentials)  
**No CORS errors** in console

### Test 4: Camera Access

Navigate to: `http://localhost:3000/doctor/scan-qr`

1. Click "Start Camera Scanner"
2. Browser prompts for camera permission
3. Click "Allow"
4. Camera feed appears
5. Point at QR code to scan

**Troubleshooting Camera:**
- ✅ Using `http://localhost:3000` (not IP address)
- ✅ Camera permission granted in browser
- ✅ No other apps using camera
- ✅ HTTPS not required on localhost

---

## 🔧 PART 6: Common Issues & Solutions

### Issue 1: CORS Error

**Error:**
```
Access to XMLHttpRequest at 'http://localhost:8000/api/'
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**
```python
# Check backend/config/settings.py

# Verify CORS configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True

# Verify middleware order
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # ← Must be before CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    # ...
]
```

### Issue 2: Camera Not Working

**Error:** "Camera not allowed" or "NotAllowedError"

**Solutions:**

1. **Check URL**: Must use `http://localhost:3000` (not IP address)

2. **Check Browser Permissions**:
   - Chrome: `chrome://settings/content/camera`
   - Firefox: Click 🔒 → Clear permissions → Reload
   - Edge: `edge://settings/content/camera`

3. **Close Other Apps**: Zoom, Teams, Skype using camera

4. **Test Camera Access**:
   ```javascript
   navigator.mediaDevices.getUserMedia({ video: true })
     .then(stream => console.log('✅ Camera works'))
     .catch(err => console.error('❌ Camera error:', err));
   ```

### Issue 3: Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

Windows:
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

Linux/Mac:
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

### Issue 4: Database Connection Error

**Error:**
```
django.db.utils.OperationalError: could not connect to server
```

**Solutions:**

1. **Start PostgreSQL**:
   ```bash
   # Windows
   net start postgresql-x64-14
   
   # Linux
   sudo systemctl start postgresql
   
   # Mac
   brew services start postgresql
   ```

2. **Check credentials** in `backend/.env`:
   ```env
   DB_NAME=health_surveillance
   DB_USER=postgres
   DB_PASSWORD=your_password  # ← Check this
   DB_HOST=localhost
   DB_PORT=5432
   ```

3. **Create database**:
   ```bash
   psql -U postgres
   CREATE DATABASE health_surveillance;
   ```

### Issue 5: Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'corsheaders'
```

**Solution:**
```bash
# Activate virtual environment
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Verify installation
pip list | grep cors
```

### Issue 6: API_URL Not Defined

**Error:**
```
TypeError: Cannot read property 'NEXT_PUBLIC_API_URL' of undefined
```

**Solutions:**

1. **Create `.env.local`**:
   ```bash
   cd frontend
   cp .env.local.example .env.local
   ```

2. **Verify content**:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   ```

3. **Restart Next.js** (required after env changes):
   ```bash
   # Ctrl+C to stop
   npm run dev
   ```

---

## 📦 PART 7: Production vs Development

### Development (Localhost)

```python
# settings.py
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1']

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
]

# No HTTPS required
# No SSL certificates
# Console email backend
```

### Production (Deploy)

```python
# settings.py
DEBUG = False
ALLOWED_HOSTS = ['yourdomain.com']

CORS_ALLOWED_ORIGINS = [
    'https://yourdomain.com',
]

# HTTPS required
# SSL certificates from Let's Encrypt
# SMTP email backend
```

**Separate environment files:**
- Development: `backend/.env`
- Production: Use environment variables in hosting (Heroku, AWS, etc.)

---

## 🎯 Quick Reference

### URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api
- **Admin Panel**: http://localhost:8000/admin

### Commands

```bash
# Backend
cd backend
python manage.py runserver 8000
python manage.py migrate
python manage.py createsuperuser

# Frontend
cd frontend
npm run dev
npm run build
npm run start

# Database
psql -U postgres
\l                    # List databases
\c health_surveillance  # Connect to database
\dt                   # List tables
```

### File Structure

```
Health-Surveillance/
├── backend/
│   ├── config/
│   │   └── settings.py      ← CORS configuration
│   ├── .env                 ← Environment variables
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── lib/
│   │   └── api.ts          ← API client
│   ├── .env.local          ← Environment variables
│   ├── package.json
│   └── next.config.js
└── README.md
```

---

## 🔐 Security Notes

### Local Development (Current Setup)

✅ **Safe for localhost**:
- HTTP is fine
- CORS limited to localhost:3000
- Debug mode enabled
- Console email backend

### Production Deployment

❌ **Must change for production**:
- Enable HTTPS/TLS
- Set `DEBUG = False`
- Use strong `SECRET_KEY`
- Configure SMTP email
- Set specific `ALLOWED_HOSTS`
- Use environment variables
- Enable database backups

---

## 📞 Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Verify all prerequisites installed
3. Check terminal output for specific errors
4. Ensure ports 3000/8000 are available
5. Test camera in browser settings

---

## ✨ Summary

Your Healthcare Surveillance System is now configured for **localhost development**:

✅ Backend runs on `http://localhost:8000`  
✅ Frontend runs on `http://localhost:3000`  
✅ CORS properly configured  
✅ Camera works without HTTPS  
✅ No IP addresses in code  
✅ Environment variables clean  
✅ Production-ready structure  

**Start developing! 🚀**
