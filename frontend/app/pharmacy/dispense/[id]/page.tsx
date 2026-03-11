'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { withAuth } from '@/components/auth/withAuth';
import { FiCheck, FiX, FiAlertTriangle, FiPackage } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface Prescription {
    id: string;
    patient_name: string;
    doctor_name: string;
    created_at: string;
    status: string;
    medicines: {
        id: string;
        medicine_name: string;
        medicine_generic?: string;
        dosage: string;
        frequency: string;
        duration_days: number;
        quantity: number;
        special_instructions?: string;
        dispense_status: 'pending' | 'dispensed' | 'unavailable' | 'patient_has';
    }[];
}

function DispensePage() {
    const router = useRouter();
    const params = useParams();
    const [prescription, setPrescription] = useState<Prescription | null>(null);
    const [loading, setLoading] = useState(true);
    const [dispensing, setDispensing] = useState<string | null>(null);

    useEffect(() => {
        const fetchPrescription = async () => {
            try {
                const res = await api.prescriptions.getById(params.id as string);
                setPrescription(res as unknown as Prescription);
            } catch (error) {
                console.error('Failed to load prescription:', error);
                toast.error('Failed to load prescription details');
                router.push('/pharmacy/scan');
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchPrescription();
        }
    }, [params.id]);

    const handleDispense = async (medicineId: string, status: 'dispensed' | 'unavailable' | 'patient_has') => {
        setDispensing(medicineId);
        try {
            await api.pharmacy.dispense({
                prescription_medicine_id: medicineId,
                status: status,
                quantity_dispensed: 0, // 0 usually means full prescribed amount in backend logic
                notes: `Marked as ${status}`,
            });

            // Update local state
            setPrescription(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    medicines: prev.medicines.map(med =>
                        med.id === medicineId ? { ...med, dispense_status: status } : med
                    )
                };
            });

            toast.success(`Medicine marked as ${status}`);
        } catch (error) {
            console.error('Dispense failed:', error);
            toast.error('Failed to update status');
        } finally {
            setDispensing(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!prescription) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900">Prescription not found</h2>
                    <button onClick={() => router.push('/pharmacy/scan')} className="mt-4 text-purple-600 hover:underline">
                        Back to Scan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-teal-600 p-6 text-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl font-bold">Prescription</h1>
                                <p className="opacity-90 mt-1">Dr. {prescription.doctor_name} &bull; {new Date(prescription.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                                Patient: {prescription.patient_name}
                            </div>
                        </div>
                    </div>

                    {/* Medicines List */}
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FiPackage className="text-purple-600" />
                            Prescribed Medicines
                        </h2>

                        <div className="space-y-4">
                            {prescription.medicines.map((med) => (
                                <div key={med.id} className="border border-gray-200 rounded-xl p-4 hover:border-teal-100 transition">
                                    <div className="flex flex-col md:flex-row justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 text-lg">{med.medicine_name}</h3>
                                            {med.medicine_generic && (
                                                <p className="text-xs text-gray-400">{med.medicine_generic}</p>
                                            )}
                                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                                                <span className="bg-gray-100 px-2 py-1 rounded">Dosage: {med.dosage}</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded">{med.frequency}</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded">{med.duration_days} days</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded">Qty: {med.quantity}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {med.dispense_status === 'pending' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleDispense(med.id, 'dispensed')}
                                                        disabled={!!dispensing}
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                    >
                                                        {dispensing === med.id ? 'Processing...' : <><FiCheck /> Dispense</>}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDispense(med.id, 'unavailable')}
                                                        disabled={!!dispensing}
                                                        className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200"
                                                        title="Mark Unavailable"
                                                    >
                                                        <FiX />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDispense(med.id, 'patient_has')}
                                                        disabled={!!dispensing}
                                                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                                                        title="Patient Already Has"
                                                    >
                                                        <FiAlertTriangle />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className={`px-4 py-2 rounded-lg font-medium border flex items-center gap-2 ${med.dispense_status === 'dispensed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        med.dispense_status === 'unavailable' ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                    {med.dispense_status === 'dispensed' && <FiCheck />}
                                                    {med.dispense_status.charAt(0).toUpperCase() + med.dispense_status.slice(1).replace('_', ' ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-end">
                        <button
                            onClick={() => router.push('/pharmacy/scan')}
                            className="text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Done / Scan Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withAuth(DispensePage, ['pharmacist']);
