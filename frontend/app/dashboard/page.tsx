'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { PaginatedResponse, MedicalRecord, Prescription, AdherenceTracker } from '@/types';
import { FiActivity, FiFileText, FiShoppingBag, FiHeart, FiAlertCircle } from 'react-icons/fi';
import Link from 'next/link';

function PatientDashboard(): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.patients.getProfile(),
  });

  const { data: medicalRecords } = useQuery<PaginatedResponse<MedicalRecord>>({
    queryKey: ['medical-records'],
    queryFn: () => api.medical.getRecords({ limit: 5 }),
  });

  const { data: prescriptions } = useQuery<PaginatedResponse<Prescription>>({
    queryKey: ['prescriptions'],
    queryFn: () => api.prescriptions.getAll({ limit: 5 }),
  });

  const { data: adherenceTrackers } = useQuery<PaginatedResponse<AdherenceTracker>>({
    queryKey: ['adherence'],
    queryFn: () => api.adherence.getTrackers(),
  });

  const stats = [
    {
      title: 'Medical Records',
      value: medicalRecords?.count || 0,
      icon: FiActivity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      href: '/dashboard/medical-records',
    },
    {
      title: 'Prescriptions',
      value: prescriptions?.count || 0,
      icon: FiFileText,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      href: '/dashboard/prescriptions',
    },
    {
      title: 'Active Medicines',
      value: adherenceTrackers?.results?.filter((t) => t.status === 'active').length || 0,
      icon: FiShoppingBag,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      href: '/dashboard/medicines',
    },
    {
      title: 'Adherence Rate',
      value: adherenceTrackers?.results?.[0]?.adherence_percentage 
        ? `${Math.round(adherenceTrackers.results[0].adherence_percentage)}%` 
        : '0%',
      icon: FiHeart,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      href: '/dashboard/adherence',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.first_name}!
          </h1>
          <p className="text-gray-600 mt-1">
            Here's an overview of your health information
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Link key={index} href={stat.href}>
              <Card className="card-hover cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold mt-2">
                        {stat.value}
                      </p>
                    </div>
                    <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent Medical Records */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Medical Records</CardTitle>
              <Link 
                href="/dashboard/medical-records"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {medicalRecords?.results && medicalRecords.results.length > 0 ? (
              <div className="space-y-3">
                {medicalRecords.results.slice(0, 5).map((record) => (
                  <div 
                    key={record.id}
                    className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-gray-50 transition"
                  >
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <FiActivity className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{record.diagnosis}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Dr. {record.doctor_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(record.visit_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiAlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No medical records yet</p>
              </div>
            )}
          </CardContent>
        </Card>

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
