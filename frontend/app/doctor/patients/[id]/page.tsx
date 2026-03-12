'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { MyPatient, MedicalRecord, Allergy, ChronicCondition } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
    FiUser,
    FiCalendar,
    FiActivity,
    FiFileText,
    FiPlus,
    FiClock,
    FiMapPin,
    FiDroplet,
    FiAlertCircle,
    FiTrash2,
    FiX,
    FiHeart,
    FiThermometer,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

/* ─── Add Allergy Modal ─── */
function AddAllergyModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [allergen, setAllergen] = useState('');
    const [reactionType, setReactionType] = useState('');
    const [severity, setSeverity] = useState(1);

    const mutation = useMutation({
        mutationFn: () => api.medical.addPatientAllergy(patientId, {
            allergen: allergen.trim(),
            reaction_type: reactionType.trim(),
            severity,
        }),
        onSuccess: () => {
            toast.success('Allergy added successfully');
            queryClient.invalidateQueries({ queryKey: ['patient-allergies', patientId] });
            onClose();
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.detail || 'Failed to add allergy');
        },
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">Add Allergy</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                        <FiX className="h-5 w-5 text-slate-400" />
                    </button>
                </div>
                <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-5 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">
                            Allergen <span className="text-rose-500">*</span>
                        </label>
                        <Input
                            value={allergen}
                            onChange={e => setAllergen(e.target.value)}
                            placeholder="e.g. Penicillin, Peanuts, Dust"
                            required
                            className="rounded-xl"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">
                            Reaction Type <span className="text-rose-500">*</span>
                        </label>
                        <Input
                            value={reactionType}
                            onChange={e => setReactionType(e.target.value)}
                            placeholder="e.g. Rash, Anaphylaxis, Swelling"
                            required
                            className="rounded-xl"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Severity (1-5)</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setSeverity(v)}
                                    className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${severity === v
                                        ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                                        }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            1 = Mild, 5 = Life-threatening
                        </p>
                    </div>
                    <Button
                        type="submit"
                        disabled={mutation.isPending || !allergen.trim() || !reactionType.trim()}
                        className="w-full h-11 bg-rose-500 hover:bg-rose-600 text-white rounded-xl"
                    >
                        {mutation.isPending ? 'Adding...' : 'Add Allergy'}
                    </Button>
                </form>
            </div>
        </div>
    );
}

/* ─── Add Condition Modal ─── */
function AddConditionModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [diseaseName, setDiseaseName] = useState('');
    const [icdCode, setIcdCode] = useState('');
    const [diagnosedDate, setDiagnosedDate] = useState('');

    const mutation = useMutation({
        mutationFn: () => api.medical.addPatientCondition(patientId, {
            disease_name: diseaseName.trim(),
            icd_10_code: icdCode.trim(),
            diagnosed_date: diagnosedDate || undefined,
            is_active: true,
        }),
        onSuccess: () => {
            toast.success('Condition added successfully');
            queryClient.invalidateQueries({ queryKey: ['patient-conditions', patientId] });
            onClose();
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.icd_10_code?.[0] || err?.response?.data?.detail || 'Failed to add condition';
            toast.error(detail);
        },
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">Add Chronic Condition</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                        <FiX className="h-5 w-5 text-slate-400" />
                    </button>
                </div>
                <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-5 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">
                            Disease Name <span className="text-rose-500">*</span>
                        </label>
                        <Input
                            value={diseaseName}
                            onChange={e => setDiseaseName(e.target.value)}
                            placeholder="e.g. Type 2 Diabetes, Hypertension"
                            required
                            className="rounded-xl"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">
                            ICD-10 Code <span className="text-rose-500">*</span>
                        </label>
                        <Input
                            value={icdCode}
                            onChange={e => setIcdCode(e.target.value.toUpperCase())}
                            placeholder="e.g. E11, I10, E78.5"
                            required
                            className="rounded-xl font-mono"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Format: letter + 2 digits, optional dot + up to 4 chars (e.g. E11, I10, J45.0)
                        </p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Diagnosed Date</label>
                        <Input
                            type="date"
                            value={diagnosedDate}
                            onChange={e => setDiagnosedDate(e.target.value)}
                            className="rounded-xl"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={mutation.isPending || !diseaseName.trim() || !icdCode.trim()}
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                    >
                        {mutation.isPending ? 'Adding...' : 'Add Condition'}
                    </Button>
                </form>
            </div>
        </div>
    );
}

/* ─── Severity Badge ─── */
function SeverityBadge({ severity }: { severity: number | string }) {
    const level = typeof severity === 'string' ? parseInt(severity) || 1 : severity;
    const config = level >= 4
        ? { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', label: 'Severe' }
        : level >= 3
            ? { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Moderate' }
            : { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', label: 'Mild' };

    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
            {config.label}
        </span>
    );
}

/* ─── MAIN PAGE ─── */
function PatientDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const patientId = params.id as string;

    const [showAllergyModal, setShowAllergyModal] = useState(false);
    const [showConditionModal, setShowConditionModal] = useState(false);

    // 1. Fetch Patient Details
    const { data: patientsData, isLoading: loadingPatient } = useQuery({
        queryKey: ['myPatients'],
        queryFn: async () => {
            const response = await api.medical.getMyPatients();
            return response as { count: number; results: MyPatient[] };
        },
    });

    const patient = patientsData?.results?.find(p => p.patient_id === patientId);

    // 2. Fetch Medical Records
    const { data: recordsData, isLoading: loadingRecords } = useQuery({
        queryKey: ['patient-records', patientId],
        queryFn: async () => {
            const response = await api.medical.getRecords({ patient_id: patientId });
            return response;
        },
        enabled: !!patientId,
    });

    // 3. Fetch Patient Allergies
    const { data: allergies, isLoading: loadingAllergies } = useQuery<Allergy[]>({
        queryKey: ['patient-allergies', patientId],
        queryFn: () => api.medical.getPatientAllergies(patientId),
        enabled: !!patientId,
    });

    // 4. Fetch Patient Chronic Conditions
    const { data: conditions, isLoading: loadingConditions } = useQuery<ChronicCondition[]>({
        queryKey: ['patient-conditions', patientId],
        queryFn: () => api.medical.getPatientConditions(patientId),
        enabled: !!patientId,
    });

    // Delete mutations
    const deleteAllergyMutation = useMutation({
        mutationFn: (allergyId: string) => api.medical.deletePatientAllergy(patientId, allergyId),
        onSuccess: () => {
            toast.success('Allergy removed');
            queryClient.invalidateQueries({ queryKey: ['patient-allergies', patientId] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.detail || 'Failed to remove allergy');
        },
    });

    const deleteConditionMutation = useMutation({
        mutationFn: (conditionId: string) => api.medical.deletePatientCondition(patientId, conditionId),
        onSuccess: () => {
            toast.success('Condition removed');
            queryClient.invalidateQueries({ queryKey: ['patient-conditions', patientId] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.detail || 'Failed to remove condition');
        },
    });

    if (loadingPatient) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!patient) {
        return (
            <DashboardLayout>
                <div className="text-center py-20">
                    <div className="inline-flex bg-red-100 p-4 rounded-full mb-4">
                        <FiAlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Patient Not Found</h2>
                    <p className="text-gray-500 mt-2">The patient you are looking for does not exist in your list.</p>
                    <Button
                        className="mt-6"
                        onClick={() => router.push('/doctor/patients')}
                    >
                        Back to My Patients
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    const activeConditions = conditions?.filter(c => c.is_active) || [];

    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-7xl mx-auto pb-10">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            {patient.name}
                            <span className="text-sm font-normal bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                                {patient.unique_patient_id}
                            </span>
                        </h1>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-600">
                            <span className="flex items-center gap-1"><FiUser className="h-4 w-4" /> {patient.age} yrs, {patient.gender}</span>
                            <span className="flex items-center gap-1"><FiDroplet className="h-4 w-4 text-red-500" /> {patient.blood_group}</span>
                            <span className="flex items-center gap-1"><FiMapPin className="h-4 w-4" /> {patient.district}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={() => router.push(`/doctor/patients/${patientId}/create-prescription`)}
                            size="lg"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                        >
                            <FiPlus className="mr-2 h-5 w-5" />
                            Create Prescription
                        </Button>
                        <Button
                            onClick={() => router.push(`/doctor/patients/${patientId}/create-record`)}
                            size="lg"
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                        >
                            <FiPlus className="mr-2 h-5 w-5" />
                            {t('create_new_record_short')}
                        </Button>
                    </div>
                </div>

                {/* ═══ Allergies & Conditions Row ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Allergies Card */}
                    <Card className="border-0 shadow-lg bg-white overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-rose-400 to-orange-400" />
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                                    <FiAlertCircle className="h-5 w-5 text-rose-500" />
                                    Allergies
                                    {allergies && allergies.length > 0 && (
                                        <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                                            {allergies.length}
                                        </span>
                                    )}
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowAllergyModal(true)}
                                    className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
                                >
                                    <FiPlus className="mr-1 h-3 w-3" /> Add
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {loadingAllergies ? (
                                <div className="space-y-2">
                                    {[1, 2].map(i => <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />)}
                                </div>
                            ) : allergies && allergies.length > 0 ? (
                                <div className="space-y-2">
                                    {allergies.map(allergy => (
                                        <div key={allergy.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-rose-200 transition-colors group">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-slate-800">{allergy.allergen}</span>
                                                    <SeverityBadge severity={allergy.severity} />
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Reaction: {allergy.reaction_type || allergy.reaction || '—'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Remove allergy "${allergy.allergen}"?`)) {
                                                        deleteAllergyMutation.mutate(allergy.id);
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <FiTrash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-400">
                                    <FiAlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">No allergies recorded</p>
                                    <p className="text-xs mt-1">Click "Add" to record patient allergies</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Chronic Conditions Card */}
                    <Card className="border-0 shadow-lg bg-white overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                                    <FiHeart className="h-5 w-5 text-emerald-500" />
                                    Chronic Conditions
                                    {activeConditions.length > 0 && (
                                        <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                                            {activeConditions.length}
                                        </span>
                                    )}
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowConditionModal(true)}
                                    className="h-8 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                >
                                    <FiPlus className="mr-1 h-3 w-3" /> Add
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {loadingConditions ? (
                                <div className="space-y-2">
                                    {[1, 2].map(i => <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />)}
                                </div>
                            ) : activeConditions.length > 0 ? (
                                <div className="space-y-2">
                                    {activeConditions.map(condition => (
                                        <div key={condition.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-slate-800">
                                                        {condition.disease_name || condition.condition_name}
                                                    </span>
                                                    {condition.icd_10_code && condition.icd_10_code !== 'UNKNOWN' && (
                                                        <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                                            {condition.icd_10_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {condition.diagnosed_date
                                                        ? `Diagnosed: ${format(new Date(condition.diagnosed_date), 'MMM dd, yyyy')}`
                                                        : `Added: ${format(new Date(condition.created_at), 'MMM dd, yyyy')}`
                                                    }
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Remove condition "${condition.disease_name || condition.condition_name}"?`)) {
                                                        deleteConditionMutation.mutate(condition.id);
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <FiTrash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-400">
                                    <FiHeart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">No chronic conditions recorded</p>
                                    <p className="text-xs mt-1">Click "Add" to record patient conditions</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Medical History Section */}
                <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FiActivity className="text-blue-600" />
                        {t('patient_history')}
                    </h2>

                    {loadingRecords ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : !recordsData?.results?.length ? (
                        <Card className="bg-gray-50 border-dashed border-2 border-gray-200 shadow-none">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <FiFileText className="h-8 w-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">{t('no_records_found')}</h3>
                                <p className="text-gray-500 mt-1 mb-6 max-w-sm">
                                    There are no recorded visits for this patient yet. Create a new record to get started.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => router.push(`/doctor/patients/${patientId}/create-record`)}
                                >
                                    Create First Record
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {recordsData.results.map((record) => (
                                <Card key={record.id} className="overflow-hidden hover:shadow-md transition-shadow duration-300 border-gray-200/60">
                                    <div className="flex flex-col md:flex-row">
                                        {/* Date Column */}
                                        <div className="bg-blue-50/50 p-4 md:w-48 flex flex-col justify-center items-center md:items-start border-b md:border-b-0 md:border-r border-blue-100">
                                            <div className="text-sm font-semibold text-blue-800 mb-1 flex items-center gap-2">
                                                <FiCalendar className="h-4 w-4" />
                                                {format(new Date(record.visit_date), 'MMM dd, yyyy')}
                                            </div>
                                            <div className="text-xs text-blue-600 flex items-center gap-2">
                                                <FiClock className="h-3 w-3" />
                                                {format(new Date(record.visit_date), 'hh:mm a')}
                                            </div>
                                        </div>

                                        {/* Content Column */}
                                        <div className="p-5 flex-1 space-y-3">
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                                    {t('diagnosis_label')}
                                                </h4>
                                                <p className="text-gray-900 font-medium">
                                                    {record.diagnosis}
                                                </p>
                                            </div>

                                            {record.prescription && (
                                                <div>
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                                        {t('treatment_label')}
                                                    </h4>
                                                    <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                                                        {record.prescription.split(',').map((item: string, i: number) => {
                                                            const trimmed = item.trim().replace(/\.+$/, '');
                                                            return trimmed ? <li key={i}>{trimmed}</li> : null;
                                                        })}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Footer Info */}
                                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                                <span>{t('doctor_label')}: {record.doctor_name}</span>
                                                {record.tests_performed && (
                                                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">
                                                        Tests: {record.tests_performed}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showAllergyModal && (
                <AddAllergyModal patientId={patientId} onClose={() => setShowAllergyModal(false)} />
            )}
            {showConditionModal && (
                <AddConditionModal patientId={patientId} onClose={() => setShowConditionModal(false)} />
            )}
        </DashboardLayout>
    );
}

export default withAuth(PatientDetailsPage, ['doctor']);
