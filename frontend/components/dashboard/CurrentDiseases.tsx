'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FiActivity, FiDroplet, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { ChronicCondition, HealthTrendsResponse } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';

function StatusBadge({ status, value, unit }: { status: string; value: string | number; unit: string }) {
    const { t } = useLanguage();
    let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
    let icon = <FiCheckCircle className="mr-1.5 h-3.5 w-3.5" />;

    if (status === 'high') {
        colorClass = 'bg-red-50 text-red-700 border-red-200';
        icon = <FiAlertCircle className="mr-1.5 h-3.5 w-3.5" />;
    } else if (status === 'low') {
        colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
        icon = <FiAlertCircle className="mr-1.5 h-3.5 w-3.5" />;
    } else {
        colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }

    const label = status === 'normal' ? t('lab_normal') :
        status === 'high' ? t('lab_high') :
            status === 'low' ? t('lab_low') : status;

    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
            {icon}
            {label} <span className="ml-1 opacity-75">({value} {unit})</span>
        </span>
    );
}

export function CurrentDiseases() {
    const { t, language } = useLanguage();
    const { data: conditions } = useQuery<ChronicCondition[]>({
        queryKey: ['my-conditions'],
        queryFn: () => api.medical.getChronicConditions(),
    });

    const { data: healthTrends } = useQuery<HealthTrendsResponse>({
        queryKey: ['health-trends'],
        queryFn: () => api.dashboard.getHealthTrends({ months: 1 }),
    });

    // Extract latest values from trends
    const bpSeries = healthTrends?.trends?.find(t => t.metric === 'blood_pressure');
    const sugarSeries = healthTrends?.trends?.find(t => t.metric === 'sugar');

    const latestBP = bpSeries?.data?.[bpSeries.data.length - 1];
    const latestSugar = sugarSeries?.data?.[sugarSeries.data.length - 1];

    // Helper to determine status (duplicating simple logic for frontend display)
    const getBPStatus = (value: number) => value >= 140 ? 'high' : value < 90 ? 'low' : 'normal';
    const getSugarStatus = (value: number) => value >= 200 ? 'high' : value < 70 ? 'low' : 'normal';

    const locale = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';

    return (
        <Card className="border-0 shadow-lg overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-400 to-red-400"></div>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FiActivity className="w-5 h-5 text-orange-500" />
                    {t('conditions_title')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Active Conditions */}
                    <div className="md:col-span-2 lg:col-span-1 space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('chronic_conditions')}</h3>
                        {conditions && conditions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {conditions.map((condition) => (
                                    <div
                                        key={condition.id}
                                        className="flex items-center px-3 py-2 bg-orange-50/50 border border-orange-100 rounded-xl text-orange-800 text-sm font-medium shadow-sm"
                                    >
                                        <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></span>
                                        {condition.disease_name}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                                <p className="text-sm text-slate-500">{t('no_active_conditions')}</p>
                            </div>
                        )}
                    </div>

                    {/* Vitals Status */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('blood_pressure')}</h3>
                        {latestBP ? (
                            <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg group-hover:scale-110 transition-transform">
                                            <FiActivity className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700">Blood Pressure</p>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                                {new Date(latestBP.date).toLocaleDateString(locale)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <StatusBadge
                                        status={getBPStatus(latestBP.value)}
                                        value={latestBP.value}
                                        unit="mmHg"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                                <p className="text-sm text-slate-500 italic">{t('no_bp_readings')}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('blood_sugar')}</h3>
                        {latestSugar ? (
                            <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-pink-50 rounded-lg group-hover:scale-110 transition-transform">
                                            <FiDroplet className="w-5 h-5 text-pink-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700">Blood Sugar</p>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                                {new Date(latestSugar.date).toLocaleDateString(locale)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <StatusBadge
                                        status={getSugarStatus(latestSugar.value)}
                                        value={latestSugar.value}
                                        unit="mg/dL"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                                <p className="text-sm text-slate-500 italic">{t('no_sugar_readings')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
