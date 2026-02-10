'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { PaginatedResponse, MedicalRecord, Allergy, ChronicCondition } from '@/types';
import { FiActivity, FiCalendar, FiUser } from 'react-icons/fi';
import { formatDate } from '@/lib/utils';

function MedicalRecordsPage(): React.JSX.Element {
  const { data: records, isLoading } = useQuery<PaginatedResponse<MedicalRecord>>({
    queryKey: ['medical-records-all'],
    queryFn: () => api.medical.getRecords(),
  });

  const { data: allergies } = useQuery<Allergy[]>({
    queryKey: ['allergies'],
    queryFn: () => api.medical.getAllergies(),
  });

  const { data: chronicConditions } = useQuery<ChronicCondition[]>({
    queryKey: ['chronic-conditions'],
    queryFn: () => api.medical.getChronicConditions(),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Medical Records</h1>
          <p className="text-gray-600 mt-1">
            Complete history of your medical consultations
          </p>
        </div>

        {/* Allergies & Chronic Conditions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Allergies</CardTitle>
            </CardHeader>
            <CardContent>
              {allergies && allergies.length > 0 ? (
                <div className="space-y-2">
                  {allergies.map((allergy) => (
                    <div 
                      key={allergy.id}
                      className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{allergy.allergen}</p>
                        <p className="text-sm text-gray-600">{allergy.reaction}</p>
                      </div>
                      <Badge variant={
                        allergy.severity === 'severe' ? 'destructive' :
                        allergy.severity === 'moderate' ? 'warning' : 'secondary'
                      }>
                        {allergy.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No allergies recorded</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Chronic Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              {chronicConditions && chronicConditions.length > 0 ? (
                <div className="space-y-2">
                  {chronicConditions.map((condition) => (
                    <div 
                      key={condition.id}
                      className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{condition.condition_name}</p>
                        <p className="text-xs text-gray-500">
                          Since {formatDate(condition.diagnosed_date)}
                        </p>
                      </div>
                      <Badge variant={
                        condition.status === 'active' ? 'destructive' :
                        condition.status === 'controlled' ? 'warning' : 'success'
                      }>
                        {condition.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No chronic conditions recorded</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Medical Records List */}
        <Card>
          <CardHeader>
            <CardTitle>Consultation History</CardTitle>
          </CardHeader>
          <CardContent>
            {records?.results && records.results.length > 0 ? (
              <div className="space-y-4">
                {records.results.map((record) => (
                  <div 
                    key={record.id}
                    className="border rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <FiActivity className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{record.diagnosis}</p>
                          <div className="flex items-center space-x-2 mt-1 text-sm text-gray-600">
                            <FiUser className="h-4 w-4" />
                            <span>Dr. {record.doctor_name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <FiCalendar className="h-4 w-4" />
                        <span>{formatDate(record.visit_date)}</span>
                      </div>
                    </div>

                    {record.symptoms && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-gray-700">Symptoms:</p>
                        <p className="text-sm text-gray-600">{record.symptoms}</p>
                      </div>
                    )}

                    {record.notes && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Notes:</p>
                        <p className="text-sm text-gray-600">{record.notes}</p>
                      </div>
                    )}

                    {record.diagnoses && record.diagnoses.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {record.diagnoses.map((diagnosis: any) => (
                          <Badge key={diagnosis.id} variant="outline">
                            {diagnosis.disease_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiActivity className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No medical records found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(MedicalRecordsPage, ['patient']);
