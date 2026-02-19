'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PaginatedResponse, Prescription, PrescriptionMedicine } from '@/types';
import {
  FiFileText,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiPackage,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiInfo
} from 'react-icons/fi';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/components/providers/LanguageProvider';

function PrescriptionsPage(): React.JSX.Element {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery<PaginatedResponse<Prescription>>({
    queryKey: ['prescriptions-all'],
    queryFn: () => api.prescriptions.getAll({ limit: 50 }),
    refetchInterval: 30000,
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const prescriptions = data?.results || [];

  // Helper to get status config
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: t('active_prescriptions_title'), variant: 'secondary', className: 'bg-blue-100 text-blue-700 hover:bg-blue-200' };
      case 'partially_dispensed':
        return { label: t('medium'), variant: 'default', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' };
      case 'fully_dispensed':
        return { label: t('status_completed'), variant: 'default', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' };
      default:
        return { label: status, variant: 'outline', className: 'bg-slate-100 text-slate-700' };
    }
  };

  const getDispenseConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: t('pending'), className: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'dispensed':
        return { label: t('dispensed'), className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'unavailable':
        return { label: t('none'), className: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'patient_has':
        return { label: t('status'), className: 'bg-slate-50 text-slate-700 border-slate-200' };
      default:
        return { label: status, className: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-200 rounded"></div>
          <div className="h-10 w-24 bg-slate-200 rounded"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {t('prescriptions_page_title')}
          </h1>
          <p className="text-slate-500 mt-1">
            {t('prescriptions_page_subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 bg-white/50 border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-md">
        <div className="h-1 bg-gradient-to-r from-teal-400 to-emerald-400"></div>
        <CardContent className="p-0">
          {prescriptions.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="bg-slate-50 p-4 rounded-full shadow-sm inline-block mb-4 border border-slate-100">
                <FiFileText className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-1">{t('no_prescriptions')}</h3>
              <p className="text-slate-400">{t('empty_records_desc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {prescriptions.map((rx) => {
                const isExpanded = expanded.has(rx.id);
                const status = getStatusConfig(rx.status);

                return (
                  <div key={rx.id} className="group transition-all duration-200 hover:bg-slate-50/50">
                    <div
                      className="p-5 cursor-pointer"
                      onClick={() => toggle(rx.id)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`
                                                        p-3 rounded-xl transition-colors shrink-0
                                                        ${rx.status === 'pending'
                              ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                              : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'}
                                                    `}>
                            <FiFileText className="h-6 w-6" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-slate-800 text-lg">
                                {t('prescription_file')} #{rx.id.slice(-6)}
                              </h3>
                              <Badge className={`${status.className} border-0 uppercase text-[10px] tracking-wider font-bold`}>
                                {status.label}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                              <span className="flex items-center gap-1.5">
                                <FiCalendar className="w-3.5 h-3.5" />
                                {formatDate(rx.created_at)}
                              </span>
                              {rx.doctor_name && (
                                <span className="flex items-center gap-1.5">
                                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                  {rx.doctor_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 text-slate-600">
                                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                <FiPackage className="w-3.5 h-3.5" />
                                {rx.medicines.length} {t('medicines_count')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={`
                                                    p-2 rounded-full transition-all duration-300 shrink-0
                                                    ${isExpanded ? 'bg-teal-50 text-teal-600 rotate-180' : 'text-slate-300 group-hover:text-slate-500'}
                                                `}>
                          <FiChevronDown className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden">
                          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-100/50 text-[10px] items-center font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/50">
                            <div className="col-span-4">{t('medicine_name')}</div>
                            <div className="col-span-2 text-center">{t('dosage')}</div>
                            <div className="col-span-2 text-center">{t('frequency')}</div>
                            <div className="col-span-2 text-center">{t('duration')}</div>
                            <div className="col-span-2 text-right">{t('dispense_status')}</div>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {rx.medicines.map((pm: PrescriptionMedicine) => {
                              const dispenseStatus = getDispenseConfig(pm.dispense_status);
                              return (
                                <div key={pm.id} className="p-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center hover:bg-white transition-colors">
                                  {/* Mobile-first Layout */}
                                  <div className="col-span-4 mb-2 sm:mb-0">
                                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                                      {pm.medicine_name || (typeof pm.medicine === 'object' ? pm.medicine.name : pm.medicine)}
                                    </p>
                                    {pm.special_instructions && (
                                      <p className="text-xs text-amber-600 mt-1 flex items-start gap-1.5 bg-amber-50 p-1.5 rounded-md inline-block max-w-full">
                                        <FiInfo className="w-3 h-3 shrink-0 mt-0.5" />
                                        <span className="break-words">{t('instructions')}: {pm.special_instructions}</span>
                                      </p>
                                    )}
                                  </div>

                                  <div className="col-span-2 flex items-center justify-between sm:justify-center gap-2 text-sm text-slate-600 mb-1 sm:mb-0">
                                    <span className="sm:hidden text-xs text-slate-400 font-medium uppercase">{t('dosage')}</span>
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold">{pm.dosage}</span>
                                  </div>

                                  <div className="col-span-2 flex items-center justify-between sm:justify-center gap-2 text-sm text-slate-600 mb-1 sm:mb-0">
                                    <span className="sm:hidden text-xs text-slate-400 font-medium uppercase">{t('frequency')}</span>
                                    <div className="flex items-center gap-1.5">
                                      <FiClock className="w-3.5 h-3.5 text-slate-400" />
                                      {pm.frequency}
                                    </div>
                                  </div>

                                  <div className="col-span-2 flex items-center justify-between sm:justify-center gap-2 text-sm text-slate-600 mb-2 sm:mb-0">
                                    <span className="sm:hidden text-xs text-slate-400 font-medium uppercase">{t('duration')}</span>
                                    <span>{pm.duration_days} {t('date').replace('Date', 'Days')}</span>
                                  </div>

                                  <div className="col-span-2 text-right">
                                    <Badge className={`${dispenseStatus.className} text-[10px] uppercase tracking-wide border font-bold`}>
                                      {dispenseStatus.label}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(PrescriptionsPage, ['patient']);
