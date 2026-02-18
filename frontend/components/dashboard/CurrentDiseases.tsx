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
    let colorClass = 'bg-gray-100 text-gray-800';
    let icon = <FiCheckCircle className="mr-1 h-3 w-3" />;

    if (status === 'high') {
        colorClass = 'bg-red-100 text-red-800';
        icon = <FiAlertCircle className="mr-1 h-3 w-3" />;
    } else if (status === 'low') {
        colorClass = 'bg-blue-100 text-blue-800';
        icon = <FiAlertCircle className="mr-1 h-3 w-3" />;
    } else {
        colorClass = 'bg-green-100 text-green-800';
    }

    const label = status === 'normal' ? t('lab_normal') :
        status === 'high' ? t('lab_high') :
            status === 'low' ? t('lab_low') : status;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {icon}
            {label} ({value} {unit})
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
        <Card>
            <CardHeader>
                <CardTitle>{t('conditions_title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Active Conditions */}
                    <div className="md:col-span-2 lg:col-span-1 space-y-3">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t('chronic_conditions')}</h3>
                        {conditions && conditions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {conditions.map((condition) => (
                                    <div
                                        key={condition.id}
                                        className="flex items-center px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-orange-800 text-sm font-medium"
                                    >
                                        <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                                        {condition.disease_name}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">{t('no_active_conditions')}</p>
                        )}
                    </div>

                    {/* Vitals Status */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t('blood_pressure')}</h3>
                        {latestBP ? (
                            <div className="p-3 bg-white border rounded-lg shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center text-gray-700">
                                        <FiActivity className="mr-2 text-indigo-500" />
                                        <span className="font-semibold">BP</span>
                                    </div>
                                    <StatusBadge
                                        status={getBPStatus(latestBP.value)}
                                        value={latestBP.value}
                                        unit="mmHg" // Simplified as we only have systolic here usually from trends simplified 
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    {t('last_recorded')}: {new Date(latestBP.date).toLocaleDateString(locale)}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">{t('no_bp_readings')}</p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t('blood_sugar')}</h3>
                        {latestSugar ? (
                            <div className="p-3 bg-white border rounded-lg shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center text-gray-700">
                                        <FiDroplet className="mr-2 text-pink-500" />
                                        <span className="font-semibold">Sugar</span>
                                    </div>
                                    <StatusBadge
                                        status={getSugarStatus(latestSugar.value)}
                                        value={latestSugar.value}
                                        unit="mg/dL"
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    {t('last_recorded')}: {new Date(latestSugar.date).toLocaleDateString(locale)}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">{t('no_sugar_readings')}</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
