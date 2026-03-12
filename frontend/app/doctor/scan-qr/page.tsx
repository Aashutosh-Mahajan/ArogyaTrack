'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { FiCamera, FiX, FiUser, FiActivity, FiAlertTriangle, FiAlertCircle, FiUserPlus, FiSearch } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';

function ScanQRPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [manualPatientId, setManualPatientId] = useState('');
  const [patientData, setPatientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const scannedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'scanner' | 'manual'>('scanner');

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
      scannedRef.current = false;

      await new Promise(resolve => requestAnimationFrame(resolve));

      const element = document.getElementById("qr-reader");
      if (!element) {
        throw new Error("Scanner element not found. Please try again.");
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      const config = {
        fps: 30,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          handleScan(decodedText);
          stopScanning();
        },
        () => { }
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
      <div className="max-w-5xl mx-auto space-y-8 pb-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-dark tracking-tight font-display">
            {t('scan_qr_title')}
          </h1>
          <p className="text-text-muted mt-1">
            {t('scan_qr_subtitle')}
          </p>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-medium text-text-dark">Fetching patient records...</p>
            </div>
          </div>
        )}

        {!patientData && (
          <Card className="border-0 shadow-xl overflow-hidden bg-white/90 backdrop-blur-md">
            <div className="h-1.5 bg-gradient-to-r from-primary to-teal-400"></div>

            {/* Tab Switcher */}
            <div className="flex border-b border-border-light">
              <button
                onClick={() => { setActiveTab('scanner'); if (isScanning) stopScanning(); }}
                className={`flex-1 flex items-center justify-center gap-2.5 py-4 px-6 text-sm font-semibold transition-all relative ${
                  activeTab === 'scanner'
                    ? 'text-primary'
                    : 'text-text-muted hover:text-text-dark hover:bg-light-bg/50'
                }`}
              >
                <FiCamera className="w-4.5 h-4.5" />
                {t('camera_scanner')}
                {activeTab === 'scanner' && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('manual'); if (isScanning) stopScanning(); }}
                className={`flex-1 flex items-center justify-center gap-2.5 py-4 px-6 text-sm font-semibold transition-all relative ${
                  activeTab === 'manual'
                    ? 'text-primary'
                    : 'text-text-muted hover:text-text-dark hover:bg-light-bg/50'
                }`}
              >
                <FiSearch className="w-4.5 h-4.5" />
                {t('manual_entry')}
                {activeTab === 'manual' && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            </div>

            <CardContent className="p-6 md:p-8">
              {/* QR Scanner Tab */}
              {activeTab === 'scanner' && (
                <div className="max-w-md mx-auto">
                  {/* Camera Error */}
                  {cameraError && !isScanning && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <FiAlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">{t('camera_access_error')}</p>
                          <p className="text-sm text-red-600 mt-1">{cameraError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isScanning ? (
                    <div className="text-center py-10 space-y-6">
                      <div className="relative w-32 h-32 mx-auto">
                        {/* Decorative corner brackets */}
                        <div className="absolute inset-0">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-primary/40 rounded-tl-lg" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-primary/40 rounded-tr-lg" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-primary/40 rounded-bl-lg" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-primary/40 rounded-br-lg" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-20 h-20 bg-light-bg rounded-2xl flex items-center justify-center">
                            <FiCamera className="w-9 h-9 text-primary/60" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-text-dark font-semibold">Ready to Scan</p>
                        <p className="text-text-muted text-sm">Position the patient's health card QR code in front of your camera</p>
                      </div>
                      <Button
                        onClick={startScanning}
                        size="lg"
                        className="bg-primary hover:bg-primary-dark text-white rounded-full px-10 shadow-lg hover:shadow-xl transition-all gap-2"
                      >
                        <FiCamera className="w-5 h-5" />
                        {t('start_camera')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {!isCameraReady && (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl text-center">
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm text-primary font-medium">Initializing camera...</p>
                          </div>
                        </div>
                      )}
                      <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl aspect-square">
                        <div id="qr-reader" className="w-full h-full"></div>
                        {isCameraReady && (
                          <>
                            <div className="absolute inset-0 pointer-events-none">
                              {/* Scan line animation */}
                              <div className="absolute left-[15%] right-[15%] top-[15%] h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                            </div>
                            {/* Corner markers */}
                            <div className="absolute inset-[15%] pointer-events-none">
                              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-md" />
                              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-md" />
                              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-md" />
                              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-md" />
                            </div>
                          </>
                        )}
                      </div>
                      {isCameraReady && (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                          </span>
                          <p className="text-sm font-medium">{t('camera_active')}</p>
                        </div>
                      )}
                      <Button
                        onClick={stopScanning}
                        variant="outline"
                        className="w-full rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                      >
                        <FiX className="mr-2 h-4 w-4" />
                        {t('stop_scanner')}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Entry Tab */}
              {activeTab === 'manual' && (
                <div className="max-w-md mx-auto py-6 space-y-8">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-light-bg rounded-2xl flex items-center justify-center mb-4">
                      <FiSearch className="w-7 h-7 text-primary/60" />
                    </div>
                    <p className="text-text-dark font-semibold">Find Patient by ID</p>
                    <p className="text-text-muted text-sm">Enter the Universal Patient ID printed on their health card</p>
                  </div>

                  <form onSubmit={handlePatientIdSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-text-dark block mb-2">
                        {t('universal_patient_id')}
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <Input
                          type="text"
                          placeholder="e.g. HS-202X-XXXXX"
                          value={manualPatientId}
                          onChange={(e) => setManualPatientId(e.target.value.toUpperCase())}
                          className="pl-11 font-mono text-sm uppercase h-14 rounded-2xl border-border-light focus:border-primary bg-light-bg/50 focus:bg-white"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={!manualPatientId.trim() || isLoading}
                      className="w-full bg-primary hover:bg-primary-dark text-white h-12 rounded-full text-sm font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                      <FiSearch className="mr-2 h-4 w-4" />
                      {isLoading ? 'Searching...' : t('find_patient')}
                    </Button>
                  </form>

                  <div className="bg-light-bg/60 rounded-2xl p-4 border border-border-light">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiAlertCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-dark">Where to find the Patient ID?</p>
                        <p className="text-xs text-text-muted mt-1">
                          The Universal Patient ID is printed on the patient's health card, starting with "HS-"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Patient Data Display */}
        {patientData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Action Bar */}
            <div className="flex justify-end gap-3 print:hidden">
              <Button
                onClick={() => setPatientData(null)}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-full"
              >
                <FiX className="mr-2 h-4 w-4" /> {t('clear_patient_data')}
              </Button>
              <Button
                onClick={() => { setPatientData(null); setActiveTab('scanner'); setTimeout(startScanning, 100); }}
                className="bg-primary hover:bg-primary-dark text-white rounded-full"
              >
                <FiCamera className="mr-2 h-4 w-4" /> {t('scan_another')}
              </Button>
            </div>

            {/* Patient Info Card */}
            <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-teal-50 to-primary/5">
              <div className="h-1.5 bg-gradient-to-r from-primary to-teal-400"></div>
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    {patientData.patient?.profile_photo_url ? (
                      <img
                        src={patientData.patient.profile_photo_url}
                        alt="Patient"
                        className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shadow-lg border-4 border-white">
                        {patientData.patient?.name?.charAt(0) || 'P'}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold text-text-dark font-display">
                          {patientData.patient?.name || `${patientData.profile?.user?.first_name || ''} ${patientData.profile?.user?.last_name || ''}`}
                        </h2>
                        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-xs font-mono text-primary font-semibold border border-primary/20">
                          {patientData.patient?.unique_patient_id || 'ID N/A'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                        <span className="flex items-center gap-1.5 font-semibold text-red-500">
                          <FiActivity className="h-4 w-4" />
                          {patientData.patient?.blood_group || patientData.profile?.blood_group || 'N/A'}
                        </span>
                        <span className="text-border-light">|</span>
                        <span>{patientData.patient?.age || '—'} yrs</span>
                        <span className="text-border-light">|</span>
                        <span>{patientData.patient?.gender || patientData.profile?.gender || '—'}</span>
                        <span className="text-border-light">|</span>
                        <span>{patientData.patient?.district || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  {patientData.patient?.phone && (
                    <div className="bg-white/80 px-4 py-2.5 rounded-2xl text-sm text-text-dark font-medium border border-border-light shadow-sm">
                      📱 {patientData.patient.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid gap-4 md:grid-cols-3">
              <Button
                onClick={handleAddToMyPatients}
                disabled={isAddingPatient}
                className="w-full bg-primary hover:bg-primary-dark text-white py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all rounded-2xl"
                size="lg"
              >
                <FiUserPlus className="mr-2 h-5 w-5" />
                {isAddingPatient ? 'Adding...' : t('add_to_my_patients')}
              </Button>

              <Button
                onClick={() => router.push(`/doctor/patients/${patientData.patient?.id}/create-prescription`)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all rounded-2xl"
                size="lg"
              >
                💊 Create Prescription
              </Button>

              <Button
                onClick={() => router.push(`/doctor/patients/${patientData.patient?.id}/create-record`)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all rounded-2xl"
                size="lg"
              >
                <FiActivity className="mr-2 h-5 w-5" />
                {t('create_visit_record')}
              </Button>
            </div>

            {/* Vitals & Alerts */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Vitals Summary */}
              {patientData.latest_vitals && (
                <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-primary to-teal-400"></div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-text-dark">
                      <FiActivity className="text-primary" /> {t('current_vitals')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-light-bg p-4 rounded-2xl border border-border-light">
                        <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Blood Pressure</p>
                        {patientData.latest_vitals.blood_pressure ? (
                          <div className="mt-1.5">
                            <p className="text-xl font-bold text-text-dark">
                              {patientData.latest_vitals.blood_pressure.value} <span className="text-sm font-normal text-text-muted">{patientData.latest_vitals.blood_pressure.unit}</span>
                            </p>
                            {patientData.latest_vitals.blood_pressure.status !== 'normal' && (
                              <span className={`inline-block mt-1.5 px-2.5 py-0.5 text-[10px] rounded-full font-bold uppercase ${patientData.latest_vitals.blood_pressure.status === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {patientData.latest_vitals.blood_pressure.status}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-text-muted italic mt-1">Not recorded</p>
                        )}
                      </div>

                      <div className="bg-light-bg p-4 rounded-2xl border border-border-light">
                        <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Blood Sugar</p>
                        {patientData.latest_vitals.blood_sugar ? (
                          <div className="mt-1.5">
                            <p className="text-xl font-bold text-text-dark">
                              {patientData.latest_vitals.blood_sugar.value} <span className="text-sm font-normal text-text-muted">{patientData.latest_vitals.blood_sugar.unit}</span>
                            </p>
                            {patientData.latest_vitals.blood_sugar.status !== 'normal' && (
                              <span className={`inline-block mt-1.5 px-2.5 py-0.5 text-[10px] rounded-full font-bold uppercase ${patientData.latest_vitals.blood_sugar.status === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {patientData.latest_vitals.blood_sugar.status}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-text-muted italic mt-1">Not recorded</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Allergies Alert */}
              {patientData.allergies && patientData.allergies.length > 0 && (
                <Card className="border-0 shadow-lg bg-red-50/50 backdrop-blur-md border-red-100 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-red-400 to-orange-400"></div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                      <FiAlertTriangle className="h-5 w-5" /> {t('allergies_title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {patientData.allergies.map((allergy: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 bg-white/70 p-3 rounded-xl border border-red-100/50">
                          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                          <p className="text-sm text-red-800 font-medium">
                            {allergy.allergen} <span className="text-red-500 font-normal">— {allergy.reaction_type}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Chronic Conditions */}
              {patientData.chronic_conditions && patientData.chronic_conditions.length > 0 && (
                <Card className="border-0 shadow-lg bg-amber-50/50 backdrop-blur-md border-amber-100 md:col-span-2 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-400"></div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                      <FiAlertCircle className="h-5 w-5" /> {t('chronic_conditions')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {patientData.chronic_conditions.map((condition: any, idx: number) => (
                        <span key={idx} className="px-3.5 py-2 bg-white/80 text-amber-800 text-sm font-semibold rounded-full border border-amber-200 shadow-sm">
                          {condition.disease_name || condition.condition_name}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Medical Records */}
            <Card className="border-0 shadow-xl overflow-hidden bg-white/90 backdrop-blur-md">
              <div className="h-1.5 bg-gradient-to-r from-primary to-teal-400"></div>
              <CardHeader className="border-b border-border-light">
                <CardTitle className="text-text-dark flex items-center gap-2">
                  <span className="text-2xl">📋</span> {t('medical_records_history')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 bg-light-bg/30">
                {/* Visit Records */}
                {patientData.visit_records && patientData.visit_records.length > 0 ? (
                  <div className="space-y-5">
                    {patientData.visit_records.map((record: any) => (
                      <div key={record.id} className="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary/20 hover:before:bg-primary before:transition-colors before:rounded-full bg-white p-6 rounded-2xl shadow-sm border border-border-light hover:shadow-md transition-all">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                          <div>
                            <p className="font-bold text-lg text-text-dark">Dr. {record.doctor_name}</p>
                            <p className="text-sm text-text-muted font-medium bg-light-bg inline-block px-2.5 py-0.5 rounded-lg mt-1">{record.department}</p>
                          </div>
                          <p className="text-sm text-text-muted font-medium">
                            {new Date(record.visit_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                            <p className="text-xs font-bold text-primary uppercase mb-1 tracking-wider">{t('diagnosis')}</p>
                            <p className="text-sm text-text-dark font-medium leading-relaxed">{record.diagnosis}</p>
                          </div>

                          {record.tests_performed && (
                            <div>
                              <p className="text-xs font-bold text-text-muted uppercase mb-1 tracking-wider">{t('tests_performed')}</p>
                              <p className="text-sm text-text-dark whitespace-pre-line leading-relaxed">{record.tests_performed}</p>
                            </div>
                          )}

                          {record.prescription && (
                            <div className="bg-light-bg p-3 rounded-xl border border-border-light">
                              <p className="text-xs font-bold text-text-muted uppercase mb-1 tracking-wider">{t('prescription')}</p>
                              <ul className="list-disc list-inside space-y-1 text-sm text-text-dark text-xs">
                                {record.prescription.split(',').map((item: string, i: number) => {
                                  const trimmed = item.trim().replace(/\.+$/, '');
                                  return trimmed ? <li key={i}>{trimmed}</li> : null;
                                })}
                              </ul>
                            </div>
                          )}

                          {record.doctor_notes && (
                            <div className="bg-amber-50/50 border-l-2 border-amber-300 pl-3 py-2 rounded-r-xl">
                              <p className="text-xs font-bold text-amber-700 uppercase mb-1 tracking-wider">{t('doctor_notes')}</p>
                              <p className="text-sm text-amber-900 italic">"{record.doctor_notes}"</p>
                            </div>
                          )}

                          {record.report_attachments && record.report_attachments.length > 0 && (
                            <div className="pt-2">
                              <p className="text-xs font-bold text-text-muted uppercase mb-2 tracking-wider">📎 {t('attached_reports')}</p>
                              <div className="flex flex-wrap gap-2">
                                {record.report_attachments.map((attachment: any) => (
                                  <button
                                    key={attachment.id}
                                    onClick={async () => {
                                      try {
                                        const blob = await api.medical.downloadReport(attachment.id, 'inline');
                                        const url = window.URL.createObjectURL(blob);
                                        window.open(url, '_blank');
                                        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                                      } catch { /* silent */ }
                                    }}
                                    className="text-xs bg-light-bg text-text-muted px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary border border-border-light hover:border-primary/30 transition-all flex items-center gap-1.5 font-medium cursor-pointer"
                                  >
                                    📄 {attachment.file_name}
                                  </button>
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
                  <div className="space-y-5">
                    {patientData.medical_records.map((record: any) => (
                      <div key={record.id} className="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary/20 hover:before:bg-primary before:transition-colors before:rounded-full bg-white p-6 rounded-2xl shadow-sm border border-border-light hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm text-text-muted font-medium mb-1">
                              {new Date(record.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            {record.doctor && (
                              <p className="text-sm text-text-dark font-semibold">
                                Consulted: {record.doctor.first_name} {record.doctor.last_name}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 mt-4">
                          <div>
                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5">Symptoms</p>
                            <p className="text-sm text-text-dark">{record.symptoms || 'No symptoms recorded'}</p>
                          </div>

                          {record.diagnoses && record.diagnoses.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5">Diagnosis</p>
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
                            <div className="text-sm text-text-muted italic border-l-2 border-primary/30 pl-3 rounded-r">
                              {record.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-text-muted">
                    <p>{t('empty_records') || 'No medical records available'}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Prescriptions */}
            {patientData.prescriptions && patientData.prescriptions.length > 0 && (
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400"></div>
                <CardHeader>
                  <CardTitle className="text-text-dark flex items-center gap-2">
                    💊 {t('recent_prescriptions')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patientData.prescriptions.slice(0, 5).map((rx: any) => (
                      <div key={rx.id} className="flex justify-between items-center py-3 px-4 bg-light-bg rounded-xl border border-border-light hover:border-primary/30 transition-colors">
                        <p className="text-sm font-mono font-medium text-text-dark">{rx.prescription_number}</p>
                        <p className="text-xs text-text-muted">
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
