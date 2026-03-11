# QR Scanner Troubleshooting Guide

## Camera Not Starting? Follow These Steps:

### 1. **Browser Permissions**
- When you click "Start Camera Scanner", your browser will ask for camera permission
- Click "Allow" or "Yes" when prompted
- If you previously blocked camera access:
  - **Chrome/Edge**: Click the 🔒 or 🛈 icon in the address bar → Site settings → Camera → Allow
  - **Firefox**: Click the 🔒 icon → Clear permissions and reload
  - **Safari**: Safari → Settings → Websites → Camera → Allow

### 2. **HTTPS Requirement**
- Modern browsers require HTTPS for camera access (except localhost)
- ✅ Currently running on `localhost` - should work!
- If using a different domain, ensure HTTPS is enabled

### 3. **Camera Availability**
- Ensure no other application is using your webcam
- Close Zoom, Teams, Skype, or other video apps
- Try refreshing the page

### 4. **Test Your Setup**
1. Go to `/doctor/scan-qr` page
2. Click "Start Camera Scanner"
3. When prompted, click "Allow" for camera access
4. You should see your webcam feed appear
5. Point your camera at a patient's health card QR code

### 5. **Alternative: Manual Entry**
If camera doesn't work, you can:
- Use the "Manual Entry" option
- Copy/paste the JWT token from the QR code
- Click "Access Patient Records"

## How It Works
1. Patient's QR code contains an encrypted JWT token
2. Doctor scans the QR code with their camera
3. System decodes the token and fetches patient data
4. Patient information displays securely

## Security
- Only doctors and administrators can scan QR codes
- Patients attempting to scan will receive a 403 Forbidden error
- Expired or revoked cards are automatically rejected
