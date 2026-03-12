'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { MyPatient } from '@/types';
import { FiUsers, FiSearch, FiPlus, FiClipboard, FiCamera, FiMapPin, FiCalendar, FiActivity } from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function MyPatientsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['myPatients'],
    queryFn: async () => {
      const response = await api.medical.getMyPatients();
      return response as { count: number; results: MyPatient[] };
    },
  });

  const filteredPatients =
    data?.results?.filter((patient) => {
      const search = searchTerm.toLowerCase();
      return (
        patient.name.toLowerCase().includes(search) ||
        patient.unique_patient_id.toLowerCase().includes(search) ||
        patient.district.toLowerCase().includes(search)
      );
    }) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('my_patients_title') || 'My Patients'}</h1>
            <p className="text-slate-500 mt-1">
              {t('my_patients_subtitle') || 'Manage your patients and create consultation records'}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
            <span className="text-2xl font-bold text-teal-600">
              {data?.count ?? 0}
            </span>
            <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('total') || 'Total'}</span>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input
              type="text"
              placeholder={t('search_patients_placeholder') || 'Search by name, patient ID, or district...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 py-6 bg-white border-slate-200 shadow-sm transition-all focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <Button
            onClick={() => router.push('/doctor/scan-qr')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 py-6"
          >
            <FiCamera className="mr-2 h-5 w-5" />
            {t('scan_patient_qr') || 'Scan Patient QR'}
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-slate-100 p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-4" />
            <p className="text-slate-600">{t('loading_patients') || 'Loading patients...'}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 flex items-start gap-4">
            <div className="p-2 bg-rose-100 rounded-full">
              <FiActivity className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-rose-900 font-semibold mb-1">{t('error_loading_patients') || 'Error Loading Patients'}</p>
              <p className="text-rose-700 text-sm">
                {(error as any)?.message || 'Something went wrong'}
              </p>
            </div>
          </div>
        )}

        {/* Patients list */}
        {!isLoading && !error && (
          <>
            {filteredPatients.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <FiUsers className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">
                    {t('no_patients_found') || 'No Patients Found'}
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto mb-8">
                    {searchTerm
                      ? (t('adjust_search') || 'Try adjusting your search terms')
                      : (t('scan_qr_prompt') || "Scan a patient's health card QR code to add them to your list")}
                  </p>
                  <Button
                    onClick={() => router.push('/doctor/scan-qr')}
                    variant="default"
                    size="lg"
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <FiCamera className="h-5 w-5 mr-2" />
                    {t('scan_qr_now') || 'Scan QR Now'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredPatients.map((patient) => (
                  <Card
                    key={patient.patient_id}
                    className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-white overflow-hidden relative"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-400 to-blue-500 group-hover:w-1.5 transition-all"></div>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-teal-200 ring-4 ring-white">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 line-clamp-1" title={patient.name}>
                              {patient.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                                {patient.unique_patient_id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mb-6">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Age / Gender</span>
                          <span className="font-medium text-slate-700">{patient.age} yrs • {patient.gender}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Blood Group</span>
                          <span className="font-medium text-slate-700">{patient.blood_group}</span>
                        </div>
                        <div className="flex flex-col col-span-2">
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                            <FiMapPin className="h-3 w-3" /> District
                          </span>
                          <span className="font-medium text-slate-700">{patient.district}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                            <FiActivity className="h-3 w-3" /> Visits
                          </span>
                          <span className="font-medium text-slate-700">{patient.visit_count}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                            <FiCalendar className="h-3 w-3" /> Last Visit
                          </span>
                          <span className="font-medium text-slate-700">
                            {patient.last_visit_date
                              ? new Date(patient.last_visit_date).toLocaleDateString()
                              : 'Never'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() =>
                            router.push(`/doctor/patients/${patient.patient_id}/create-consultation`)
                          }
                          variant="default"
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-100"
                        >
                          <FiPlus className="h-4 w-4 mr-1.5" />
                          {t('create_record') || 'Create Record'}
                        </Button>

                        <Button
                          onClick={() =>
                            router.push(`/doctor/patients/${patient.patient_id}`)
                          }
                          variant="outline"
                          className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <FiClipboard className="h-4 w-4 mr-1.5" />
                          {t('history') || 'History'}
                        </Button>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-xs text-slate-400">
                        <span>Granted: {new Date(patient.access_granted_at).toLocaleDateString()}</span>
                        <span className={patient.access_method === 'added_to_list' ? 'text-teal-600 font-medium' : ''}>
                          {patient.access_method === 'added_to_list' ? 'My List' : 'Token'}
                        </span>
                      </div>

                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(MyPatientsPage, ['doctor']);
