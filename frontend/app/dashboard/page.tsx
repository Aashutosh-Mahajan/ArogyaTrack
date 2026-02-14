'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { RecentRecords } from '@/components/dashboard/RecentRecords';
import { LabMonitoring } from '@/components/dashboard/LabMonitoring';
import { HealthTrends } from '@/components/dashboard/HealthTrends';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { api } from '@/lib/api';
import type { PaginatedResponse, Prescription } from '@/types';
import { FiFileText } from 'react-icons/fi';
import Link from 'next/link';

function PatientDashboard(): React.JSX.Element {
  const { data: prescriptions } = useQuery<PaginatedResponse<Prescription>>({
    queryKey: ['prescriptions'],
    queryFn: () => api.prescriptions.getAll({ limit: 5 }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome & Health Snapshot */}
        <DashboardHeader />

        {/* KPI Summary Cards */}
        <KPIGrid />

        {/* Recent Medical Records */}
        <RecentRecords />

        {/* Lab & Test Monitoring */}
        <LabMonitoring />

        {/* Health Trends */}
        <HealthTrends />

        {/* Alerts & Risk Monitoring */}
        <AlertsPanel />

        {/* Active Prescriptions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Prescriptions</CardTitle>
              <Link 
                href="/dashboard/prescriptions"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {prescriptions?.results && prescriptions.results.length > 0 ? (
              <div className="space-y-3">
                {prescriptions.results.slice(0, 3).map((prescription) => (
                  <div 
                    key={prescription.id}
                    className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-gray-50 transition"
                  >
                    <div className="bg-green-100 p-2 rounded-lg">
                      <FiFileText className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        Prescription #{prescription.prescription_number}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {prescription.medicines.length} medicine(s)
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Issued: {new Date(prescription.issued_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      {prescription.is_dispensed ? (
                        <span className="px-2 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-full">
                          Dispensed
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium text-yellow-600 bg-yellow-100 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiFileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No prescriptions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(PatientDashboard, ['patient']);
