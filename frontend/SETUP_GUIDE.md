# Health Surveillance System - Frontend Setup Guide

Complete guide to set up and run the modern web frontend.

## 📋 Prerequisites

Ensure you have the following installed:

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher (or yarn/pnpm)
- **Git**: For cloning the repository
- **Backend API**: Running on `http://localhost:8000`

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

This will install all required packages including:
- Next.js framework
- React and React DOM
- TypeScript
- Tailwind CSS
- Chart libraries (Recharts)
- Map libraries (Leaflet)
- QR scanner
- And more...

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit the file with your configuration
code .env.local  # or use any text editor
```

**Required Configuration:**

```env
# API Endpoint (must match your backend)
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# WebSocket endpoint (for real-time features)
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# Optional: Mapbox token (for advanced maps)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

### Step 3: Start Development Server

```bash
npm run dev
```

The application will start at: **http://localhost:3000**

### Step 4: Test the Application

1. Open your browser to `http://localhost:3000`
2. You should see the login page
3. Enter an email to receive OTP
4. Verify OTP to access the dashboard

## 🔧 Detailed Setup

### Installation Options

#### Using npm
```bash
npm install
npm run dev
```

#### Using Yarn
```bash
yarn install
yarn dev
```

#### Using pnpm (Faster)
```bash
pnpm install
pnpm dev
```

### Environment Variables Explained

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000/api` | ✅ Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for real-time | `ws://localhost:8000/ws` | ⚠️ Optional |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox access token | - | ⚠️ Optional |
| `NEXT_PUBLIC_APP_NAME` | Application name | `Health Surveillance System` | ❌ No |
| `NEXT_PUBLIC_ENABLE_VIDEO_CALL` | Enable video calls | `false` | ❌ No |

### Port Configuration

By default, Next.js runs on port **3000**. To change:

```bash
# Using npm
PORT=3001 npm run dev

# Or modify package.json
"dev": "next dev -p 3001"
```

## 🏗️ Build for Production

### Development Build

```bash
npm run dev
```

Features:
- Hot reload
- Source maps
- Detailed error messages

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

Features:
- Optimized bundles
- Minified code
- Better performance

### Build Output

```
frontend/
├── .next/              # Build output
│   ├── static/        # Static assets
│   └── server/        # Server bundles
├── out/               # Static export (if configured)
└── public/            # Public assets
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Option 1: Kill the process
npx kill-port 3000

# Option 2: Use different port
PORT=3001 npm run dev
```

#### 2. Module Not Found

**Error:** `Cannot find module 'xyz'`

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 3. API Connection Failed

**Error:** `Failed to fetch` or `Network Error`

**Solution:**
- Ensure backend is running: `http://localhost:8000`
- Check `.env.local` has correct API URL
- Verify CORS is enabled on backend
- Check backend logs for errors

#### 4. Map Not Displaying

**Error:** Map container is blank

**Solution:**
```bash
# Ensure Leaflet CSS is loaded
# Check browser console for errors
# Verify map data is being fetched

# If using Mapbox, check token:
NEXT_PUBLIC_MAPBOX_TOKEN=your_valid_token
```

#### 5. QR Scanner Not Working

**Error:** Camera access denied

**Solution:**
- Grant camera permissions in browser
- Use HTTPS in production (HTTP only works on localhost)
- Check browser compatibility (Chrome/Edge/Firefox recommended)

#### 6. TypeScript Errors

**Error:** `Type 'X' is not assignable to type 'Y'`

**Solution:**
```bash
# Run type checking
npm run type-check

# If issues persist, clear Next.js cache
rm -rf .next
npm run dev
```

### Browser Console Errors

#### CORS Errors

```
Access to fetch at 'http://localhost:8000/api/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**

Add to backend `settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
```

#### 401 Unauthorized

```
Request failed with status code 401
```

**Solution:**
- Token expired - Login again
- Clear localStorage: `localStorage.clear()`
- Check backend JWT settings

### Performance Issues

#### Slow Initial Load

```bash
# Analyze bundle size
npm run build -- --profile

# Use production mode
npm run build && npm run start
```

#### Memory Issues

```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

## 📚 Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start development server with hot reload |
| `build` | `npm run build` | Build for production |
| `start` | `npm run start` | Start production server |
| `lint` | `npm run lint` | Run ESLint |
| `type-check` | `npm run type-check` | Check TypeScript types |
| `format` | `npm run format` | Format code with Prettier |
| `test` | `npm run test` | Run tests |

## 🎯 Testing the Setup

### 1. Backend Connection Test

```bash
# Test API is accessible
curl http://localhost:8000/api/auth/send-otp/ \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Should return: {"detail": "OTP sent successfully"}
```

### 2. Frontend Connection Test

1. Open `http://localhost:3000`
2. Open browser DevTools (F12)
3. Go to Network tab
4. Try logging in
5. Check if API calls are successful (status 200/201)

### 3. Feature Tests

**Patient Dashboard:**
- ✅ View medical records
- ✅ View prescriptions
- ✅ Check adherence tracker

**Doctor Dashboard:**
- ✅ Scan QR code (camera access)
- ✅ View patient data
- ✅ Create new records

**Admin Dashboard:**
- ✅ View heat map
- ✅ See disease clusters
- ✅ Check forecasts
- ✅ Review alerts

## 🌐 Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel deploy

# Production deployment
vercel --prod
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy

# Production deployment
netlify deploy --prod
```

### Deploy to Custom Server

```bash
# Build the application
npm run build

# Copy files to server
scp -r .next/ user@server:/var/www/health-app/

# On server, install dependencies
npm install --production

# Start with PM2
pm2 start npm --name "health-frontend" -- start
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build image
docker build -t health-frontend .

# Run container
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://api:8000/api health-frontend
```

## 📞 Support

### Getting Help

1. **Check Documentation**: [README.md](README.md)
2. **Backend Issues**: See [backend/README.md](../backend/README.md)
3. **Browser Console**: Check for error messages
4. **Network Tab**: Verify API calls

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check Next.js build info
npm run build -- --debug
```

## ✅ Verification Checklist

Before submitting or deploying:

- [ ] Backend API is running
- [ ] `.env.local` is configured
- [ ] All dependencies installed
- [ ] Development server starts without errors
- [ ] Can login successfully
- [ ] All dashboards load properly
- [ ] Maps display correctly
- [ ] Charts render properly
- [ ] QR scanner works (on supported browsers)
- [ ] API calls succeed (check Network tab)
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)

## 🎉 Success!

If everything works:

1. **Patient Dashboard**: `http://localhost:3000/dashboard`
2. **Doctor Dashboard**: `http://localhost:3000/doctor`
3. **Admin Dashboard**: `http://localhost:3000/admin`

**Next Steps:**
- Explore the dashboards
- Test QR scanning
- Check analytics and maps
- Review the code structure

---

**Setup Time**: ~5 minutes  
**Status**: ✅ Ready to Use  
**Last Updated**: February 2026
