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
import { FiCamera, FiX, FiUser, FiActivity, FiAlertTriangle, FiAlertCircle, FiUserPlus, FiSearch, FiCreditCard } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';

function ScanQRPage() {
  const router = useRouter();
  const { t } = useLanguage();
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
        scannerRef.current.clear();
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
        scannerRef.current.clear();
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
      toast.success(t('patient_data_loaded'));
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
        toast.success(t('patient_data_loaded'));
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
        toast.success(t('patient_data_loaded'));
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
      return;
    }

    setIsAddingPatient(true);
    try {
      const response: any = await api.medical.addPatientToMyList(patientData.patient.id);
      toast.success(response?.message || '✅ Patient added to your list!');
      // Optionally redirect to create record page
      if (confirm('Patient added successfully! Would you like to create a visit record now?')) {
        router.push(`/doctor/patients/${patientData.patient.id}/create-consultation`);
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
      <div className="max-w-5xl mx-auto space-y-8 pb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('scan_qr_title')}</h1>
          <p className="text-slate-500 mt-1">
            {t('scan_qr_subtitle')}
          </p>
        </div>

        {!patientData && (
          <div className="grid gap-8 md:grid-cols-2">
            {/* QR Scanner */}
            <Card className="border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-md flex flex-col h-full">
              <div className="h-1 bg-gradient-to-r from-teal-400 to-blue-400"></div>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 rounded-lg">
                    <FiCamera className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('camera_scanner')}</CardTitle>
                    <CardDescription>{t('camera_scanner_desc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Camera Error Message */}
                {cameraError && !isScanning && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <FiAlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900">{t('camera_access_error')}</p>
                        <p className="text-sm text-red-700 mt-1">{cameraError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 flex flex-col justify-center min-h-[300px]">
                  {!isScanning ? (
                    <div className="text-center space-y-4">
                      <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
                        <FiCamera className="w-10 h-10 text-slate-400" />
                      </div>
                      <Button
                        onClick={startScanning}
                        size="lg"
                        className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-8 shadow-lg hover:shadow-xl transition-all"
                      >
                        {t('start_camera')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 w-full">
                      {!isCameraReady && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center animate-pulse">
                          <p className="text-sm text-blue-700">Initializing camera...</p>
                        </div>
                      )}
                      <div className="relative rounded-xl overflow-hidden bg-black shadow-inner aspect-square max-w-sm mx-auto">
                        <div id="qr-reader" className="w-[100%] h-full object-cover"></div>
                        {isCameraReady && <div className="absolute inset-0 border-2 border-teal-400/50 animate-pulse pointer-events-none"></div>}
                      </div>
                      {isCameraReady && (
                        <p className="text-sm text-center text-teal-600 font-medium">
                          {t('camera_active')}
                        </p>
                      )}
                      <Button
                        onClick={stopScanning}
                        variant="destructive"
                        className="w-full rounded-full"
                      >
                        <FiX className="mr-2" />
                        {t('stop_scanner')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card className="border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-md flex flex-col h-full">
              <div className="h-1 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <FiSearch className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('manual_entry')}</CardTitle>
                    <CardDescription>{t('manual_entry_desc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 flex-1">
                {/* Option 1: Patient ID */}
                <form onSubmit={handlePatientIdSubmit} className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700">{t('universal_patient_id')}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FiUser className="absolute left-3 top-3 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="e.g. HS-202X-XXXXX"
                        value={manualPatientId}
                        onChange={(e) => setManualPatientId(e.target.value.toUpperCase())}
                        className="pl-10 font-mono text-sm uppercase"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!manualPatientId.trim() || isLoading}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {t('find_patient')}
                    </Button>
                  </div>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400 font-medium">Or use token</span>
                  </div>
                </div>

                {/* Option 2: JWT Token */}
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700">{t('digital_token')}</label>
                  <div className="relative">
                    <FiCreditCard className="absolute left-3 top-3 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Paste long JWT token here"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="pl-10 font-mono text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-slate-200 hover:bg-slate-50 text-slate-700"
                    disabled={!manualToken.trim() || isLoading}
                  >
                    {isLoading ? t('loading') : t('access_via_token')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Patient Data Display */}
        {patientData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Action Bar - Clear/Scan Another */}
            <div className="flex justify-end gap-3 print:hidden">
              <Button
                onClick={() => setPatientData(null)}
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              >
                <FiX className="mr-2" /> {t('clear_patient_data')}
              </Button>
              <Button
                onClick={() => { setPatientData(null); setTimeout(startScanning, 100); }}
                variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
              >
                <FiCamera className="mr-2" /> {t('scan_another')}
              </Button>
            </div>

            {/* Compact Patient Info Box */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-teal-50 to-blue-50 overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-5">
                <FiUser className="w-32 h-32" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    {patientData.patient?.profile_photo_url ? (
                      <img
                        src={patientData.patient.profile_photo_url}
                        alt="Patient"
                        className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-teal-600 text-2xl font-bold shadow-md border-4 border-teal-100">
                        {patientData.patient?.name?.charAt(0) || 'P'}
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-slate-900">
                          {patientData.patient?.name || `${patientData.profile?.user?.first_name || ''} ${patientData.profile?.user?.last_name || ''}`}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-white/60 text-xs font-mono text-slate-500 border border-slate-200/50">
                          {patientData.patient?.unique_patient_id || 'ID N/A'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <FiActivity className="h-4 w-4 text-rose-500" />
                          <span className="font-semibold">{patientData.patient?.blood_group || patientData.profile?.blood_group || 'N/A'}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          {patientData.patient?.age || '—'} yrs
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>{patientData.patient?.gender || patientData.profile?.gender || '—'}</span>
                        <span className="text-slate-300">•</span>
                        <span>{patientData.patient?.district || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {patientData.patient?.phone && (
                      <div className="bg-white/60 px-3 py-1.5 rounded-lg text-sm text-slate-700 font-medium">
                        📱 {patientData.patient.phone}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid gap-4 md:grid-cols-3">
              <Button
                onClick={handleAddToMyPatients}
                disabled={isAddingPatient}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg font-semibold shadow-md hover:shadow-lg transition-all"
                size="lg"
              >
                <FiUserPlus className="mr-2 h-5 w-5" />
                {isAddingPatient ? 'Adding...' : t('add_to_my_patients')}
              </Button>

              <Button
                onClick={() => router.push(`/doctor/patients/${patientData.patient?.id}/create-consultation`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold shadow-md hover:shadow-lg transition-all"
                size="lg"
              >
                <FiActivity className="mr-2 h-5 w-5" />
                New Consultation
              </Button>
            </div>

            {/* Critical Alerts & Vitals Row */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Vitals Summary */}
              {patientData.latest_vitals && (
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FiActivity className="text-teal-600" /> {t('current_vitals')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {/* BP */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Blood Pressure</p>
                        {patientData.latest_vitals.blood_pressure ? (
                          <div className="mt-1">
                            <p className="text-xl font-bold text-slate-900">
                              {patientData.latest_vitals.blood_pressure.value} <span className="text-sm font-normal text-slate-400">{patientData.latest_vitals.blood_pressure.unit}</span>
                            </p>
                            {patientData.latest_vitals.blood_pressure.status !== 'normal' && (
                              <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${patientData.latest_vitals.blood_pressure.status === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {patientData.latest_vitals.blood_pressure.status}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic mt-1">Not recorded</p>
                        )}
                      </div>

                      {/* Sugar */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Blood Sugar</p>
                        {patientData.latest_vitals.blood_sugar ? (
                          <div className="mt-1">
                            <p className="text-xl font-bold text-slate-900">
                              {patientData.latest_vitals.blood_sugar.value} <span className="text-sm font-normal text-slate-400">{patientData.latest_vitals.blood_sugar.unit}</span>
                            </p>
                            {patientData.latest_vitals.blood_sugar.status !== 'normal' && (
                              <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${patientData.latest_vitals.blood_sugar.status === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {patientData.latest_vitals.blood_sugar.status}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic mt-1">Not recorded</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Allergies Alert */}
              {patientData.allergies && patientData.allergies.length > 0 && (
                <Card className="border-0 shadow-lg bg-rose-50/50 backdrop-blur-md border-rose-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-rose-700">
                      <FiAlertTriangle className="h-5 w-5" /> {t('allergies_title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {patientData.allergies.map((allergy: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 bg-white/60 p-2 rounded-lg border border-rose-100/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                          <p className="text-sm text-rose-800 font-medium">
                            {allergy.allergen} — <span className="text-rose-600">{allergy.reaction_type}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Chronic Conditions */}
              {patientData.chronic_conditions && patientData.chronic_conditions.length > 0 && (
                <Card className="border-0 shadow-lg bg-amber-50/50 backdrop-blur-md border-amber-100 md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                      <FiAlertCircle className="h-5 w-5" /> {t('chronic_conditions')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {patientData.chronic_conditions.map((condition: any, idx: number) => (
                        <span key={idx} className="px-3 py-1.5 bg-white/80 text-amber-800 text-sm font-semibold rounded-full border border-amber-200 shadow-sm">
                          {condition.disease_name || condition.condition_name}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Medical Records - Prominent Display */}
            <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-md">
              <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400"></div>
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">📋</span> {t('medical_records_history')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 bg-slate-50/30">
                {/* Visit Records (New Model - More Detailed) */}
                {patientData.visit_records && patientData.visit_records.length > 0 ? (
                  <div className="space-y-6">
                    {patientData.visit_records.map((record: any) => (
                      <div key={record.id} className="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-200 hover:before:bg-blue-500 before:transition-colors bg-white p-6 rounded-r-xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                          <div>
                            <p className="font-bold text-lg text-slate-800">Dr. {record.doctor_name}</p>
                            <p className="text-sm text-slate-500 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded mt-1">{record.department}</p>
                          </div>
                          <p className="text-sm text-slate-400 font-medium">
                            {new Date(record.visit_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                            <p className="text-xs font-bold text-blue-600 uppercase mb-1 tracking-wider">{t('diagnosis')}</p>
                            <p className="text-sm text-slate-800 font-medium leading-relaxed">{record.diagnosis}</p>
                          </div>

                          {record.tests_performed && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">{t('tests_performed')}</p>
                              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{record.tests_performed}</p>
                            </div>
                          )}

                          {record.prescription && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">{t('prescription')}</p>
                              <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 text-xs">
                                {record.prescription.split(',').map((item: string, i: number) => {
                                  const trimmed = item.trim().replace(/\.+$/, '');
                                  return trimmed ? <li key={i}>{trimmed}</li> : null;
                                })}
                              </ul>
                            </div>
                          )}

                          {record.doctor_notes && (
                            <div className="bg-amber-50/50 border-l-2 border-amber-300 pl-3 py-2">
                              <p className="text-xs font-bold text-amber-700 uppercase mb-1 tracking-wider">{t('doctor_notes')}</p>
                              <p className="text-sm text-amber-900 italic">"{record.doctor_notes}"</p>
                            </div>
                          )}

                          {record.report_attachments && record.report_attachments.length > 0 && (
                            <div className="pt-2">
                              <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">📎 {t('attached_reports')}</p>
                              <div className="flex flex-wrap gap-2">
                                {record.report_attachments.map((attachment: any) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 border border-transparent transition-all flex items-center gap-1.5 font-medium"
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
                  <div className="space-y-6">
                    {patientData.medical_records.map((record: any) => (
                      <div key={record.id} className="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-slate-300 hover:before:bg-slate-500 before:transition-colors bg-white p-6 rounded-r-xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm text-slate-400 font-medium mb-1">
                              {new Date(record.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            {record.doctor && (
                              <p className="text-sm text-slate-700 font-semibold">
                                Consulted: {record.doctor.first_name} {record.doctor.last_name}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 mt-4">
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Symptoms</p>
                            <p className="text-sm text-slate-800">{record.symptoms || 'No symptoms recorded'}</p>
                          </div>

                          {record.diagnoses && record.diagnoses.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Diagnosis</p>
                              <div className="space-y-1">
                                {record.diagnoses.map((d: any, idx: number) => (
                                  <p key={idx} className="text-sm text-indigo-700 font-medium bg-indigo-50 inline-block px-2 py-0.5 rounded mr-2">
                                    {d.disease_name} <span className="text-indigo-400">({d.icd_10_code})</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {record.notes && (
                            <div className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-2">
                              {record.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <p>{t('empty_records') || 'No medical records available'}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Prescriptions */}
            {patientData.prescriptions && patientData.prescriptions.length > 0 && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-slate-800 flex items-center gap-2">
                    💊 {t('recent_prescriptions')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patientData.prescriptions.slice(0, 5).map((rx: any) => (
                      <div key={rx.id} className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors">
                        <p className="text-sm font-mono font-medium text-slate-700">{rx.prescription_number}</p>
                        <p className="text-xs text-slate-500">
                          {t('issued')}: {new Date(rx.issued_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(ScanQRPage, ['doctor']);
