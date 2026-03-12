'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import {
  FiCheckCircle,
  FiXCircle,
  FiShield,
  FiPackage,
  FiUser,
  FiCalendar,
  FiLoader,
  FiSearch,
} from 'react-icons/fi';
import type { Prescription, PrescriptionMedicine } from '@/types';

interface VerifyResult {
  verified: boolean;
  prescription: Prescription;
}

export default function VerifyPrescriptionPage() {
  const searchParams = useSearchParams();
  const [qrInput, setQrInput] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-verify if URL has params
  useEffect(() => {
    const id = searchParams.get('id');
    const hash = searchParams.get('hash');
    if (id && hash) {
      verifyPrescription(id, hash);
    }
    // Also check for combined data param (from QR scan)
    const data = searchParams.get('data');
    if (data && data.includes('|')) {
      const [prescId, prescHash] = data.split('|', 2);
      if (prescId && prescHash) {
        verifyPrescription(prescId, prescHash);
      }
    }
  }, [searchParams]);

  const verifyPrescription = async (prescriptionId: string, hash: string) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.prescriptions.verifyQR(prescriptionId, hash) as VerifyResult;
      setResult(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerify = () => {
    const trimmed = qrInput.trim();
    if (!trimmed) return;
    if (trimmed.includes('|')) {
      const [id, hash] = trimmed.split('|', 2);
      if (id && hash) {
        verifyPrescription(id, hash);
        return;
      }
    }
    setError('Invalid format. Expected: prescription_id|security_hash');
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Active', className: 'bg-blue-100 text-blue-700' };
      case 'partially_dispensed':
        return { label: 'Partially Dispensed', className: 'bg-amber-100 text-amber-700' };
      case 'fully_dispensed':
        return { label: 'Fully Dispensed', className: 'bg-emerald-100 text-emerald-700' };
      default:
        return { label: status, className: 'bg-slate-100 text-slate-700' };
    }
  };

  const getDispenseConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'dispensed':
        return { label: 'Dispensed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'unavailable':
        return { label: 'Unavailable', className: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'patient_has':
        return { label: 'Patient Has', className: 'bg-slate-50 text-slate-700 border-slate-200' };
      default:
        return { label: status, className: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-blue-100 p-4 rounded-full mb-4">
            <FiShield className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Verify Prescription</h1>
          <p className="text-slate-500 mt-2">
            Scan a prescription QR code or enter the verification data to check authenticity
          </p>
        </div>

        {/* Manual Input */}
        {!result && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter QR data (prescription_id|hash)"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualVerify()}
                  className="flex-1"
                />
                <Button onClick={handleManualVerify} disabled={loading || !qrInput.trim()}>
                  {loading ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiSearch className="h-4 w-4" />
                  )}
                  <span className="ml-2">Verify</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <FiLoader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Verifying prescription...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 py-6">
              <FiXCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-800">Verification Failed</h3>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Result */}
        {result && (
          <div className="space-y-6">
            {/* Verified Badge */}
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="flex items-center gap-3 py-6">
                <FiCheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-emerald-800">Prescription Verified</h3>
                  <p className="text-emerald-600 text-sm">
                    This prescription is authentic and has not been tampered with.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Prescription Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FiPackage className="h-5 w-5 text-blue-600" />
                    Prescription Details
                  </CardTitle>
                  <Badge className={getStatusConfig(result.prescription.status).className}>
                    {getStatusConfig(result.prescription.status).label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Patient</p>
                    <p className="text-slate-900 flex items-center gap-1 mt-1">
                      <FiUser className="h-4 w-4 text-slate-400" />
                      {result.prescription.patient_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Doctor</p>
                    <p className="text-slate-900 mt-1">
                      {result.prescription.doctor_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Date</p>
                    <p className="text-slate-900 flex items-center gap-1 mt-1">
                      <FiCalendar className="h-4 w-4 text-slate-400" />
                      {new Date(result.prescription.created_at).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Medicines */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Prescribed Medicines</h4>
                  <div className="space-y-3">
                    {result.prescription.medicines?.map((med: PrescriptionMedicine, idx: number) => {
                      const dispense = getDispenseConfig(med.dispense_status);
                      return (
                        <div
                          key={med.id || idx}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {med.medicine_name || (typeof med.medicine === 'string' ? med.medicine : 'Medicine')}
                            </p>
                            {med.medicine_generic && (
                              <p className="text-xs text-slate-500">{med.medicine_generic}</p>
                            )}
                            <p className="text-sm text-slate-600 mt-1">
                              {med.dosage} &middot; {med.frequency} &middot; {med.duration_days} days
                            </p>
                            {med.special_instructions && (
                              <p className="text-xs text-slate-500 mt-1 italic">{med.special_instructions}</p>
                            )}
                          </div>
                          <Badge className={`${dispense.className} border`}>
                            {dispense.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verify Another */}
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setError('');
                  setQrInput('');
                }}
              >
                Verify Another Prescription
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
