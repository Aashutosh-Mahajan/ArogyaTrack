'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FiTrendingUp } from 'react-icons/fi';

export function PharmacyTrends() {
    const { data: stats, isLoading } = useQuery<any>({
        queryKey: ['pharmacy-dashboard-stats'],
        queryFn: () => api.pharmacy.getDashboardStats(),
        staleTime: 30000,
    });

    const trendData = stats?.trend ?? [];

    return (
        <Card className="border-0 shadow-lg overflow-hidden h-full">
            <div className="h-1 bg-gradient-to-r from-teal-400 to-emerald-400"></div>
            <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 rounded-lg">
                        <FiTrendingUp className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Dispensing Trends</CardTitle>
                        <p className="text-xs text-muted-foreground">Last 7 days activity</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-[300px] w-full mt-4 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" />
                    </div>
                ) : trendData.length === 0 ? (
                    <div className="h-[300px] w-full mt-4 flex items-center justify-center text-gray-400">
                        No dispensing data yet
                    </div>
                ) : (
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={trendData}
                                margin={{
                                    top: 10,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                }}
                            >
                                <defs>
                                    <linearGradient id="colorDispensed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#888', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#888', fontSize: 12 }}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="dispensed"
                                    stroke="#14b8a6"
                                    fillOpacity={1}
                                    fill="url(#colorDispensed)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
