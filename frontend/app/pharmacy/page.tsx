'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/components/auth/withAuth';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { PharmacyKPIGrid } from '@/components/dashboard/pharmacy/PharmacyKPIGrid';
import { PharmacyTrends } from '@/components/dashboard/pharmacy/PharmacyTrends';
import { RecentDispensing } from '@/components/dashboard/pharmacy/RecentDispensing';
import { FiSearch, FiBox } from 'react-icons/fi';

function PharmacyDashboard() {
    const router = useRouter();

    return (
        <div className="space-y-6">
            <DashboardHeader />

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => router.push('/pharmacy/scan')}
                    className="p-4 bg-gradient-to-r from-primary to-emerald-600 rounded-xl text-white shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-between group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-card/20 rounded-lg">
                            <FiSearch className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-lg">Scan Prescription</h3>
                            <p className="text-white/75 text-sm">Process new patient request</p>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => router.push('/pharmacy/inventory')}
                    className="p-4 bg-card border border-border rounded-xl text-foreground shadow-sm hover:border-primary/30 transition-all flex items-center justify-between group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-50 rounded-lg">
                            <FiBox className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-lg">Inventory Management</h3>
                            <p className="text-muted-foreground text-sm">Update stock levels & prices</p>
                        </div>
                    </div>
                </button>
            </div>

            <PharmacyKPIGrid />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PharmacyTrends />
                </div>
                <div>
                    <RecentDispensing />
                </div>
            </div>
        </div>
    );
}

export default withAuth(PharmacyDashboard, ['pharmacist']);

