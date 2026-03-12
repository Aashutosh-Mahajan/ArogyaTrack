"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MyPatient } from "@/types";

export default function MyPatientsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["myPatients"],
    queryFn: async () => {
      const response = await api.medical.getMyPatients();
      return response as { count: number; results: MyPatient[] };
    },
  });

  const filteredPatients = data?.results?.filter((patient) => {
    const search = searchTerm.toLowerCase();
    return (
      patient.name.toLowerCase().includes(search) ||
      patient.unique_patient_id.toLowerCase().includes(search) ||
      patient.district.toLowerCase().includes(search)
    );
  }) || [];

  const handleCreateRecord = (patientId: string) => {
    router.push(`/doctor/patients/${patientId}/create-consultation`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                My Patients
              </h1>
              <p className="text-gray-600">
                Manage your patients and create consultation records
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {data?.count || 0}
              </div>
              <div className="text-sm text-gray-600">Total Patients</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <input
            type="text"
            placeholder="🔍 Search by name, patient ID, or district..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading patients...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-800 font-semibold mb-2">Error Loading Patients</p>
            <p className="text-red-600">{(error as any)?.message || "Something went wrong"}</p>
          </div>
        )}

        {/* Patients List */}
        {!isLoading && !error && (
          <>
            {filteredPatients.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No Patients Found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Scan a patient's QR code to add them to your list"}
                </p>
                <button
                  onClick={() => router.push("/doctor/scan-qr")}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Scan Patient QR
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.patient_id}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        {/* Patient Info */}
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                              {patient.name.charAt(0).toUpperCase()}
                            </div>

                            {/* Details */}
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900 mb-1">
                                {patient.name}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                                <span className="font-mono font-semibold text-blue-600">
                                  {patient.unique_patient_id}
                                </span>
                                <span>•</span>
                                <span>{patient.age} years</span>
                                <span>•</span>
                                <span>{patient.gender}</span>
                                <span>•</span>
                                <span className="font-semibold">{patient.blood_group}</span>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">District</div>
                                  <div className="font-semibold text-gray-800">
                                    {patient.district}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Total Visits</div>
                                  <div className="font-semibold text-gray-800">
                                    {patient.visit_count}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Last Visit</div>
                                  <div className="font-semibold text-gray-800">
                                    {patient.last_visit_date
                                      ? new Date(patient.last_visit_date).toLocaleDateString()
                                      : "Never"}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Access Method</div>
                                  <div className="text-xs font-semibold text-green-600">
                                    {patient.access_method === "added_to_list"
                                      ? "In My List"
                                      : patient.access_method}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="ml-4 flex flex-col gap-2">
                          <button
                            onClick={() => handleCreateRecord(patient.patient_id)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
                          >
                            ➕ Create Record
                          </button>
                          <button
                            onClick={() => router.push(`/doctor/patients/${patient.patient_id}`)}
                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold whitespace-nowrap"
                          >
                            📋 View History
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Access Info Footer */}
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>
                          Access granted:{" "}
                          {new Date(patient.access_granted_at).toLocaleDateString()}
                        </span>
                        <span>
                          Expires:{" "}
                          {new Date(patient.access_expires_at).toLocaleDateString()}
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
    </div>
  );
}
