'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { PaginatedResponse, Prescription, PrescriptionMedicine } from '@/types';
import {
  FiFileText, FiCalendar, FiChevronDown, FiChevronUp,
  FiPackage, FiClock, FiCheckCircle, FiAlertCircle,
} from 'react-icons/fi';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  pending: { label: 'Active', variant: 'warning' },
  partially_dispensed: { label: 'Partially Dispensed', variant: 'default' },
  fully_dispensed: { label: 'Completed', variant: 'success' },
};

const dispenseConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' | 'default' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  dispensed: { label: 'Dispensed', variant: 'success' },
  unavailable: { label: 'Unavailable', variant: 'secondary' },
  patient_has: { label: 'Patient Has', variant: 'default' },
};

function PrescriptionsPage(): React.JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<PaginatedResponse<Prescription>>({
    queryKey: ['prescriptions-all'],
    queryFn: () => api.prescriptions.getAll({ limit: 50 }),
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const prescriptions = data?.results || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Prescriptions</h1>
          <p className="mt-1 text-sm text-gray-500">View all your prescriptions and medication details.</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Prescriptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} on file
        </p>
      </div>

      {prescriptions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <FiFileText className="mx-auto h-10 w-10 mb-3 text-gray-400" />
            <p className="text-lg font-medium">No prescriptions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => {
            const isExpanded = expanded.has(rx.id);
            const cfg = statusConfig[rx.status] || statusConfig.pending;
            return (
              <Card key={rx.id}>
                <CardHeader
                  className="cursor-pointer hover:bg-gray-50 transition rounded-t-lg"
                  onClick={() => toggle(rx.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${rx.status === 'pending' ? 'bg-blue-100' : 'bg-green-100'}`}>
                        <FiFileText className={`h-5 w-5 ${rx.status === 'pending' ? 'text-blue-600' : 'text-green-600'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          Prescription
                        </CardTitle>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FiCalendar className="h-3 w-3" />
                            {formatDate(rx.created_at)}
                          </span>
                          {rx.doctor_name && (
                            <span>by {rx.doctor_name}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <FiPackage className="h-3 w-3" />
                            {rx.medicines.length} medicine{rx.medicines.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {isExpanded ? <FiChevronUp className="h-4 w-4 text-gray-400" /> : <FiChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t">
                    <div className="divide-y">
                      {rx.medicines.map((pm: PrescriptionMedicine) => {
                        const dc = dispenseConfig[pm.dispense_status] || dispenseConfig.pending;
                        return (
                          <div key={pm.id} className="py-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {pm.medicine_name || (typeof pm.medicine === 'object' ? pm.medicine.name : pm.medicine)}
                              </p>
                              {pm.medicine_generic && (
                                <p className="text-xs text-gray-500">{pm.medicine_generic}</p>
                              )}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
                                <span className="flex items-center gap-1"><FiPackage className="h-3 w-3" />{pm.dosage}</span>
                                <span className="flex items-center gap-1"><FiClock className="h-3 w-3" />{pm.frequency}</span>
                                <span>{pm.duration_days} days</span>
                                <span>Qty: {pm.quantity}</span>
                              </div>
                              {pm.special_instructions && (
                                <p className="text-xs text-amber-600 mt-1">Note: {pm.special_instructions}</p>
                              )}
                            </div>
                            <Badge variant={dc.variant}>{dc.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>

  );
}

export default withAuth(PrescriptionsPage, ['patient']);
