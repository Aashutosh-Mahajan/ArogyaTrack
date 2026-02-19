'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { FiAlertTriangle, FiSearch, FiClipboard, FiPlus, FiActivity, FiUser } from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';

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

const riskBadgeConfig: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  low: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
};

function HighRiskPatientsPage() {
  const router = useRouter();
  const { t } = useLanguage();
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

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'critical': return t('critical');
      case 'high': return t('high_risk');
      case 'medium': return t('medium_risk');
      case 'low': return t('low_risk');
      default: return level;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="p-2 bg-rose-100 rounded-lg">
                <FiAlertTriangle className="text-rose-600 h-8 w-8" />
              </span>
              {t('high_risk_title')}
            </h1>
            <p className="text-slate-500 mt-2 max-w-2xl">
              {t('high_risk_subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-lg shadow-rose-100/50 border border-rose-100">
            <span className="text-3xl font-bold text-rose-600">{data?.count ?? 0}</span>
            <span className="text-sm font-semibold text-rose-800 uppercase tracking-wider">{t('flagged')}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
          <Input
            type="text"
            placeholder={t('search_high_risk')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-6 bg-white border-slate-200 shadow-sm focus:ring-2 focus:ring-rose-500 rounded-xl transition-all"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-slate-100 p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">{t('analysing_risk')}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 flex items-start gap-3">
            <FiAlertTriangle className="h-5 w-5 text-rose-600 mt-0.5" />
            <div>
              <p className="text-rose-900 font-semibold mb-1">{t('failed_load')}</p>
              <p className="text-rose-700 text-sm">
                {(error as any)?.message || 'Failed to load high-risk patients'}
              </p>
            </div>
          </div>
        )}

        {/* Cards */}
        {!isLoading && !error && (
          <>
            {filtered.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <FiClipboard className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">
                    {t('no_high_risk_found')}
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    {searchTerm
                      ? t('adjust_search')
                      : t('no_high_risk_desc')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((patient) => {
                  const badge = riskBadgeConfig[patient.risk_level] ?? riskBadgeConfig.low;
                  return (
                    <Card
                      key={patient.patient_id}
                      className={`group hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-white overflow-hidden relative border-t-4 ${patient.risk_level === 'critical' ? 'border-t-rose-500' :
                          patient.risk_level === 'high' ? 'border-t-orange-500' :
                            patient.risk_level === 'medium' ? 'border-t-yellow-500' : 'border-t-emerald-500'
                        }`}
                    >
                      <CardContent className="p-6">
                        {/* Top row */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 ${badge.bg} ${badge.text} ${badge.border}`}>
                              {patient.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                                {patient.name}
                              </h3>
                              <p className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                                {patient.unique_patient_id}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`${badge.bg} ${badge.text} border ${badge.border} text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide`}
                          >
                            {getRiskLabel(patient.risk_level)}
                          </span>
                        </div>

                        {/* Patient Demographics */}
                        <div className="text-xs text-slate-500 mb-4 flex gap-2 items-center">
                          <span>{patient.age} yrs</span>
                          <span>•</span>
                          <span>{patient.gender}</span>
                          <span>•</span>
                          <span>{patient.blood_group}</span>
                        </div>

                        {/* Primary Condition */}
                        {patient.condition && (
                          <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">{t('primary_condition')}</span>
                            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <FiActivity className="text-rose-500" /> {patient.condition}
                            </span>
                          </div>
                        )}

                        {/* Risk factors */}
                        <div className="mb-4">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-2">{t('risk_factors')}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {patient.risk_factors.map((factor, i) => (
                              <span
                                key={i}
                                className="bg-white border border-slate-200 text-slate-600 text-xs px-2.5 py-1 rounded-md font-medium shadow-sm"
                              >
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">BP</span>
                            <p className={`font-mono font-semibold ${patient.latest_bp_value && patient.latest_bp_value >= 140 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {patient.latest_bp ?? '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Sugar</span>
                            <p className={`font-mono font-semibold ${patient.latest_sugar && patient.latest_sugar > 200 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {patient.latest_sugar ? `${patient.latest_sugar} mg/dL` : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{t('abnormal_labs_count')}</span>
                            <p className={`font-mono font-semibold ${patient.abnormal_labs > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {patient.abnormal_labs}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Last Visit</span>
                            <p className="font-mono font-semibold text-slate-700 text-xs mt-0.5">
                              {patient.last_visit_date
                                ? new Date(patient.last_visit_date).toLocaleDateString()
                                : '—'}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={() =>
                              router.push(
                                `/doctor/patients/${patient.patient_id}/create-record`
                              )
                            }
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-100"
                          >
                            <FiPlus className="h-4 w-4 mr-1.5" />
                            {t('new_record')}
                          </Button>
                          <Button
                            onClick={() =>
                              router.push(`/doctor/patients/${patient.patient_id}`)
                            }
                            variant="outline"
                            className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
                          >
                            <FiClipboard className="h-4 w-4 mr-1.5" />
                            {t('view_history')}
                          </Button>
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
