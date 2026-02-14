'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { FiCamera, FiUsers, FiFileText, FiActivity } from 'react-icons/fi';
import Link from 'next/link';

function DoctorDashboard() {
  const { data: recentRecords } = useQuery({
    queryKey: ['doctor-recent-records'],
    queryFn: () => api.medical.getRecords({ limit: 5 }),
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['doctor-prescriptions'],
    queryFn: () => api.prescriptions.getAll({ limit: 5 }),
  });

  const stats = [
    {
      title: 'Patients Today',
      value: recentRecords?.count || 0,
      icon: FiUsers,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Prescriptions',
      value: prescriptions?.count || 0,
      icon: FiFileText,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Medical Records',
      value: recentRecords?.results?.length || 0,
      icon: FiActivity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Manage your patients and consultations
          </p>
        </div>

        {/* Quick Action - Scan QR */}
        <Card className="border-primary-200 bg-gradient-primary text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Scan Patient QR Code</h3>
                <p className="text-primary-100 mb-4">
                  Quickly access patient medical records by scanning their health card
                </p>
                <Link href="/doctor/scan-qr">
                  <Button variant="secondary" size="lg">
                    <FiCamera className="mr-2" />
                    Start Scanner
                  </Button>
                </Link>
              </div>
              <FiCamera className="h-24 w-24 opacity-20" />
            </div>
          </CardContent>
        </Card>

        {/* My Patients */}
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">My Patients</h3>
                <p className="text-gray-600 mb-4">
                  View and manage your patient list, create consultation records
                </p>
                <Link href="/doctor/my-patients">
                  <Button className="bg-green-600 hover:bg-green-700" size="lg">
                    <FiUsers className="mr-2" />
                    View My Patients
                  </Button>
                </Link>
              </div>
              <FiUsers className="h-24 w-24 opacity-20 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat, index) => (
            <Card key={index}>
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
          ))}
        </div>

        {/* Recent Consultations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Consultations</CardTitle>
              <Link 
                href="/doctor/patients"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentRecords?.results && recentRecords.results.length > 0 ? (
              <div className="space-y-4">
                {recentRecords.results.map((record: any) => (
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
                        Patient ID: {record.profile}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(record.visit_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No consultations yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(DoctorDashboard, ['doctor']);
