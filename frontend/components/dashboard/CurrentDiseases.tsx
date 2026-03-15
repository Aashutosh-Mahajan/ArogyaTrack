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

    let colorClass = 'badge badge-live';
    if (status === 'high') colorClass = 'badge badge-alert';
    else if (status === 'low') colorClass = 'badge badge-followup';

    const label = status === 'normal' ? t('lab_normal') :
        status === 'high' ? t('lab_high') :
            status === 'low' ? t('lab_low') : status;

    return (
        <span className={colorClass}>
            {label}
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

    const bpSeries = healthTrends?.trends?.find(t => t.metric === 'blood_pressure');
    const sugarSeries = healthTrends?.trends?.find(t => t.metric === 'sugar');

    const latestBP = bpSeries?.data?.[bpSeries.data.length - 1];
    const latestSugar = sugarSeries?.data?.[sugarSeries.data.length - 1];

    const getBPStatus = (value: number) => value >= 140 ? 'high' : value < 90 ? 'low' : 'normal';
    const getSugarStatus = (value: number) => value >= 200 ? 'high' : value < 70 ? 'low' : 'normal';

    const locale = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';

    return (
        <div className="content-card">
            <div className="section-header">
                <div className="bar" />
                <h2>{t('conditions_title')}</h2>
            </div>

            <div className="health-status-grid">
                {/* Chronic Conditions */}
                <div className="health-panel">
                    <p className="panel-label">{t('chronic_conditions')}</p>
                    {conditions && conditions.length > 0 ? (
                        <div className="flex flex-col gap-2 mt-2">
                            {conditions.map((condition) => (
                                <div key={condition.id} className="text-[13px] font-medium text-[#FFFFFF] flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                                    {condition.disease_name}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="empty-state">{t('no_active_conditions')}</p>
                    )}
                </div>

                {/* Blood Pressure */}
                <div className="health-panel">
                    <p className="panel-label">{t('blood_pressure')}</p>
                    {latestBP ? (
                        <div className="flex flex-col my-auto gap-1 mt-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[1.3rem] font-bold text-[#FFFFFF] leading-none">
                                    {latestBP.value} <span className="text-[10px] text-[#9CA3AF] font-normal tracking-wide">mmHg</span>
                                </span>
                                <StatusBadge status={getBPStatus(latestBP.value)} value={latestBP.value} unit="mmHg" />
                            </div>
                            <p className="text-[10px] text-[#9CA3AF] font-medium">
                                {new Date(latestBP.date).toLocaleDateString(locale)}
                            </p>
                        </div>
                    ) : (
                        <p className="empty-state">{t('no_bp_readings')}</p>
                    )}
                </div>

                {/* Blood Sugar */}
                <div className="health-panel">
                    <p className="panel-label">{t('blood_sugar')}</p>
                    {latestSugar ? (
                        <div className="flex flex-col my-auto gap-1 mt-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[1.3rem] font-bold text-[#FFFFFF] leading-none">
                                    {latestSugar.value} <span className="text-[10px] text-[#9CA3AF] font-normal tracking-wide">mg/dL</span>
                                </span>
                                <StatusBadge status={getSugarStatus(latestSugar.value)} value={latestSugar.value} unit="mg/dL" />
                            </div>
                            <p className="text-[10px] text-[#9CA3AF] font-medium">
                                {new Date(latestSugar.date).toLocaleDateString(locale)}
                            </p>
                        </div>
                    ) : (
                        <p className="empty-state">{t('no_sugar_readings')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
