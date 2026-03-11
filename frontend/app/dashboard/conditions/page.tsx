'use client';

import React from 'react';
import { CurrentDiseases } from '@/components/dashboard/CurrentDiseases';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

export default function ConditionsPage() {
    return (
        <div className="space-y-6">
            <DashboardHeader
                title="My Conditions"
                subtitle="Manage and monitor your chronic conditions and current health status."
            />

            <CurrentDiseases />
        </div>
    );
}
