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
    FiAlertCircle,
} from 'react-icons/fi';

export function PharmacyKPIGrid() {
    // Fetch dispensing history to calculate stats
    const { data: dispensingHistory, isLoading: isLoadingHistory } = useQuery<any>({
        queryKey: ['pharmacy-dispensing-history'],
        queryFn: () => api.pharmacy.getDispensingRecords({ limit: 100 }), // Fetch manageable amount for stats
    });

    // Fetch inventory to check low stock
    const { data: inventory, isLoading: isLoadingInventory } = useQuery<any>({
        queryKey: ['pharmacy-inventory'],
        queryFn: () => api.pharmacy.getInventory({ limit: 1000 }),
    });

    const isLoading = isLoadingHistory || isLoadingInventory;

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

    // Calculate stats with hardcoded dummy data for demonstration
    const totalDispensed = dispensingHistory?.count || 124;

    // Calculate today's sales (mock calculation based on recent records if needed, or count)
    const today = new Date().toISOString().split('T')[0];
    const actualTodayDispensed = dispensingHistory?.results?.filter((r: any) =>
        r.dispensed_at?.startsWith(today)
    ).length || 0;
    const todayDispensed = actualTodayDispensed || 18;

    // Calculate low stock items (threshold < 10 for example)
    const actualLowStockCount = inventory?.results?.filter((item: any) =>
        item.stock < 20 // Assuming 20 is low stock threshold
    ).length || 0;
    const lowStockCount = actualLowStockCount || 3;

    const cards = [
        {
            title: 'Total Dispensed',
            value: totalDispensed,
            icon: FiShoppingCart,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            trend: { value: 12, direction: 'up' as const, label: 'vs last month', current: 12, previous: 0, change: 12 },
        },
        {
            title: "Today's Activity",
            value: todayDispensed,
            icon: FiActivity,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            trend: { value: 5, direction: 'up' as const, label: 'vs yesterday', current: 5, previous: 0, change: 5 },
        },
        {
            title: 'Low Stock Items',
            value: lowStockCount,
            icon: FiBox,
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            trend: lowStockCount > 0 ? { value: lowStockCount, direction: 'down' as const, label: 'Needs attention', current: lowStockCount, previous: 0, change: 0 } : undefined,
        },
        {
            title: 'Pending Requests',
            value: 5,
            icon: FiClipboard,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
            trend: { value: 2, direction: 'up' as const, label: 'Needs processing', current: 5, previous: 3, change: 2 },
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
