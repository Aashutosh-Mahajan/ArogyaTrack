'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PaginatedResponse, MedicalRecord, Allergy, ChronicCondition } from '@/types';
import { FiActivity, FiCalendar, FiChevronDown, FiChevronUp, FiDownload, FiFileText, FiRefreshCw } from 'react-icons/fi';
import { formatDate } from '@/lib/utils';

function MedicalRecordsPage(): React.JSX.Element {
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());

  const { data: records, isLoading, refetch, isFetching } = useQuery<PaginatedResponse<MedicalRecord>>({
    queryKey: ['medical-records-all'],
    queryFn: () => api.medical.getRecords(),
    refetchInterval: 30000, // Refetch every 30 seconds to catch new records
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const { data: allergies } = useQuery<Allergy[]>({
    queryKey: ['allergies'],
    queryFn: () => api.medical.getAllergies(),
  });

  const { data: chronicConditions } = useQuery<ChronicCondition[]>({
    queryKey: ['chronic-conditions'],
    queryFn: () => api.medical.getChronicConditions(),
  });

  const toggleRecord = (recordId: number) => {
    setExpandedRecords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  // Fix doctor name display (remove duplicate "Dr.")
  const formatDoctorName = (name: string) => {
    if (!name) return '';
    // Remove duplicate "Dr." if it exists
    return name.replace(/^Dr\.\s*Dr\.\s*/i, 'Dr. ').trim();
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Medical Records</h1>
            <p className="text-gray-600 mt-1">
              Complete history of your medical consultations
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
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
              <div className="space-y-3">
                {records.results.map((record) => {
                  const isExpanded = expandedRecords.has(record.id);
                  return (
                    <div 
                      key={record.id}
                      className="border rounded-lg overflow-hidden hover:shadow-md transition"
                    >
                      {/* Collapsed Header View */}
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 transition"
                        onClick={() => toggleRecord(record.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="bg-blue-100 p-2 rounded-lg">
                              <FiActivity className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <p className="font-semibold text-gray-900">
                                  {formatDoctorName(record.doctor_name)}
                                </p>
                                <Badge variant="outline">{record.department}</Badge>
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-1">
                                {record.diagnosis}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 ml-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <FiCalendar className="h-4 w-4" />
                              <span>{formatDate(record.visit_date)}</span>
                            </div>
                            {isExpanded ? (
                              <FiChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <FiChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Detail View */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50 p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Department:</p>
                              <p className="text-sm text-gray-900">{record.department}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Diagnosis:</p>
                              <p className="text-sm text-gray-900">{record.diagnosis}</p>
                            </div>
                          </div>

                          {record.tests_performed && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Tests Performed:</p>
                              <p className="text-sm text-gray-900 whitespace-pre-line bg-white p-3 rounded border">
                                {record.tests_performed}
                              </p>
                            </div>
                          )}

                          {record.prescription && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Prescription:</p>
                              <p className="text-sm text-gray-900 whitespace-pre-line bg-white p-3 rounded border">
                                {record.prescription}
                              </p>
                            </div>
                          )}

                          {record.doctor_notes && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1 flex items-center space-x-2">
                                <FiFileText className="h-4 w-4" />
                                <span>Doctor&apos;s Notes:</span>
                              </p>
                              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                                <p className="text-sm text-gray-900 whitespace-pre-line">
                                  {record.doctor_notes}
                                </p>
                              </div>
                            </div>
                          )}

                          {record.report_attachments && record.report_attachments.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Attached Reports ({record.report_attachments.length})
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {record.report_attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow transition group"
                                  >
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                      <div className="bg-blue-100 p-2 rounded group-hover:bg-blue-200 transition">
                                        <FiFileText className="h-4 w-4 text-blue-600" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {attachment.file_name}
                                        </p>
                                        {attachment.file_type && (
                                          <p className="text-xs text-gray-500">{attachment.file_type}</p>
                                        )}
                                      </div>
                                    </div>
                                    <FiDownload className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition flex-shrink-0 ml-2" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
