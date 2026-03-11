# JWT Authentication & Secure File Downloads - Implementation Guide

## Overview

The Health Surveillance System now uses **JWT (JSON Web Tokens)** for authentication with **djangorestframework-simplejwt**. All API endpoints require proper authentication, and the medical report download endpoint implements **role-based access control (RBAC)**.

---

## 1️⃣ JWT Token Configuration

### Token Lifetimes
- **Access Token**: 60 minutes
- **Refresh Token**: 1 day

### Security Features
- HS256 algorithm
- Bearer token authentication
- Automatic token expiration
- Secure signing with secret key

### Configuration Location
File: `backend/config/settings.py`

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),  # 60 minutes
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),     # 1 day
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": os.getenv("JWT_SECRET", SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}
```

---

## 2️⃣ JWT Token Endpoints

### Base URL
`http://localhost:8000/api/auth/`

### Available Endpoints

#### 1. Obtain Token Pair (Login)
```http
POST /api/auth/token/
Content-Type: application/json

{
    "email": "doctor@example.com",
    "password": "your_password"
}
```

**Response (200 OK):**
```json
{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### 2. Refresh Access Token
```http
POST /api/auth/token/refresh/
Content-Type: application/json

{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (200 OK):**
```json
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

## 3️⃣ Secure Report Download Endpoint

### Endpoint Details
```
GET /api/doctors/reports/<attachment_id>/download/
```

### Authentication Required
```http
Authorization: Bearer <access_token>
```

### Role-Based Access Control

#### Access Rules

| Role | Access Rights |
|------|---------------|
| **Doctor** | ✅ Reports they uploaded<br>✅ Reports from their consultations |
| **Patient** | ✅ Reports from their own medical records |
| **Admin** | ✅ All reports |
| **Unauthenticated** | ❌ 401 Unauthorized |
| **Other authenticated users** | ❌ 403 Forbidden |

### Query Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `disposition` | `inline` or `attachment` | `inline` | Control browser behavior |

- **inline**: Opens file in browser (preview)
- **attachment**: Forces download

### Response Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | Success | File returned with proper headers |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Valid token but no access rights |
| 404 | Not Found | File doesn't exist |

### Example Request
```http
GET /api/doctors/reports/123/download/?disposition=attachment
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

### Response Headers
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="test_report.pdf"
X-Content-Type-Options: nosniff
```

---

## 4️⃣ Frontend Integration

### Installation
No additional packages needed - JWT is already configured!

### Axios Configuration

#### 1. Store Tokens Securely
```typescript
// store/authStore.ts
interface AuthTokens {
  access: string;
  refresh: string;
}

const useAuthStore = create<AuthState>((set) => ({
  tokens: null,
  
  setTokens: (tokens: AuthTokens) => {
    set({ tokens });
    // Store in localStorage for persistence
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
  },
  
  clearTokens: () => {
    set({ tokens: null });
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
}));
```

#### 2. Add Interceptor for Authentication
```typescript
// lib/api.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle 401 and refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try refreshing token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(
          'http://localhost:8000/api/auth/token/refresh/',
          { refresh: refreshToken }
        );

        const { access } = response.data;
        localStorage.setItem('access_token', access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };
```

#### 3. Login Function
```typescript
// lib/api.ts
export const api = {
  auth: {
    // JWT Token-based login
    loginWithToken: async (email: string, password: string) => {
      const response = await axios.post(
        'http://localhost:8000/api/auth/token/',
        { email, password }
      );
      return response.data; // { access, refresh }
    },

    // Refresh access token
    refreshToken: async (refreshToken: string) => {
      const response = await axios.post(
        'http://localhost:8000/api/auth/token/refresh/',
        { refresh: refreshToken }
      );
      return response.data; // { access }
    },
  },
};
```

#### 4. Download Report with Authentication
```typescript
// lib/api.ts
export const api = {
  medical: {
    // Download medical report
    downloadReport: async (attachmentId: number, asAttachment = true) => {
      const disposition = asAttachment ? 'attachment' : 'inline';
      
      const response = await apiClient.get(
        `/doctors/reports/${attachmentId}/download/`,
        {
          params: { disposition },
          responseType: 'blob', // Important for file downloads
        }
      );

      return response.data; // Blob
    },
  },
};
```

#### 5. React Component Example
```tsx
// components/ReportDownloadButton.tsx
import { useState } from 'react';
import { api } from '@/lib/api';

export function ReportDownloadButton({ 
  attachmentId, 
  fileName 
}: { 
  attachmentId: number; 
  fileName: string; 
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await api.medical.downloadReport(attachmentId, true);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully');
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to download this file.');
      } else if (error.response?.status === 404) {
        toast.error('File not found.');
      } else {
        toast.error('Failed to download report.');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button 
      onClick={handleDownload} 
      disabled={downloading}
      className="btn btn-primary"
    >
      {downloading ? 'Downloading...' : 'Download Report'}
    </button>
  );
}
```

---

## 5️⃣ Error Handling

### Common Errors

#### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```
**Solution**: Include valid `Authorization: Bearer <token>` header

#### 403 Forbidden
```json
{
  "detail": "You do not have permission to access this file.",
  "error": "FORBIDDEN",
  "message": "Access denied. You can only download reports you uploaded (doctors) or reports from your own medical records (patients)."
}
```
**Solution**: User doesn't have access rights to this specific file

#### 404 Not Found
```json
{
  "detail": "File not found.",
  "error": "FILE_NOT_FOUND",
  "message": "The requested file could not be found on the server."
}
```
**Solution**: File was deleted or attachment ID is invalid

#### Token Expired
```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid",
  "messages": [
    {
      "token_class": "AccessToken",
      "token_type": "access",
      "message": "Token is invalid or expired"
    }
  ]
}
```
**Solution**: Use refresh token to get new access token

---

## 6️⃣ Security Best Practices

### ✅ Do's
- ✅ Store tokens in memory or httpOnly cookies (preferred)
- ✅ Use HTTPS in production
- ✅ Implement token refresh logic
- ✅ Clear tokens on logout
- ✅ Validate token expiration client-side
- ✅ Use secure headers (X-Content-Type-Options)

### ❌ Don'ts
- ❌ Store tokens in localStorage (XSS vulnerable - but acceptable for hackathon)
- ❌ Log tokens to console in production
- ❌ Send tokens in URL parameters
- ❌ Share tokens between users
- ❌ Use weak JWT secrets

---

## 7️⃣ Testing

### Test Token Generation
```bash
# Login and get tokens
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "your_password"
  }'
```

### Test Authenticated Request
```bash
# Download report with Bearer token
curl -X GET "http://localhost:8000/api/doctors/reports/1/download/" \
  -H "Authorization: Bearer <your_access_token>" \
  --output report.pdf
```

### Test Unauthorized Access
```bash
# Should return 401
curl -X GET "http://localhost:8000/api/doctors/reports/1/download/"
```

### Test Forbidden Access (Wrong User)
```bash
# Login as Patient A, try to download Patient B's report
# Should return 403
curl -X GET "http://localhost:8000/api/doctors/reports/123/download/" \
  -H "Authorization: Bearer <patient_a_token>"
```

---

## 8️⃣ Migration Notes

### What Changed?
1. ✅ JWT token lifetimes updated (60 min access, 1 day refresh)
2. ✅ Token endpoints added (`/api/auth/token/`, `/api/auth/token/refresh/`)
3. ✅ Report download endpoint secured with JWT authentication
4. ✅ Role-based access control implemented
5. ✅ Enhanced error messages with proper HTTP status codes

### What Stayed the Same?
- ✅ Database models unchanged
- ✅ Existing authentication logic untouched
- ✅ Medical record creation flow unchanged
- ✅ File upload logic unchanged
- ✅ All other endpoints work as before

### Breaking Changes
- ⚠️ Report downloads now **require** JWT authentication
- ⚠️ Unauthenticated requests return 401 (previously might have been different)

---

## 9️⃣ Production Deployment

### Environment Variables
```env
# .env
JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars
SECRET_KEY=your-django-secret-key
DEBUG=False
```

### Security Checklist
- [ ] Set strong `JWT_SECRET` (minimum 32 characters)
- [ ] Enable HTTPS
- [ ] Set `DEBUG=False`
- [ ] Configure CORS properly
- [ ] Use httpOnly cookies for tokens (advanced)
- [ ] Implement rate limiting on token endpoints
- [ ] Enable token blacklisting on logout
- [ ] Set up monitoring for failed auth attempts

---

## 🎯 Quick Start (Frontend Developer)

### 1. Login and Get Tokens
```typescript
const { access, refresh } = await api.auth.loginWithToken(email, password);
localStorage.setItem('access_token', access);
localStorage.setItem('refresh_token', refresh);
```

### 2. Make Authenticated Requests
```typescript
// Axios automatically adds: Authorization: Bearer <token>
const data = await api.medical.getRecords();
```

### 3. Download Reports
```typescript
const blob = await api.medical.downloadReport(attachmentId);
// Create download link and trigger download
```

### 4. Handle Token Expiration
```typescript
// Axios interceptor automatically refreshes expired tokens
// If refresh fails, user is logged out
```

---

## 📞 Support

### Common Issues

**Q: Token expired, how to refresh?**  
A: Call `/api/auth/token/refresh/` with refresh token

**Q: Getting 403 on report download?**  
A: Check if user has access rights (doctor must have uploaded it, patient must own the record)

**Q: How to test without frontend?**  
A: Use cURL or Postman with Bearer token

**Q: Can I use the old login endpoint?**  
A: Yes! `/api/auth/login/` still works and returns JWT tokens

---

## ✅ Implementation Complete

The system is now secured with:
- ✅ JWT authentication (SimpleJWT)
- ✅ 60-minute access tokens
- ✅ 1-day refresh tokens
- ✅ Role-based access control on file downloads
- ✅ Secure file serving (no public URLs)
- ✅ Proper error handling (401, 403, 404)
- ✅ Production-ready security headers

**Ready for hackathon deployment! 🚀**
