# 🚀 Quick Start - Localhost Development

## ✅ Configuration Complete!

Your Healthcare Surveillance System is now configured for **localhost development**.

---

## 📝 What Was Configured

### 1. Backend (Django) - `http://localhost:8000`

✅ **CORS Configuration** (`backend/config/settings.py`):
```python
if DEBUG:
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
CORS_ALLOW_CREDENTIALS = True
```

✅ **Allowed Hosts**:
```python
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
```

✅ **Database**: PostgreSQL on `localhost:5432`

### 2. Frontend (Next.js) - `http://localhost:3000`

✅ **Environment Variables** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

✅ **API Client** (`frontend/lib/api.ts`):
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
```

✅ **No hardcoded IP addresses**

### 3. Camera Access

✅ Works on `http://localhost:3000` **without HTTPS**
✅ Browser permissions handled in QR scanner
✅ Proper error messages for camera issues

---

## 🎯 Start Development

### Option 1: Quick Start Script (Windows)

```bash
# Double-click or run:
start-dev.bat
```

This will:
1. Start Django backend on port 8000
2. Start Next.js frontend on port 3000
3. Open browser at http://localhost:3000

### Option 2: Manual Start

```bash
# Terminal 1: Backend
cd backend
venv\Scripts\activate
python manage.py runserver 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Option 3: Linux/Mac Script

```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

## 🔧 First Time Setup

### 1. Create Backend .env File

```bash
cd backend
copy .env.example .env
```

Edit `.env` and update `DB_PASSWORD` if needed.

### 2. Create Frontend .env.local File

**Already created!** Located at `frontend/.env.local`

Contents:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 3. Setup Database

```bash
# Create database
psql -U postgres
CREATE DATABASE health_surveillance;
\q

# Run migrations
cd backend
python manage.py migrate

# Create admin user
python manage.py createsuperuser
```

### 4. Install Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

---

## 🧪 Test Your Setup

### 1. Test Backend

Visit: http://localhost:8000/admin

Should see Django admin login page.

### 2. Test Frontend

Visit: http://localhost:3000

Should see the application homepage.

### 3. Test CORS

Open browser console at http://localhost:3000 and run:

```javascript
fetch('http://localhost:8000/api/auth/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@test.com', password: 'test' })
})
.then(res => res.json())
.then(data => console.log('✅ CORS works:', data))
.catch(err => console.error('❌ Error:', err));
```

**Expected**: Response from API (no CORS errors)

### 4. Test Camera

1. Navigate to: http://localhost:3000/doctor/scan-qr
2. Click "Start Camera Scanner"
3. Allow camera permission
4. Camera feed should appear

**If camera doesn't work:**
- Ensure using `localhost` (not IP address)
- Check browser camera permissions
- Close other apps using camera

---

## 📁 Files Created/Updated

```
Health-Surveillance/
├── backend/
│   ├── config/
│   │   └── settings.py          ✅ Updated CORS config
│   └── .env.example              ✅ Updated
│
├── frontend/
│   ├── .env.local                ✅ Created
│   └── .env.local.example        ✅ Updated
│
├── start-dev.bat                 ✅ Created (Windows)
├── start-dev.sh                  ✅ Created (Linux/Mac)
├── LOCALHOST_SETUP_GUIDE.md      ✅ Created (Full guide)
└── QUICKSTART.md                 ✅ This file
```

---

## 📚 Documentation

- **Full Setup Guide**: `LOCALHOST_SETUP_GUIDE.md`
- **Camera Troubleshooting**: `frontend/QR_SCANNER_GUIDE.md`

---

## 🐛 Common Issues

### "CORS Error"
- Check backend is running on port 8000
- Verify frontend .env.local has correct API_URL
- Restart both servers

### "Camera Not Working"
- Must use `http://localhost:3000` (not IP)
- Allow camera permission in browser
- Close other apps using webcam

### "Port Already in Use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### "Database Connection Failed"
- Start PostgreSQL service
- Check credentials in backend/.env
- Create database: `CREATE DATABASE health_surveillance;`

---

## ✨ Summary

✅ Backend: http://localhost:8000  
✅ Frontend: http://localhost:3000  
✅ CORS: Configured for localhost  
✅ Camera: Works without HTTPS  
✅ Environment: Clean and production-ready  

**You're ready to develop! 🚀**

Run `start-dev.bat` to begin!
