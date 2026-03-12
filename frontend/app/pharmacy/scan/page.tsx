'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { withAuth } from '@/components/auth/withAuth';
import { QRScanner } from '@/components/pharmacy/QRScanner';
import { FiCamera, FiX, FiSearch, FiUser, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

function ScanPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [cameraError, setCameraError] = useState('');

    // Handle decoded QR data — could be a JWT token (patient health card) or prescription_id|hash or patient ID
    const processQRData = async (data: string) => {
        if (loading) return;
        setLoading(true);
        setCameraError('');

        try {
            const trimmed = data.trim();

            // Determine type of input
            const isJWT = trimmed.split('.').length === 3; // JWT tokens have exactly 3 dot-separated parts
            const isPrescriptionQR = trimmed.includes('|');

            if (isPrescriptionQR) {
                // prescription_id|hash format
                const response = await api.pharmacy.scanPrescription(trimmed) as any;
                const prescriptionId = response?.prescription?.id;
                if (prescriptionId) {
                    toast.success('Prescription scanned successfully');
                    router.push(`/pharmacy/dispense/${prescriptionId}`);
                    return;
                }
            }

            // For JWT tokens, use scanPatient with token
            // For anything else (HS-IDs, UUIDs, etc.), use scanPatient with patient_id
            const payload: { token?: string; patient_id?: string } = {};
            if (isJWT) {
                payload.token = trimmed;
            } else {
                payload.patient_id = trimmed;
            }

            const response = await api.pharmacy.scanPatient(payload) as any;
            if (response?.patient?.id) {
                toast.success(`Patient found: ${response.patient.name}`);
                sessionStorage.setItem('pharmacy_scan_result', JSON.stringify(response));
                router.push(`/pharmacy/dispense/patient`);
                return;
            }

            toast.error('Could not identify the scanned code');
        } catch (error: any) {
            console.error('Scan failed:', error);
            const detail = error?.response?.data?.detail;
            const msg = typeof detail === 'string' ? detail : 'Patient not found. Please check the ID and try again.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualInput.trim()) {
            processQRData(manualInput.trim());
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                    Scan Patient QR Code
                </h1>

                {/* QR Scanner Area */}
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
                    {isScanning ? (
                        <div className="mb-6">
                            <QRScanner
                                isActive={isScanning}
                                onScan={(data) => {
                                    setIsScanning(false);
                                    processQRData(data);
                                }}
                                onError={(err) => {
                                    setCameraError(err);
                                    setIsScanning(false);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-64 h-64 bg-gray-100 rounded-xl mx-auto mb-6 flex items-center justify-center border-2 border-dashed border-gray-300">
                            {loading ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500" />
                                    <p className="text-sm text-gray-500">Looking up patient...</p>
                                </div>
                            ) : (
                                <FiCamera className="w-16 h-16 text-gray-400" />
                            )}
                        </div>
                    )}

                    {cameraError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                            <FiAlertCircle /> {cameraError}
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setCameraError('');
                            setIsScanning(!isScanning);
                        }}
                        disabled={loading}
                        className={`px-6 py-3 rounded-xl font-medium transition-colors ${isScanning
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-teal-600 text-white hover:bg-teal-700'
                            } disabled:opacity-50`}
                    >
                        {isScanning ? (
                            <span className="flex items-center gap-2"><FiX /> Stop Scanning</span>
                        ) : (
                            <span className="flex items-center gap-2"><FiCamera /> Start Camera</span>
                        )}
                    </button>
                </div>

                {/* Manual Input */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FiUser className="text-teal-600" /> Manual Lookup
                    </h2>
                    <form onSubmit={handleManualSubmit} className="flex gap-4">
                        <input
                            type="text"
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            placeholder="Enter Patient ID (e.g. HS-2025-000001)..."
                            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading || !manualInput.trim()}
                            className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <FiSearch />
                            )}
                            Lookup
                        </button>
                    </form>
                    <p className="text-xs text-gray-400 mt-2">
                        You can also paste a prescription QR code value (prescription_id|hash) here.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default withAuth(ScanPage, ['pharmacist']);
