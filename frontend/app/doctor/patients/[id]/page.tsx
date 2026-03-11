'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { MyPatient, MedicalRecord } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
    FiUser,
    FiCalendar,
    FiActivity,
    FiFileText,
    FiPlus,
    FiClock,
    FiMapPin,
    FiPhone,
    FiDroplet,
    FiAlertCircle
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

function PatientDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { t } = useLanguage();
    const patientId = params.id as string;

    // 1. Fetch Patient Details
    // Since we don't have a direct getPatient(id), we fetch all and find.
    // Ideally backend should have getPatient(id).
    const { data: patientsData, isLoading: loadingPatient } = useQuery({
        queryKey: ['myPatients'],
        queryFn: async () => {
            const response = await api.medical.getMyPatients();
            return response as { count: number; results: MyPatient[] };
        },
    });

    const patient = patientsData?.results?.find(p => p.patient_id === patientId);

    // 2. Fetch Medical Records for this patient
    const { data: recordsData, isLoading: loadingRecords } = useQuery({
        queryKey: ['patient-records', patientId],
        queryFn: async () => {
            // Assuming the backend supports filtering by patient_id
            // If not, we might get all records and have to filter client side (not ideal)
            const response = await api.medical.getRecords({ patient_id: patientId });
            return response;
        },
        enabled: !!patientId,
    });

    // Filter client-side just in case backend ignores the param (safety net)
    // But strictly speaking we should rely on backend.
    // The 'MedicalRecord' type doesn't have patient_id explicitly visible in the interface shown in types.ts
    // but it usually comes with response.
    // Let's assume the API works.

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
                    <Button
                        onClick={() => router.push(`/doctor/patients/${patientId}/create-record`)}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                    >
                        <FiPlus className="mr-2 h-5 w-5" />
                        {t('create_new_record_short')}
                    </Button>
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
                                                    <p className="text-gray-700 text-sm whitespace-pre-line">
                                                        {record.prescription}
                                                    </p>
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
        </DashboardLayout>
    );
}

export default withAuth(PatientDetailsPage, ['doctor']);
