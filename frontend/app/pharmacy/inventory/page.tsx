'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { withAuth } from '@/components/auth/withAuth';
import { AddInventoryModal } from '@/components/pharmacy/AddInventoryModal';
import { FiPlus, FiAlertCircle, FiSearch, FiEdit2, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

// Types (should be in types/index.ts eventually, adding here for now)
interface InventoryItem {
    id: string;
    medicine: string;
    medicine_name: string;
    medicine_generic: string;
    quantity_in_stock: number;
    low_stock_threshold: number;
    unit_price: string;
    batch_number: string;
    expiry_date: string;
    updated_at: string;
}

function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showLowStock, setShowLowStock] = useState(false);

    // Fetch Inventory
    const fetchInventory = async () => {
        setLoading(true);
        try {
            const data = await api.pharmacy.getInventory({ low_stock: showLowStock });
            setItems(data as unknown as InventoryItem[]); // Type assertion for now until types are fully updated
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
            toast.error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, [showLowStock]);

    // Filter items
    const filteredItems = items.filter(item =>
        item.medicine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.batch_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition"
                    >
                        <FiPlus /> Add Medicine
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-96">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search medicine name or batch..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showLowStock}
                                onChange={(e) => setShowLowStock(e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">Show Low Stock Only</span>
                        </label>

                        <button
                            onClick={fetchInventory}
                            className="p-2 text-gray-500 hover:text-purple-600 transition rounded-full hover:bg-purple-50"
                            title="Refresh"
                        >
                            <FiRefreshCw className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {/* Inventory Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">Medicine Name</th>
                                    <th className="px-6 py-4">Batch No.</th>
                                    <th className="px-6 py-4">Stock</th>
                                    <th className="px-6 py-4">Unit Price</th>
                                    <th className="px-6 py-4">Expiry</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center">
                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                                        </td>
                                    </tr>
                                ) : filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            No items found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{item.medicine_name}</div>
                                                <div className="text-xs text-gray-500">{item.medicine_generic}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs">{item.batch_number || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <div className={`flex items-center gap-2 ${item.quantity_in_stock <= item.low_stock_threshold ? 'text-red-600 font-medium' : 'text-gray-700'
                                                    }`}>
                                                    {item.quantity_in_stock}
                                                    {item.quantity_in_stock <= item.low_stock_threshold && (
                                                        <FiAlertCircle className="w-4 h-4" title="Low Stock" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">₹{item.unit_price}</td>
                                            <td className="px-6 py-4">{item.expiry_date || 'N/A'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                                        <FiEdit2 />
                                                    </button>
                                                    {/* <button className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete">
                            <FiTrash2 />
                          </button> */}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Modal */}
            <AddInventoryModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={fetchInventory}
            />
        </div>
    );
}

export default withAuth(InventoryPage, ['pharmacist']);
