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
import { FiCamera, FiX, FiUser, FiActivity, FiAlertTriangle, FiAlertCircle, FiUserPlus } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

function ScanQRPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualPatientId, setManualPatientId] = useState('');
  const [patientData, setPatientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingPatient, setIsAddingPatient] = useState(false);

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
        scannerRef.current.stop().catch(() => { });
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
      const response = await api.patients.scanPatientQR({ token: scannedData });
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      setIsLoading(true);
      try {
        const response = await api.patients.scanPatientQR({ token: manualToken });
        setPatientData(response);
        toast.success('Patient data loaded successfully');
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to access records');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePatientIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPatientId.trim()) {
      setIsLoading(true);
      try {
        const response = await api.patients.scanPatientQR({ patient_id: manualPatientId.trim() });
        setPatientData(response);
        toast.success('Patient found and records loaded');
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Patient not found');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddToMyPatients = async () => {
    if (!patientData?.patient?.id) {
      toast.error('Patient ID not found in response');
      console.error('Patient data:', patientData);
      return;
    }

    setIsAddingPatient(true);
    try {
      const response: any = await api.medical.addPatientToMyList(patientData.patient.id);
      toast.success(response?.message || '✅ Patient added to your list!');
      // Optionally redirect to create record page
      if (confirm('Patient added successfully! Would you like to create a visit record now?')) {
        router.push(`/doctor/patients/${patientData.patient.id}/create-record`);
      }
    } catch (error: any) {
      console.error('Error adding patient:', error);
      toast.error(error.response?.data?.detail || 'Failed to add patient to your list');
    } finally {
      setIsAddingPatient(false);
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
                Access records using Patient ID or Token
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Option 1: Patient ID */}
              <form onSubmit={handlePatientIdSubmit} className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Universal Patient ID</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="e.g. HS-2026-4F6509"
                    value={manualPatientId}
                    onChange={(e) => setManualPatientId(e.target.value.toUpperCase())}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="submit"
                    disabled={!manualPatientId.trim() || isLoading}
                    className="whitespace-nowrap bg-blue-600"
                  >
                    Find Patient
                  </Button>
                </div>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or use token</span>
                </div>
              </div>

              {/* Option 2: JWT Token */}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Digital Token</label>
                <Input
                  type="text"
                  placeholder="Paste long JWT token here"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={!manualToken.trim() || isLoading}
                >
                  {isLoading ? 'Loading...' : 'Access via Token'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Patient Data Display */}
        {patientData && (
          <div className="space-y-4">
            {/* Action Bar - Clear/Scan Another */}
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setPatientData(null)}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <FiX className="mr-2" />Clear Patient Data
              </Button>
              <Button
                onClick={startScanning}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <FiCamera className="mr-2" />Scan Another QR
              </Button>
            </div>

            {/* Compact Patient Info Box */}
            <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {patientData.patient?.profile_photo_url && (
                      <img
                        src={patientData.patient.profile_photo_url}
                        alt="Patient"
                        className="w-16 h-16 rounded-full object-cover border-2 border-green-300"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <FiUser className="h-5 w-5 text-blue-600" />
                        <p className="text-xl font-bold text-gray-900">
                          {patientData.patient?.name || `${patientData.profile?.user?.first_name || ''} ${patientData.profile?.user?.last_name || ''}`}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="font-mono font-medium">
                          {patientData.patient?.unique_patient_id || 'N/A'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <FiActivity className="h-4 w-4 text-red-600" />
                          <span className="font-semibold">{patientData.patient?.blood_group || patientData.profile?.blood_group || 'N/A'}</span>
                        </span>
                        <span>•</span>
                        <span>
                          {patientData.patient?.age || '—'} years • {patientData.patient?.gender || patientData.profile?.gender || '—'}
                        </span>
                        <span>•</span>
                        <span>{patientData.patient?.district || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    {patientData.patient?.phone && (
                      <p className="text-sm text-gray-600">📱 {patientData.patient.phone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid gap-4 md:grid-cols-2">
              <Button
                onClick={handleAddToMyPatients}
                disabled={isAddingPatient}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg font-semibold"
                size="lg"
              >
                <FiUserPlus className="mr-2 h-5 w-5" />
                {isAddingPatient ? 'Adding...' : '➕ Add to My Patients'}
              </Button>

              <Button
                onClick={() => router.push(`/doctor/patients/${patientData.patient?.id}/create-record`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold"
                size="lg"
              >
                📋 Create Visit Record
              </Button>
            </div>

            {/* Critical Alerts & Vitals Row */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Vitals Summary */}
              {patientData.latest_vitals && (
                <div className="bg-white border rounded-lg p-3 shadow-sm space-y-3">
                  <p className="font-bold text-gray-900 flex items-center">
                    <FiActivity className="mr-2 text-blue-600" /> Current Vitals
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {/* BP */}
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-xs text-gray-500 uppercase">Blood Pressure</p>
                      {patientData.latest_vitals.blood_pressure ? (
                        <div>
                          <p className="text-lg font-bold text-gray-900">
                            {patientData.latest_vitals.blood_pressure.value} <span className="text-xs font-normal text-gray-500">{patientData.latest_vitals.blood_pressure.unit}</span>
                          </p>
                          {patientData.latest_vitals.blood_pressure.status !== 'normal' && (
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-bold uppercase ${patientData.latest_vitals.blood_pressure.status === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                              {patientData.latest_vitals.blood_pressure.status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Not recorded</p>
                      )}
                    </div>

                    {/* Sugar */}
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-xs text-gray-500 uppercase">Blood Sugar</p>
                      {patientData.latest_vitals.blood_sugar ? (
                        <div>
                          <p className="text-lg font-bold text-gray-900">
                            {patientData.latest_vitals.blood_sugar.value} <span className="text-xs font-normal text-gray-500">{patientData.latest_vitals.blood_sugar.unit}</span>
                          </p>
                          {patientData.latest_vitals.blood_sugar.status !== 'normal' && (
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-bold uppercase ${patientData.latest_vitals.blood_sugar.status === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                              {patientData.latest_vitals.blood_sugar.status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Not recorded</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Allergies Alert */}
              {patientData.allergies && patientData.allergies.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiAlertTriangle className="h-5 w-5 text-red-600" />
                    <p className="font-bold text-red-900">Allergies</p>
                  </div>
                  <div className="space-y-1">
                    {patientData.allergies.map((allergy: any, idx: number) => (
                      <p key={idx} className="text-sm text-red-800 font-medium">
                        • {allergy.allergen} — {allergy.reaction_type}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronic Conditions */}
              {patientData.chronic_conditions && patientData.chronic_conditions.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:col-span-2">
                  <p className="font-bold text-yellow-900 mb-2 flex items-center">
                    <FiAlertCircle className="mr-2 text-yellow-600" /> Chronic Conditions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {patientData.chronic_conditions.map((condition: any, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full border border-yellow-200">
                        {condition.disease_name || condition.condition_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Medical Records - Prominent Display */}
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-blue-900">📋 Medical Records & Consultation History</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Visit Records (New Model - More Detailed) */}
                {patientData.visit_records && patientData.visit_records.length > 0 ? (
                  <div className="space-y-4">
                    {patientData.visit_records.map((record: any) => (
                      <div key={record.id} className="border-l-4 border-blue-500 bg-gray-50 rounded-r-lg p-4 hover:bg-gray-100 transition">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">Dr. {record.doctor_name}</p>
                            <p className="text-xs text-gray-500">{record.department}</p>
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(record.visit_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Diagnosis</p>
                            <p className="text-sm text-blue-900 font-medium">{record.diagnosis}</p>
                          </div>

                          {record.tests_performed && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Tests Performed</p>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{record.tests_performed}</p>
                            </div>
                          )}

                          {record.prescription && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Prescription</p>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{record.prescription}</p>
                            </div>
                          )}

                          {record.doctor_notes && (
                            <div className="bg-yellow-50 border-l-2 border-yellow-400 pl-3 py-2">
                              <p className="text-xs font-semibold text-yellow-800 uppercase mb-1">Doctor's Notes</p>
                              <p className="text-sm text-yellow-900">{record.doctor_notes}</p>
                            </div>
                          )}

                          {record.report_attachments && record.report_attachments.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">📎 Attached Reports</p>
                              <div className="flex flex-wrap gap-2">
                                {record.report_attachments.map((attachment: any) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition"
                                  >
                                    📄 {attachment.file_name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : patientData.medical_records && patientData.medical_records.length > 0 ? (
                  // Fallback to old medical records format
                  <div className="space-y-4">
                    {patientData.medical_records.map((record: any) => (
                      <div key={record.id} className="border-l-4 border-blue-500 bg-gray-50 rounded-r-lg p-4 hover:bg-gray-100 transition">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm text-gray-500">
                              {new Date(record.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            {record.doctor && (
                              <p className="text-xs text-gray-400">
                                Consulted: {record.doctor.first_name} {record.doctor.last_name}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase">Symptoms</p>
                            <p className="text-sm text-gray-900">{record.symptoms || 'No symptoms recorded'}</p>
                          </div>

                          {record.diagnoses && record.diagnoses.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase">Diagnosis</p>
                              <div className="space-y-1">
                                {record.diagnoses.map((d: any, idx: number) => (
                                  <p key={idx} className="text-sm text-blue-900 font-medium">
                                    • {d.disease_name} <span className="text-gray-500">({d.icd_10_code})</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {record.notes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase">Notes</p>
                              <p className="text-sm text-gray-700">{record.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No medical records available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Details - Collapsible */}
            <details className="group">
              <summary className="cursor-pointer list-none">
                <Card className="hover:shadow-md transition">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-700">📄 Additional Patient Details</p>
                      <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                    </div>
                  </CardContent>
                </Card>
              </summary>

              <Card className="mt-2">
                <CardContent className="p-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-3 text-sm">
                    <div>
                      <p className="text-gray-500">Date of Birth</p>
                      <p className="font-medium">
                        {patientData.patient?.date_of_birth
                          ? new Date(patientData.patient.date_of_birth).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p className="font-medium">{patientData.patient?.phone || 'N/A'}</p>
                    </div>
                  </div>

                  {patientData.patient?.address && (
                    <div>
                      <p className="text-gray-500 text-sm">Address</p>
                      <p className="font-medium text-sm">{patientData.patient.address}</p>
                      {patientData.patient?.state && (
                        <p className="text-sm text-gray-500">
                          {patientData.patient.state}{patientData.patient?.pincode && ` - ${patientData.patient.pincode}`}
                        </p>
                      )}
                    </div>
                  )}

                  {patientData.card_info && (
                    <div className="border-t pt-3">
                      <p className="text-gray-500 text-sm mb-1">Health Card</p>
                      <div className="flex gap-4 text-sm">
                        <span>Issued: {new Date(patientData.card_info.issued_at).toLocaleDateString()}</span>
                        <span>Expires: {new Date(patientData.card_info.expires_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </details>

            {/* Prescriptions */}
            {patientData.prescriptions && patientData.prescriptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>💊 Recent Prescriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patientData.prescriptions.slice(0, 5).map((rx: any) => (
                      <div key={rx.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded border-b last:border-0">
                        <p className="text-sm font-mono font-medium">{rx.prescription_number}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(rx.issued_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setPatientData(null)}
                variant="outline"
                className="flex-1"
              >
                Scan Another Patient
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(ScanQRPage, ['doctor']);
