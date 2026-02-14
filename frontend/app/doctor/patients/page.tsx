'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { MyPatient } from '@/types';
import { FiUsers, FiSearch, FiPlus, FiClipboard, FiCamera } from 'react-icons/fi';

function MyPatientsPage() {
  const router = useRouter();
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Patients</h1>
            <p className="text-gray-600 mt-1">
              Manage your patients and create consultation records
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-blue-600">
              {data?.count ?? 0}
            </span>
            <span className="text-sm text-gray-500">Total</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search by name, patient ID, or district…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading patients…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-800 font-semibold mb-1">Error Loading Patients</p>
            <p className="text-red-600 text-sm">
              {(error as any)?.message || 'Something went wrong'}
            </p>
          </div>
        )}

        {/* Patients list */}
        {!isLoading && !error && (
          <>
            {filteredPatients.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <FiUsers className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No Patients Found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : "Scan a patient's QR code to add them to your list"}
                </p>
                <button
                  onClick={() => router.push('/doctor/scan-qr')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiCamera className="h-5 w-5" />
                  Scan Patient QR
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.patient_id}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-100"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        {/* Patient info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 truncate">
                              {patient.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mt-1">
                              <span className="font-mono font-semibold text-blue-600">
                                {patient.unique_patient_id}
                              </span>
                              <span>•</span>
                              <span>{patient.age} yrs</span>
                              <span>•</span>
                              <span>{patient.gender}</span>
                              <span>•</span>
                              <span className="font-semibold">{patient.blood_group}</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                              <div>
                                <span className="text-xs text-gray-500">District</span>
                                <p className="font-medium text-gray-800">{patient.district}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Visits</span>
                                <p className="font-medium text-gray-800">{patient.visit_count}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Last Visit</span>
                                <p className="font-medium text-gray-800">
                                  {patient.last_visit_date
                                    ? new Date(patient.last_visit_date).toLocaleDateString()
                                    : 'Never'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Access</span>
                                <p className="text-xs font-semibold text-green-600">
                                  {patient.access_method === 'added_to_list'
                                    ? 'In My List'
                                    : patient.access_method}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() =>
                              router.push(`/doctor/patients/${patient.patient_id}/create-record`)
                            }
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold whitespace-nowrap"
                          >
                            <FiPlus className="h-4 w-4" />
                            Create Record
                          </button>
                          <button
                            onClick={() =>
                              router.push(`/doctor/patients/${patient.patient_id}`)
                            }
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold whitespace-nowrap"
                          >
                            <FiClipboard className="h-4 w-4" />
                            View History
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-6 py-2.5 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          Granted: {new Date(patient.access_granted_at).toLocaleDateString()}
                        </span>
                        <span>
                          Expires: {new Date(patient.access_expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
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
