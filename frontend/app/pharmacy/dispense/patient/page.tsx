'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { withAuth } from '@/components/auth/withAuth';
import {
    FiCheck,
    FiX,
    FiAlertTriangle,
    FiPackage,
    FiUser,
    FiChevronDown,
    FiChevronUp,
    FiArrowLeft,
    FiShoppingCart,
    FiPlus,
    FiMinus,
    FiTrash2,
    FiLoader,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

interface Medicine {
    id: string;
    medicine: string;
    medicine_name: string;
    medicine_generic?: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    quantity: number;
    special_instructions?: string;
    dispense_status: 'pending' | 'dispensed' | 'unavailable' | 'patient_has';
    dispensed_at?: string;
}

interface Prescription {
    id: string;
    patient: string;
    patient_name: string;
    doctor: string;
    doctor_name: string;
    status: string;
    medicines: Medicine[];
    created_at: string;
}

interface DoctorGroup {
    doctor_id: string;
    doctor_name: string;
    prescriptions: Prescription[];
}

interface PatientInfo {
    id: string;
    unique_patient_id: string;
    name: string;
    age: number;
    gender: string;
    blood_group: string;
    profile_photo_url?: string;
}

interface ScanResult {
    patient: PatientInfo;
    doctors: DoctorGroup[];
}

interface CartItem {
    medicineId: string;
    medicineName: string;
    medicineGeneric?: string;
    dosage: string;
    quantity: number;
    prescriptionId: string;
    doctorName: string;
}

function PatientDispensePage() {
    const router = useRouter();
    const [data, setData] = useState<ScanResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
    const [expandedPrescriptions, setExpandedPrescriptions] = useState<Set<string>>(new Set());
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem('pharmacy_scan_result');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as ScanResult;
                setData(parsed);

                const docIds = new Set<string>();
                const rxIds = new Set<string>();
                parsed.doctors.forEach((doc) => {
                    doc.prescriptions.forEach((rx) => {
                        const hasPending = rx.medicines.some(
                            (m) => m.dispense_status === 'pending'
                        );
                        if (hasPending) {
                            docIds.add(doc.doctor_id);
                            rxIds.add(rx.id);
                        }
                    });
                });
                setExpandedDoctors(docIds);
                setExpandedPrescriptions(rxIds);
            } catch {
                toast.error('Invalid scan data');
                router.push('/pharmacy/scan');
            }
        } else {
            toast.error('No scan data found. Please scan again.');
            router.push('/pharmacy/scan');
        }
        setLoading(false);
    }, []);

    const toggleDoctor = (docId: string) => {
        setExpandedDoctors((prev) => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId);
            else next.add(docId);
            return next;
        });
    };

    const togglePrescription = (rxId: string) => {
        setExpandedPrescriptions((prev) => {
            const next = new Set(prev);
            if (next.has(rxId)) next.delete(rxId);
            else next.add(rxId);
            return next;
        });
    };

    // ── Cart helpers ────────────────────────────────────────────
    const isInCart = (medId: string) => cart.some((c) => c.medicineId === medId);

    const addToCart = (med: Medicine, rx: Prescription, docName: string) => {
        if (isInCart(med.id)) return;
        setCart((prev) => [
            ...prev,
            {
                medicineId: med.id,
                medicineName: med.medicine_name,
                medicineGeneric: med.medicine_generic,
                dosage: med.dosage,
                quantity: med.quantity,
                prescriptionId: rx.id,
                doctorName: docName,
            },
        ]);
        toast.success(`${med.medicine_name} added to cart`);
    };

    const removeFromCart = (medId: string) => {
        setCart((prev) => prev.filter((c) => c.medicineId !== medId));
    };

    const addAllPendingToCart = (rx: Prescription, docName: string) => {
        const pending = rx.medicines.filter(
            (m) => m.dispense_status === 'pending' && !isInCart(m.id)
        );
        if (pending.length === 0) {
            toast('All medicines already in cart or processed');
            return;
        }
        setCart((prev) => [
            ...prev,
            ...pending.map((m) => ({
                medicineId: m.id,
                medicineName: m.medicine_name,
                medicineGeneric: m.medicine_generic,
                dosage: m.dosage,
                quantity: m.quantity,
                prescriptionId: rx.id,
                doctorName: docName,
            })),
        ]);
        toast.success(`${pending.length} medicine(s) added to cart`);
    };

    const clearCart = () => setCart([]);

    // ── Dispense single (for unavailable / patient_has) ────────
    const handleMarkStatus = async (
        medicineId: string,
        status: 'unavailable' | 'patient_has'
    ) => {
        setProcessingId(medicineId);
        try {
            await api.pharmacy.dispense({
                prescription_medicine_id: medicineId,
                status,
                quantity_dispensed: 0,
                notes: `Marked as ${status.replace('_', ' ')}`,
            });

            // Remove from cart if it was there
            removeFromCart(medicineId);

            // Update local data
            setData((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    doctors: prev.doctors.map((doc) => ({
                        ...doc,
                        prescriptions: doc.prescriptions.map((rx) => ({
                            ...rx,
                            medicines: rx.medicines.map((med) =>
                                med.id === medicineId
                                    ? { ...med, dispense_status: status }
                                    : med
                            ),
                        })),
                    })),
                };
            });

            const labels: Record<string, string> = {
                unavailable: 'Unavailable',
                patient_has: 'Patient Already Has',
            };
            toast.success(`Marked as ${labels[status]}`);
        } catch (error: any) {
            const msg =
                error?.response?.data?.detail ||
                error?.response?.data?.[0] ||
                'Failed to update';
            toast.error(msg);
        } finally {
            setProcessingId(null);
        }
    };

    // ── Bulk dispense from cart ────────────────────────────────
    const handleDispenseCart = async () => {
        if (cart.length === 0) return;
        setBulkProcessing(true);

        const succeeded: string[] = [];
        const failed: string[] = [];

        for (const item of cart) {
            try {
                await api.pharmacy.dispense({
                    prescription_medicine_id: item.medicineId,
                    status: 'dispensed',
                    quantity_dispensed: 0,
                    notes: 'Dispensed via cart',
                });
                succeeded.push(item.medicineId);
            } catch {
                failed.push(item.medicineName);
            }
        }

        // Update local state for all succeeded
        if (succeeded.length > 0) {
            setData((prev) => {
                if (!prev) return null;
                const set = new Set(succeeded);
                return {
                    ...prev,
                    doctors: prev.doctors.map((doc) => ({
                        ...doc,
                        prescriptions: doc.prescriptions.map((rx) => ({
                            ...rx,
                            medicines: rx.medicines.map((med) =>
                                set.has(med.id)
                                    ? { ...med, dispense_status: 'dispensed' as const }
                                    : med
                            ),
                        })),
                    })),
                };
            });
        }

        // Clear cart of succeeded items
        setCart((prev) => prev.filter((c) => !succeeded.includes(c.medicineId)));

        if (failed.length === 0) {
            toast.success(`${succeeded.length} medicine(s) dispensed successfully`);
        } else {
            toast.error(`${failed.length} medicine(s) failed: ${failed.join(', ')}`);
        }

        setBulkProcessing(false);
    };

    // ── Computed stats ─────────────────────────────────────────
    const stats = useMemo(() => {
        if (!data) return { total: 0, pending: 0, dispensed: 0, unavailable: 0, patientHas: 0 };
        let total = 0, pending = 0, dispensed = 0, unavailable = 0, patientHas = 0;
        data.doctors.forEach((d) =>
            d.prescriptions.forEach((rx) =>
                rx.medicines.forEach((m) => {
                    total++;
                    if (m.dispense_status === 'pending') pending++;
                    else if (m.dispense_status === 'dispensed') dispensed++;
                    else if (m.dispense_status === 'unavailable') unavailable++;
                    else if (m.dispense_status === 'patient_has') patientHas++;
                })
            )
        );
        return { total, pending, dispensed, unavailable, patientHas };
    }, [data]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500" />
            </div>
        );
    }

    if (!data) return null;
    const { patient, doctors } = data;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── Top Navigation ─────────────────────────────── */}
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/pharmacy/scan')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                    >
                        <FiArrowLeft /> Back
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Mini stats */}
                        <div className="hidden md:flex items-center gap-4 text-xs mr-4">
                            <span className="flex items-center gap-1 text-green-600">
                                <FiCheck className="w-3.5 h-3.5" /> {stats.dispensed} dispensed
                            </span>
                            <span className="flex items-center gap-1 text-yellow-600">
                                <FiPackage className="w-3.5 h-3.5" /> {stats.pending} pending
                            </span>
                        </div>

                        {/* Cart toggle */}
                        <button
                            onClick={() => setShowCart(!showCart)}
                            className="relative flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition font-medium text-sm"
                        >
                            <FiShoppingCart className="w-4 h-4" />
                            <span className="hidden sm:inline">Dispense Cart</span>
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
                {/* ── Main Content ───────────────────────────── */}
                <div className={`flex-1 min-w-0 transition-all ${showCart && cart.length > 0 ? 'lg:mr-0' : ''}`}>
                    {/* Patient Info Header */}
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl shadow-xl p-5 text-white mb-6">
                        <div className="flex items-center gap-4">
                            {patient.profile_photo_url ? (
                                <img
                                    src={patient.profile_photo_url}
                                    alt={patient.name}
                                    className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                                    <FiUser className="w-7 h-7" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-bold truncate">{patient.name}</h1>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-teal-100 text-xs">
                                    <span>ID: {patient.unique_patient_id}</span>
                                    <span>Age: {patient.age}</span>
                                    <span>Gender: {patient.gender}</span>
                                    {patient.blood_group && <span>Blood: {patient.blood_group}</span>}
                                </div>
                            </div>
                            <div className="text-right hidden md:block shrink-0">
                                <div className="text-2xl font-bold">{stats.pending}</div>
                                <div className="text-teal-100 text-xs">Pending</div>
                            </div>
                        </div>
                    </div>

                    {/* Summary pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        <span className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                            Total: {stats.total}
                        </span>
                        <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-medium">
                            Dispensed: {stats.dispensed}
                        </span>
                        <span className="text-xs px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                            Pending: {stats.pending}
                        </span>
                        {stats.unavailable > 0 && (
                            <span className="text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-medium">
                                Unavailable: {stats.unavailable}
                            </span>
                        )}
                        {stats.patientHas > 0 && (
                            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                Patient Has: {stats.patientHas}
                            </span>
                        )}
                        {cart.length > 0 && (
                            <span className="text-xs px-3 py-1.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                                In Cart: {cart.length}
                            </span>
                        )}
                    </div>

                    {/* Doctors & Prescriptions */}
                    {doctors.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                            <FiPackage className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-600">No prescriptions found</h2>
                            <p className="text-gray-400 mt-2">This patient has no prescriptions on record.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {doctors.map((doc) => {
                                const docPending = doc.prescriptions.reduce(
                                    (a, rx) => a + rx.medicines.filter((m) => m.dispense_status === 'pending').length,
                                    0
                                );
                                return (
                                    <div key={doc.doctor_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                        {/* Doctor Header */}
                                        <button
                                            onClick={() => toggleDoctor(doc.doctor_id)}
                                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100">
                                                    Dr
                                                </div>
                                                <div className="text-left">
                                                    <h2 className="font-semibold text-gray-900 text-sm">
                                                        Dr. {doc.doctor_name}
                                                    </h2>
                                                    <p className="text-xs text-gray-400">
                                                        {doc.prescriptions.length} prescription{doc.prescriptions.length > 1 ? 's' : ''}
                                                        {docPending > 0 && (
                                                            <span className="text-yellow-600 ml-2">• {docPending} pending</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            {expandedDoctors.has(doc.doctor_id) ? (
                                                <FiChevronUp className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <FiChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>

                                        {/* Prescriptions */}
                                        {expandedDoctors.has(doc.doctor_id) && (
                                            <div className="border-t border-gray-100 divide-y divide-gray-50">
                                                {doc.prescriptions.map((rx) => {
                                                    const rxPendingMeds = rx.medicines.filter((m) => m.dispense_status === 'pending');
                                                    const rxPending = rxPendingMeds.length;
                                                    const isExpanded = expandedPrescriptions.has(rx.id);
                                                    const allInCart = rxPendingMeds.every((m) => isInCart(m.id));

                                                    return (
                                                        <div key={rx.id}>
                                                            {/* Prescription header */}
                                                            <button
                                                                onClick={() => togglePrescription(rx.id)}
                                                                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <FiPackage className="text-teal-500 w-4 h-4 shrink-0" />
                                                                    <span className="font-medium text-gray-800 text-sm">
                                                                        Rx{' '}
                                                                        <span className="font-mono text-gray-400 text-xs">
                                                                            {rx.id.slice(0, 8)}
                                                                        </span>
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {new Date(rx.created_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <StatusBadge status={rx.status} />
                                                                    {rxPending > 0 && (
                                                                        <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                                                                            {rxPending} pending
                                                                        </span>
                                                                    )}
                                                                    {isExpanded ? (
                                                                        <FiChevronUp className="w-3.5 h-3.5 text-gray-400" />
                                                                    ) : (
                                                                        <FiChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                                    )}
                                                                </div>
                                                            </button>

                                                            {/* Medicines */}
                                                            {isExpanded && (
                                                                <div className="px-5 pb-4">
                                                                    {/* Add All to Cart */}
                                                                    {rxPending > 0 && !allInCart && (
                                                                        <div className="flex justify-end mb-3">
                                                                            <button
                                                                                onClick={() => addAllPendingToCart(rx, doc.doctor_name)}
                                                                                className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition font-medium"
                                                                            >
                                                                                <FiPlus className="w-3.5 h-3.5" />
                                                                                Add all to cart ({rxPendingMeds.filter((m) => !isInCart(m.id)).length})
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {/* Table header */}
                                                                    <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                                        <div className="col-span-4">Medicine</div>
                                                                        <div className="col-span-2">Dosage</div>
                                                                        <div className="col-span-2">Frequency</div>
                                                                        <div className="col-span-1">Qty</div>
                                                                        <div className="col-span-3 text-right">Action</div>
                                                                    </div>

                                                                    <div className="divide-y divide-gray-50">
                                                                        {rx.medicines.map((med) => (
                                                                            <MedicineRow
                                                                                key={med.id}
                                                                                med={med}
                                                                                rx={rx}
                                                                                docName={doc.doctor_name}
                                                                                isInCart={isInCart(med.id)}
                                                                                processing={processingId === med.id}
                                                                                disabled={!!processingId || bulkProcessing}
                                                                                onAddToCart={() => addToCart(med, rx, doc.doctor_name)}
                                                                                onRemoveFromCart={() => removeFromCart(med.id)}
                                                                                onMarkUnavailable={() => handleMarkStatus(med.id, 'unavailable')}
                                                                                onMarkPatientHas={() => handleMarkStatus(med.id, 'patient_has')}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Bottom Actions */}
                    <div className="mt-8 flex justify-between items-center pb-6">
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('pharmacy_scan_result');
                                router.push('/pharmacy/scan');
                            }}
                            className="text-sm flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium"
                        >
                            <FiPackage /> Scan Next Patient
                        </button>
                        <button
                            onClick={() => router.push('/pharmacy')}
                            className="text-sm text-gray-400 hover:text-gray-600"
                        >
                            Dashboard
                        </button>
                    </div>
                </div>

                {/* ── Cart Sidebar ───────────────────────────── */}
                {showCart && (
                    <div className="hidden lg:block w-80 shrink-0">
                        <div className="sticky top-16">
                            <CartPanel
                                cart={cart}
                                onRemove={removeFromCart}
                                onClear={clearCart}
                                onDispense={handleDispenseCart}
                                processing={bulkProcessing}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Cart - Bottom Sheet */}
            {showCart && (
                <div className="lg:hidden fixed inset-0 z-40">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <FiShoppingCart className="text-teal-600" />
                                Dispense Cart ({cart.length})
                            </h3>
                            <button onClick={() => setShowCart(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                <FiX />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <CartPanel
                                cart={cart}
                                onRemove={removeFromCart}
                                onClear={clearCart}
                                onDispense={handleDispenseCart}
                                processing={bulkProcessing}
                                compact
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-components ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        partially_dispensed: 'bg-blue-50 text-blue-700 border-blue-200',
        fully_dispensed: 'bg-green-50 text-green-700 border-green-200',
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${styles[status] || styles.pending}`}>
            {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
    );
}

interface MedicineRowProps {
    med: Medicine;
    rx: Prescription;
    docName: string;
    isInCart: boolean;
    processing: boolean;
    disabled: boolean;
    onAddToCart: () => void;
    onRemoveFromCart: () => void;
    onMarkUnavailable: () => void;
    onMarkPatientHas: () => void;
}

function MedicineRow({
    med,
    isInCart,
    processing,
    disabled,
    onAddToCart,
    onRemoveFromCart,
    onMarkUnavailable,
    onMarkPatientHas,
}: MedicineRowProps) {
    const isPending = med.dispense_status === 'pending';

    // Already processed badge
    if (!isPending) {
        const statusConfig: Record<string, { bg: string; icon: JSX.Element; label: string }> = {
            dispensed: {
                bg: 'bg-green-50 border-green-200 text-green-700',
                icon: <FiCheck className="w-3.5 h-3.5" />,
                label: 'Dispensed',
            },
            unavailable: {
                bg: 'bg-red-50 border-red-200 text-red-600',
                icon: <FiX className="w-3.5 h-3.5" />,
                label: 'Unavailable',
            },
            patient_has: {
                bg: 'bg-blue-50 border-blue-200 text-blue-600',
                icon: <FiUser className="w-3.5 h-3.5" />,
                label: 'Patient Has',
            },
        };
        const cfg = statusConfig[med.dispense_status] || statusConfig.dispensed;

        return (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-3 py-3 items-center opacity-60">
                <div className="md:col-span-4">
                    <p className="font-medium text-gray-700 text-sm line-through">{med.medicine_name}</p>
                    {med.medicine_generic && <p className="text-xs text-gray-400">{med.medicine_generic}</p>}
                </div>
                <div className="md:col-span-2 text-xs text-gray-500">{med.dosage}</div>
                <div className="md:col-span-2 text-xs text-gray-500">{med.frequency}</div>
                <div className="md:col-span-1 text-xs text-gray-500">{med.quantity}</div>
                <div className="md:col-span-3 flex justify-end">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg.bg}`}>
                        {cfg.icon} {cfg.label}
                    </span>
                </div>
            </div>
        );
    }

    // Pending medicine row
    return (
        <div className={`grid grid-cols-1 md:grid-cols-12 gap-3 px-3 py-3 items-center rounded-lg transition ${isInCart ? 'bg-teal-50/50 ring-1 ring-teal-200' : 'hover:bg-gray-50'}`}>
            <div className="md:col-span-4">
                <p className="font-semibold text-gray-900 text-sm">{med.medicine_name}</p>
                {med.medicine_generic && <p className="text-xs text-gray-400">{med.medicine_generic}</p>}
                {med.special_instructions && (
                    <p className="text-xs text-orange-500 mt-0.5">⚠ {med.special_instructions}</p>
                )}
            </div>
            <div className="md:col-span-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{med.dosage}</span>
            </div>
            <div className="md:col-span-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{med.frequency}</span>
            </div>
            <div className="md:col-span-1">
                <span className="text-xs font-semibold text-gray-700">{med.quantity}</span>
                <span className="text-xs text-gray-400 ml-0.5">/ {med.duration_days}d</span>
            </div>
            <div className="md:col-span-3 flex items-center justify-end gap-1.5">
                {processing ? (
                    <div className="animate-spin w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full" />
                ) : (
                    <>
                        {/* Add / Remove from Cart */}
                        {isInCart ? (
                            <button
                                onClick={onRemoveFromCart}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
                            >
                                <FiCheck className="w-3.5 h-3.5" /> In Cart
                            </button>
                        ) : (
                            <button
                                onClick={onAddToCart}
                                disabled={disabled}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition disabled:opacity-50"
                            >
                                <FiPlus className="w-3.5 h-3.5" /> Add
                            </button>
                        )}

                        {/* Mark Unavailable */}
                        <button
                            onClick={onMarkUnavailable}
                            disabled={disabled}
                            className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition disabled:opacity-50"
                            title="Not Available"
                        >
                            <FiX className="w-3.5 h-3.5" />
                        </button>

                        {/* Patient Already Has */}
                        <button
                            onClick={onMarkPatientHas}
                            disabled={disabled}
                            className="p-1.5 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition disabled:opacity-50"
                            title="Patient Already Has"
                        >
                            <FiAlertTriangle className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

interface CartPanelProps {
    cart: CartItem[];
    onRemove: (id: string) => void;
    onClear: () => void;
    onDispense: () => void;
    processing: boolean;
    compact?: boolean;
}

function CartPanel({ cart, onRemove, onClear, onDispense, processing, compact }: CartPanelProps) {
    if (cart.length === 0) {
        return (
            <div className={`${compact ? 'p-6' : 'bg-white rounded-xl shadow-sm border border-gray-100 p-6'} text-center`}>
                <FiShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Cart is empty</p>
                <p className="text-xs text-gray-400 mt-1">Add medicines from prescriptions to dispense them.</p>
            </div>
        );
    }

    return (
        <div className={compact ? '' : 'bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden'}>
            {!compact && (
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <FiShoppingCart className="text-teal-600 w-4 h-4" />
                        Dispense Cart
                    </h3>
                    <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                        {cart.length} item{cart.length > 1 ? 's' : ''}
                    </span>
                </div>
            )}

            <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
                {cart.map((item) => (
                    <div key={item.medicineId} className="px-4 py-3 flex items-start gap-3 group hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                            <FiPackage className="w-4 h-4 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.medicineName}</p>
                            <p className="text-xs text-gray-400 truncate">
                                {item.dosage} · Qty: {item.quantity}
                            </p>
                            <p className="text-xs text-gray-400 truncate">Dr. {item.doctorName}</p>
                        </div>
                        <button
                            onClick={() => onRemove(item.medicineId)}
                            className="p-1 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                            title="Remove"
                        >
                            <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-2">
                <button
                    onClick={onDispense}
                    disabled={processing}
                    className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-teal-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                    {processing ? (
                        <>
                            <FiLoader className="w-4 h-4 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <FiCheck className="w-4 h-4" />
                            Dispense All ({cart.length})
                        </>
                    )}
                </button>
                <button
                    onClick={onClear}
                    disabled={processing}
                    className="w-full text-gray-500 py-2 rounded-lg text-xs hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50 font-medium"
                >
                    Clear Cart
                </button>
            </div>
        </div>
    );
}

export default withAuth(PatientDispensePage, ['pharmacist']);
