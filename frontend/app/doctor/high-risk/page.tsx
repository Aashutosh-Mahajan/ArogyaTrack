'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { FiAlertTriangle, FiSearch, FiClipboard, FiPlus } from 'react-icons/fi';

interface HighRiskPatient {
  patient_id: string;
  unique_patient_id: string;
  name: string;
  age: number;
  gender: string;
  blood_group: string;
  district: string;
  condition: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  risk_factors: string[];
  last_visit_date: string | null;
  latest_bp: string | null;
  latest_bp_value: number | null;
  latest_sugar: number | null;
  conditions_count: number;
  abnormal_labs: number;
}

const riskBadge: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'High' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium' },
  low: { bg: 'bg-green-100', text: 'text-green-800', label: 'Low' },
};

function HighRiskPatientsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['doctor-high-risk'],
    queryFn: async () => {
      const res = await api.medical.getHighRiskPatients();
      return res as { count: number; results: HighRiskPatient[] };
    },
  });

  const filtered =
    data?.results?.filter((p: HighRiskPatient) => {
      const s = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(s) ||
        p.unique_patient_id.toLowerCase().includes(s) ||
        p.risk_level.includes(s) ||
        (p.condition && p.condition.toLowerCase().includes(s)) ||
        p.risk_factors.some((f: string) => f.toLowerCase().includes(s))
      );
    }) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FiAlertTriangle className="text-orange-500" />
              High-Risk Patients
            </h1>
            <p className="text-gray-600 mt-1">
              Patients flagged for chronic conditions, abnormal vitals, or elevated lab results
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-red-600">{data?.count ?? 0}</span>
            <span className="text-sm text-gray-500">flagged</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search by name, ID, risk level, or condition…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-4" />
            <p className="text-gray-600">Analysing patient risk factors…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-800 font-semibold mb-1">Error</p>
            <p className="text-red-600 text-sm">
              {(error as any)?.message || 'Failed to load high-risk patients'}
            </p>
          </div>
        )}

        {/* Cards */}
        {!isLoading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <FiAlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No High-Risk Patients
                </h3>
                <p className="text-gray-600">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'None of your patients are currently flagged as high-risk.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((patient) => {
                  const badge = riskBadge[patient.risk_level] ?? riskBadge.low;
                  return (
                    <Card
                      key={patient.patient_id}
                      className="border-l-4 hover:shadow-md transition-shadow"
                      style={{
                        borderLeftColor:
                          patient.risk_level === 'critical'
                            ? '#ef4444'
                            : patient.risk_level === 'high'
                            ? '#f97316'
                            : patient.risk_level === 'medium'
                            ? '#eab308'
                            : '#22c55e',
                      }}
                    >
                      <CardContent className="p-5">
                        {/* Top row */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {patient.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {patient.unique_patient_id} · {patient.age} yrs ·{' '}
                              {patient.gender} · {patient.blood_group}
                            </p>
                          </div>
                          <span
                            className={`${badge.bg} ${badge.text} text-xs font-bold px-3 py-1 rounded-full uppercase`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        {/* Primary Condition */}
                        {patient.condition && (
                          <div className="mb-3">
                            <span className="text-xs text-gray-500">Primary Condition: </span>
                            <span className="text-sm font-semibold text-gray-800">{patient.condition}</span>
                          </div>
                        )}

                        {/* Risk factors */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {patient.risk_factors.map((factor, i) => (
                            <span
                              key={i}
                              className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-4 gap-3 text-sm mb-4">
                          <div>
                            <span className="text-xs text-gray-500">BP</span>
                            <p className={`font-semibold ${patient.latest_bp_value && patient.latest_bp_value >= 140 ? 'text-red-600' : 'text-gray-800'}`}>
                              {patient.latest_bp ?? '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Sugar</span>
                            <p className={`font-semibold ${patient.latest_sugar && patient.latest_sugar > 200 ? 'text-red-600' : 'text-gray-800'}`}>
                              {patient.latest_sugar ? `${patient.latest_sugar} mg/dL` : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Abnormal Labs</span>
                            <p className="font-semibold text-gray-800">
                              {patient.abnormal_labs}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Last Visit</span>
                            <p className="font-semibold text-gray-800">
                              {patient.last_visit_date
                                ? new Date(patient.last_visit_date).toLocaleDateString()
                                : '—'}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              router.push(
                                `/doctor/patients/${patient.patient_id}/create-record`
                              )
                            }
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            <FiPlus className="h-4 w-4" />
                            New Record
                          </button>
                          <button
                            onClick={() =>
                              router.push(`/doctor/patients/${patient.patient_id}`)
                            }
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                          >
                            <FiClipboard className="h-4 w-4" />
                            View History
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(HighRiskPatientsPage, ['doctor']);
