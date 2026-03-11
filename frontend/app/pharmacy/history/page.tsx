'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { withAuth } from '@/components/auth/withAuth';
import { FiClock, FiCheck, FiX, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface DispensingRecord {
    id: string;
    prescription: string;
    prescription_number?: string; // Ideally backend should provide this
    medicine_name: string;
    pharmacy_name: string;
    pharmacist: string;
    status: 'dispensed' | 'unavailable' | 'patient_has';
    quantity_dispensed: number;
    notes: string;
    dispensed_at: string;
}

function HistoryPage() {
    const [records, setRecords] = useState<DispensingRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await api.pharmacy.getDispensingRecords() as any;
                setRecords(response.data ? response.data : response as unknown as DispensingRecord[]);
            } catch (error) {
                console.error('Failed to fetch history:', error);
                toast.error('Failed to load history');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'dispensed': return 'text-green-600 bg-green-50 border-green-200';
            case 'unavailable': return 'text-red-600 bg-red-50 border-red-200';
            case 'patient_has': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <FiClock className="text-purple-600" />
                    Dispensing History
                </h1>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">Date & Time</th>
                                    <th className="px-6 py-4">Medicine</th>
                                    <th className="px-6 py-4">Quantity</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center">
                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                                        </td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No history records found.
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 text-gray-900">
                                                {new Date(record.dispensed_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {record.medicine_name}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">{record.quantity_dispensed}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                                                    {record.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate" title={record.notes}>
                                                {record.notes || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withAuth(HistoryPage, ['pharmacist']);
