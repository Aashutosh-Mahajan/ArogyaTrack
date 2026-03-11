'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { KPICard } from '@/components/dashboard/KPICard';
import {
    FiBox,
    FiClipboard,
    FiShoppingCart,
    FiActivity,
} from 'react-icons/fi';

export function PharmacyKPIGrid() {
    const { data: stats, isLoading } = useQuery<any>({
        queryKey: ['pharmacy-dashboard-stats'],
        queryFn: () => api.pharmacy.getDashboardStats(),
        staleTime: 30000,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="animate-pulse bg-white rounded-xl border border-gray-100 p-5 h-32"
                    />
                ))}
            </div>
        );
    }

    const totalDispensed = stats?.total_dispensed ?? 0;
    const todayDispensed = stats?.today_dispensed ?? 0;
    const lowStockCount = stats?.low_stock_count ?? 0;
    const pendingRequests = stats?.pending_prescriptions ?? 0;

    const cards = [
        {
            title: 'Total Dispensed',
            value: totalDispensed,
            icon: FiShoppingCart,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
        },
        {
            title: "Today's Activity",
            value: todayDispensed,
            icon: FiActivity,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
        },
        {
            title: 'Low Stock Items',
            value: lowStockCount,
            icon: FiBox,
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            trend: lowStockCount > 0
                ? { value: lowStockCount, direction: 'down' as const, label: 'Needs attention', current: lowStockCount, previous: 0, change: 0 }
                : undefined,
        },
        {
            title: 'Pending Requests',
            value: pendingRequests,
            icon: FiClipboard,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, i) => (
                <KPICard
                    key={i}
                    title={card.title}
                    value={card.value}
                    icon={card.icon}
                    iconBg={card.iconBg}
                    iconColor={card.iconColor}
                    trend={card.trend}
                />
            ))}
        </div>
    );
}
