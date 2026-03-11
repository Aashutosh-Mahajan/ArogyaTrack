'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FiClock, FiFileText } from 'react-icons/fi';
import Link from 'next/link';

export function RecentDispensing() {
    const { data: records, isLoading } = useQuery<any[]>({
        queryKey: ['pharmacy-dispensing-history'],
        queryFn: async () => {
            const res = await api.pharmacy.getDispensingRecords({ limit: 5 });
            // The backend returns an array directly (no pagination wrapper)
            return Array.isArray(res) ? res : (res as any)?.results ?? [];
        },
        staleTime: 30000,
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'dispensed':
                return 'bg-green-100 text-green-800';
            case 'unavailable':
                return 'bg-red-100 text-red-800';
            case 'patient_has':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Card className="h-full border-0 shadow-lg">
            <CardHeader className="border-b border-gray-100 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FiClock className="text-teal-600" />
                        Recent Activity
                    </CardTitle>
                    <Link href="/pharmacy/history" className="text-sm text-teal-600 hover:underline hover:text-teal-700 font-medium">
                        View All
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-6 space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex gap-4 animate-pulse">
                                <div className="w-10 h-10 bg-gray-100 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                                    <div className="h-3 bg-gray-50 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : records && records.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                        {records.map((record: any) => (
                            <div key={record.id} className="p-4 hover:bg-gray-50 transition flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                                    <FiFileText className="text-teal-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">
                                        {record.medicine_name}
                                    </p>
                                    <p className="text-sm text-gray-500 truncate">
                                        via {record.pharmacy_name || 'Pharmacy'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">
                                        {new Date(record.dispensed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(record.status)}`}>
                                        {(record.status || 'dispensed').replace('_', ' ').toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <p>No recent activity</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
