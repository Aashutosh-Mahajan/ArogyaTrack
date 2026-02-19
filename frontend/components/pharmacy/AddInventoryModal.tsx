'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { FiX, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface AddInventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AddInventoryModal({ isOpen, onClose, onSuccess }: AddInventoryModalProps) {
    const [loading, setLoading] = useState(false);
    const [medicines, setMedicines] = useState<any[]>([]); // Should use Medicine type
    const [formData, setFormData] = useState({
        medicine_id: '',
        quantity_in_stock: 0,
        low_stock_threshold: 10,
        unit_price: '',
        batch_number: '',
        expiry_date: '',
    });

    // Fetch available medicines for selection
    useEffect(() => {
        if (isOpen) {
            // Assuming we have an endpoint to list medicines. If not, we might need to add one or use an existing one.
            // For now, let's mock it or assume api.medicines.list() exists
            // api.medicines.list().then(res => setMedicines(res.data));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.pharmacy.addInventory({
                medicine: formData.medicine_id,
                quantity_in_stock: formData.quantity_in_stock,
                low_stock_threshold: formData.low_stock_threshold,
                unit_price: formData.unit_price,
                batch_number: formData.batch_number,
                expiry_date: formData.expiry_date,
            });
            toast.success('Inventory added successfully');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to add inventory:', error);
            toast.error('Failed to add inventory');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Add New Stock</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Medicine</label>
                        <input
                            type="text"
                            placeholder="Search medicine (ID for now)"
                            className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                            value={formData.medicine_id}
                            onChange={(e) => setFormData({ ...formData, medicine_id: e.target.value })}
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter Medicine UUID (Temporary until search is improved)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                                type="number"
                                min="0"
                                className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                                value={formData.quantity_in_stock}
                                onChange={(e) => setFormData({ ...formData, quantity_in_stock: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Limit</label>
                            <input
                                type="number"
                                min="0"
                                className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                                value={formData.low_stock_threshold}
                                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                            <input
                                type="text"
                                className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                                value={formData.batch_number}
                                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                            <input
                                type="date"
                                className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                                value={formData.expiry_date}
                                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (₹)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <FiSave />
                            )}
                            Save Inventory
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
