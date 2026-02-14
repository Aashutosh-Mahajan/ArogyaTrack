'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { FiCamera, FiX, FiUser, FiActivity, FiAlertTriangle, FiAlertCircle } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

function ScanQRPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [patientData, setPatientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scan if redirected from QR landing page
  useEffect(() => {
    const storedToken = sessionStorage.getItem('qr_scan_token');
    if (storedToken) {
      sessionStorage.removeItem('qr_scan_token');
      handleScan(storedToken);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setCameraError(null);
      setIsScanning(true);
      
      // Wait for DOM to update (React state is async)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the element exists before initializing scanner
      const element = document.getElementById("qr-reader");
      if (!element) {
        throw new Error("Scanner element not found. Please try again.");
      }
      
      // Initialize scanner if not already done
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      // Request camera permissions and start scanning
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scannerRef.current.start(
        { facingMode: "environment" }, // Try back camera first, will fallback to front
        config,
        (decodedText) => {
          // Success callback
          handleScan(decodedText);
          stopScanning();
        },
        (errorMessage) => {
          // Error callback - ignore frame parsing errors
          // These happen continuously while scanning
        }
      );

      setIsCameraReady(true);
      toast.success('Camera started. Point at QR code to scan.');
    } catch (error: any) {
      console.error('Camera error:', error);
      setIsScanning(false);
      setIsCameraReady(false);
      
      let errorMsg = 'Failed to start camera. ';
      if (error.name === 'NotAllowedError' || error.message?.includes('Permission')) {
        errorMsg += 'Please allow camera access in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.message?.includes('No camera')) {
        errorMsg += 'No camera found on this device.';
      } else if (error.message?.includes('secure')) {
        errorMsg += 'Camera requires HTTPS or localhost.';
      } else if (error.message?.includes('not found')) {
        errorMsg += 'Scanner initialization failed. Please try again.';
      } else {
        errorMsg += error.message || 'Unknown error';
      }
      
      setCameraError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const stopScanning = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
    } finally {
      setIsScanning(false);
      setIsCameraReady(false);
    }
  };

  const handleScan = async (scannedData: string) => {
    setIsLoading(true);
    try {
      // The scanned data should be the JWT token directly from the QR code
      // Use the new patients API endpoint that verifies QR tokens
      const response = await api.patients.scanPatientQR(scannedData);
      setPatientData(response);
      toast.success('Patient data loaded successfully');
    } catch (error: any) {
      console.error('QR Scan Error:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to scan QR code';
      toast.error(errorMessage);
      setPatientData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      handleScan(manualToken);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scan Patient QR</h1>
          <p className="text-gray-600 mt-1">
            Scan patient health card to access medical records
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* QR Scanner */}
          <Card>
            <CardHeader>
              <CardTitle>Camera Scanner</CardTitle>
              <CardDescription>
                Use your camera to scan the patient's health card QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Camera Error Message */}
              {cameraError && !isScanning && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <FiAlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">Camera Access Error</p>
                      <p className="text-sm text-red-700 mt-1">{cameraError}</p>
                      <p className="text-xs text-red-600 mt-2">
                        💡 Tip: Check browser permissions and ensure you're using HTTPS or localhost
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isScanning ? (
                <Button 
                  onClick={startScanning}
                  className="w-full"
                  size="lg"
                >
                  <FiCamera className="mr-2" />
                  Start Camera Scanner
                </Button>
              ) : (
                <div className="space-y-4">
                  {!isCameraReady && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <div className="loading-dots"><span></span><span></span><span></span></div>
                      <p className="text-sm text-blue-700 mt-2">Requesting camera access...</p>
                    </div>
                  )}
                  <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-black"></div>
                  {isCameraReady && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 text-center">
                        📷 Camera active - Point at QR code to scan
                      </p>
                    </div>
                  )}
                  <Button 
                    onClick={stopScanning}
                    variant="destructive"
                    className="w-full"
                  >
                    <FiX className="mr-2" />
                    Stop Scanner
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Or enter the token manually
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Enter JWT token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button 
                  type="submit"
                  className="w-full"
                  disabled={!manualToken.trim() || isLoading}
                >
                  {isLoading ? 'Loading...' : 'Access Patient Records'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Patient Data Display */}
        {patientData && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-green-900">Patient Information</CardTitle>
                {patientData.patient?.profile_photo_url && (
                  <img
                    src={patientData.patient.profile_photo_url}
                    alt="Patient"
                    className="w-16 h-16 rounded-full object-cover border-2 border-green-300"
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Patient Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
                    <FiUser className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">
                        {patientData.patient?.name || `${patientData.profile?.user?.first_name || ''} ${patientData.profile?.user?.last_name || ''}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
                    <FiActivity className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm text-gray-600">Blood Group</p>
                      <p className="font-medium">{patientData.patient?.blood_group || patientData.profile?.blood_group}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Patient ID</p>
                    <p className="font-medium font-mono">
                      {patientData.patient?.unique_patient_id || 'N/A'}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Age / Gender</p>
                    <p className="font-medium">
                      {patientData.patient?.age || '—'} years • {patientData.patient?.gender || patientData.profile?.gender || '—'}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Date of Birth</p>
                    <p className="font-medium">
                      {patientData.patient?.date_of_birth
                        ? new Date(patientData.patient.date_of_birth).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">District</p>
                    <p className="font-medium">
                      {patientData.patient?.district || 'N/A'}
                    </p>
                  </div>

                  {patientData.patient?.phone && (
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{patientData.patient.phone}</p>
                    </div>
                  )}

                  {patientData.patient?.emergency_contact && (
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-sm text-gray-600">Emergency Contact</p>
                      <p className="font-medium">{patientData.patient.emergency_contact}</p>
                    </div>
                  )}

                  {patientData.patient?.address && (
                    <div className="p-3 bg-white rounded-lg col-span-2">
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-medium">{patientData.patient.address}</p>
                      {patientData.patient?.state && (
                        <p className="text-sm text-gray-500">
                          {patientData.patient.state}{patientData.patient?.pincode && ` - ${patientData.patient.pincode}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Information */}
                {patientData.card_info && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-semibold text-blue-900 mb-2">Health Card Information</p>
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      <div>
                        <span className="text-blue-700">Issued: </span>
                        <span className="text-blue-900">
                          {new Date(patientData.card_info.issued_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Expires: </span>
                        <span className="text-blue-900">
                          {new Date(patientData.card_info.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Allergies Alert */}
                {patientData.allergies && patientData.allergies.length > 0 && (
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FiAlertTriangle className="h-5 w-5 text-red-600" />
                      <p className="font-semibold text-red-900">Allergies</p>
                    </div>
                    <div className="space-y-1">
                      {patientData.allergies.map((allergy: any, idx: number) => (
                        <p key={idx} className="text-sm text-red-800">
                          • {allergy.allergen} — {allergy.reaction_type} (Severity: {allergy.severity})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chronic Conditions */}
                {patientData.chronic_conditions && patientData.chronic_conditions.length > 0 && (
                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                    <p className="font-semibold text-yellow-900 mb-2">Chronic Conditions</p>
                    <div className="space-y-1">
                      {patientData.chronic_conditions.map((condition: any, idx: number) => (
                        <p key={idx} className="text-sm text-yellow-800">
                          • {condition.disease_name || condition.condition_name} ({condition.is_active ? 'Active' : 'Inactive'})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical Records */}
                {patientData.medical_records && patientData.medical_records.length > 0 && (
                  <div className="bg-white border rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-3">Recent Medical Records</p>
                    <div className="space-y-3">
                      {patientData.medical_records.slice(0, 5).map((record: any) => (
                        <div key={record.id} className="border-l-4 border-blue-400 pl-3 py-1">
                          <p className="text-sm font-medium text-gray-900">{record.symptoms || 'No symptoms recorded'}</p>
                          {record.diagnoses && record.diagnoses.length > 0 && (
                            <p className="text-xs text-gray-600 mt-1">
                              Dx: {record.diagnoses.map((d: any) => d.disease_name).join(', ')}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(record.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prescriptions */}
                {patientData.prescriptions && patientData.prescriptions.length > 0 && (
                  <div className="bg-white border rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-3">Recent Prescriptions</p>
                    <div className="space-y-2">
                      {patientData.prescriptions.slice(0, 5).map((rx: any) => (
                        <div key={rx.id} className="flex justify-between items-center py-2 border-b last:border-0">
                          <p className="text-sm font-mono">{rx.prescription_number}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(rx.issued_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setPatientData(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    Scan Another Patient
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(ScanQRPage, ['doctor']);
