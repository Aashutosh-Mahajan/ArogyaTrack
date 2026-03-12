# Frontend Setup Guide

Complete guide for setting up the ArogyaTrack Next.js frontend application.

---

## Prerequisites

| Software | Minimum Version | Installation |
|---|---|---|
| Node.js | 18.0+ | [nodejs.org](https://nodejs.org/) |
| npm | 9.0+ | Included with Node.js |
| Git | 2.30+ | [git-scm.com](https://git-scm.com/) |

Verify your installations:

```bash
node --version    # Should output v18.x or higher
npm --version     # Should output 9.x or higher
```

---

## Project Overview

The frontend is a **Next.js 14** application using the App Router pattern, built with:

- **TypeScript** for type safety
- **Tailwind CSS** + **shadcn/ui** + **Radix UI** for the component system
- **TanStack React Query** for server state and data fetching
- **Zustand** for client-side state management
- **Axios** for HTTP requests with JWT interceptors
- **Recharts** / **Chart.js** for data visualization
- **Leaflet** for interactive surveillance heat maps
- **html5-qrcode** for QR code scanning (doctor/pharmacist workflows)
- **Zod** for form and schema validation

---

## Directory Structure

```
frontend/
├── app/                    # Next.js App Router — pages, layouts, route groups
│   ├── (auth)/             # Authentication pages (login, signup, verify)
│   ├── patient/            # Patient dashboard, medical history, prescriptions
│   ├── doctor/             # Doctor dashboard, QR scanner, records, prescriptions
│   ├── admin/              # Admin surveillance, heat maps, ML analytics
│   └── pharmacist/         # Pharmacist dispensing, inventory
├── components/             # Reusable UI components (shadcn/ui based)
├── lib/                    # API client (Axios), utilities, translations
├── store/                  # Zustand state stores
├── types/                  # TypeScript type definitions
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── .env.local.example      # Environment variable template
```

---

## Step 1: Install Dependencies

```bash
cd frontend
npm install
```

This installs all packages listed in `package.json` including React, Next.js, Tailwind CSS, Radix UI primitives, charting libraries, and Leaflet.

---

## Step 2: Configure Environment Variables

Copy the example environment file:

```bash
# Windows
copy .env.local.example .env.local

# Linux / macOS
cp .env.local.example .env.local
```

Edit `frontend/.env.local` and set the backend API URL:

```env
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# WebSocket URL (if applicable)
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# App metadata
NEXT_PUBLIC_APP_NAME="ArogyaTrack"
NEXT_PUBLIC_APP_VERSION="1.0.0"

# Map token (optional — for production map tiles)
NEXT_PUBLIC_MAPBOX_TOKEN=

# Feature flags
NEXT_PUBLIC_ENABLE_VIDEO_CALL=false
NEXT_PUBLIC_ENABLE_CONTACT_TRACING=false
```

> **Note:** All environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never place secrets or API keys here.

---

## Step 3: Start the Development Server

```bash
npm run dev
```

The application will start at **http://localhost:3000**.

Next.js provides Hot Module Replacement (HMR) — changes to components and pages are reflected instantly without a full page reload.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Create an optimized production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint across the project |
| `npm run type-check` | Run TypeScript type checking without emitting |

---

## Step 4: Build for Production

```bash
npm run build
```

This generates an optimized build in the `.next/` directory. To serve it locally:

```bash
npm start
```

---

## API Client Configuration

The centralized API client is located at `frontend/lib/api.ts`. It provides:

- **Axios instance** with `baseURL` set from `NEXT_PUBLIC_API_URL`
- **JWT token injection** — automatically attaches `Authorization: Bearer <token>` to every request
- **Token refresh** — intercepts 401 responses and attempts a silent token refresh
- **Error handling** — displays toast notifications for API errors

### API Module Methods

| Module | Methods |
|---|---|
| `auth` | `login()`, `register()`, `logout()`, `refreshToken()` |
| `patients` | `getProfile()`, `updateProfile()`, `getHealthCard()` |
| `medical` | `getRecords()`, `addRecord()`, `getAllergies()` |
| `prescriptions` | `create()`, `getList()`, `download()`, `checkInteractions()` |
| `pharmacy` | `scanPrescription()`, `scanPatient()`, `dispense()` |
| `adherence` | `getSummary()`, `markDose()`, `getReminders()` |
| `surveillance` | `getHeatMap()`, `getAlerts()`, `getForecasts()` |
| `dashboard` | `getSummary()`, `getKPIs()`, `getAlerts()` |

---

## Key Frontend Pages

| Route | Role | Description |
|---|---|---|
| `/login` | All | User authentication |
| `/signup` | All | New account registration |
| `/patient/dashboard` | Patient | Health snapshot, alerts, recent records |
| `/patient/medical-history` | Patient | Full medical record timeline |
| `/patient/prescriptions` | Patient | Active and past prescriptions |
| `/patient/adherence` | Patient | Dose tracking and compliance |
| `/patient/health-card` | Patient | QR health card for quick access |
| `/doctor/dashboard` | Doctor | Patient list and quick actions |
| `/doctor/scan-qr` | Doctor | Camera-based QR scanner |
| `/doctor/records` | Doctor | Medical record management |
| `/doctor/add-record` | Doctor | Create new diagnosis/record |
| `/doctor/prescriptions` | Doctor | Prescription creation |
| `/admin/dashboard` | Admin | Surveillance overview |
| `/admin/surveillance` | Admin | Heat maps, ML analytics, forecasts |
| `/admin/alerts` | Admin | Outbreak alert management |
| `/pharmacist/dashboard` | Pharmacist | Prescription scanning, dispensing |

---

## Troubleshooting

### Port 3000 already in use

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux / macOS
lsof -i :3000
kill -9 <PID>
```

### API connection errors (CORS / Network)

1. Ensure the Django backend is running on port 8000
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local` matches the backend URL
3. Check that `CORS_ALLOWED_ORIGINS` in the backend `.env` includes `http://localhost:3000`

### TypeScript errors after pulling new changes

```bash
npm run type-check
```

If types are outdated, regenerate:

```bash
rm -rf node_modules/.cache
npm run dev
```
