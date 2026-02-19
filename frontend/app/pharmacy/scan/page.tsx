'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { withAuth } from '@/components/auth/withAuth';
import { FiCamera, FiX, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';

function ScanPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [qrInput, setQrInput] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    const handleScan = async (data: string) => {
        setLoading(true);
        try {
            const response = await api.pharmacy.scanPrescription(data) as any;
            // Assuming response contains prescription details or ID
            // If the backend returns just ID:
            const prescriptionId = response.prescription?.id || response.id;

            if (prescriptionId) {
                toast.success('Prescription scanned successfully');
                router.push(`/pharmacy/dispense/${prescriptionId}`);
            } else {
                toast.error('Could not retrieve prescription ID');
            }
        } catch (error) {
            console.error('Scan failed:', error);
            toast.error('Invalid or expired prescription');
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (qrInput.trim()) {
            handleScan(qrInput);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">Scan Prescription</h1>

                {/* Scanner Simulation Area */}
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
                    <div className="w-64 h-64 bg-gray-100 rounded-xl mx-auto mb-6 flex items-center justify-center border-2 border-dashed border-gray-300 relative overflow-hidden">
                        {isScanning ? (
                            <div className="absolute inset-0 bg-black/5 flex flex-col items-center justify-center">
                                <div className="w-full h-1 bg-red-500 absolute top-1/2 animate-scan" />
                                <p className="mt-4 text-sm text-gray-600">Simulating Camera...</p>
                            </div>
                        ) : (
                            <FiCamera className="w-16 h-16 text-gray-400" />
                        )}
                    </div>

                    <button
                        onClick={() => setIsScanning(!isScanning)}
                        className={`px-6 py-3 rounded-xl font-medium transition-colors ${isScanning
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                    >
                        {isScanning ? 'Stop Scanning' : 'Start Camera'}
                    </button>
                </div>

                {/* Manual Input */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Entry</h2>
                    <form onSubmit={handleManualSubmit} className="flex gap-4">
                        <input
                            type="text"
                            value={qrInput}
                            onChange={(e) => setQrInput(e.target.value)}
                            placeholder="Enter prescription ID or hash..."
                            className="flex-1 rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <button
                            type="submit"
                            disabled={loading || !qrInput}
                            className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <FiSearch />}
                            Verify
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default withAuth(ScanPage, ['pharmacist']);
