'use client';

import React from 'react';
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

const data = [
    { name: 'Mon', dispensed: 40 },
    { name: 'Tue', dispensed: 30 },
    { name: 'Wed', dispensed: 20 },
    { name: 'Thu', dispensed: 27 },
    { name: 'Fri', dispensed: 18 },
    { name: 'Sat', dispensed: 23 },
    { name: 'Sun', dispensed: 34 },
];

export function PharmacyTrends() {
    return (
        <Card className="border-0 shadow-lg overflow-hidden h-full">
            <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-400"></div>
            <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                        <FiTrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Dispensing Trends</CardTitle>
                        <p className="text-xs text-muted-foreground">Last 7 days activity</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 30,
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <defs>
                                <linearGradient id="colorDispensed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
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
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="dispensed"
                                stroke="#8884d8"
                                fillOpacity={1}
                                fill="url(#colorDispensed)"
                                strokeWidth={3}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
