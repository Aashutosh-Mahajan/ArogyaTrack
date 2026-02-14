'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { MyPatient } from '@/types';
import toast from 'react-hot-toast';
import { FiSave, FiUser, FiFileText, FiCheckCircle, FiUpload, FiX } from 'react-icons/fi';

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'follow_up', label: 'Follow-up Required' },
  { value: 'critical', label: 'Critical' },
];

function AddRecordPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [testsPerformed, setTestsPerformed] = useState('');
  const [prescription, setPrescription] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [visitStatus, setVisitStatus] = useState('completed');
  const [labFile, setLabFile] = useState<File | null>(null);
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [submitted, setSubmitted] = useState(false);

  const { data: patientsData, isLoading: loadingPatients } = useQuery({
    queryKey: ['myPatients'],
    queryFn: async () => {
      const response = await api.medical.getMyPatients();
      return response as { count: number; results: MyPatient[] };
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.medical.createVisitRecord(selectedPatient, data),
    onSuccess: () => {
      toast.success('Visit record created successfully!');
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['doctor-recent-records'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-recent-activity'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create record');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!diagnosis.trim()) {
      toast.error('Diagnosis is required');
      return;
    }

    // Include status in doctor_notes so backend can reference it
    const statusLabel =
      STATUS_OPTIONS.find((s) => s.value === visitStatus)?.label ?? visitStatus;
    const notesWithStatus = [
      doctorNotes.trim(),
      `[Status: ${statusLabel}]`,
    ]
      .filter(Boolean)
      .join('\n');

    createMutation.mutate({
      diagnosis: diagnosis.trim(),
      tests_performed: testsPerformed.trim(),
      prescription: prescription.trim(),
      doctor_notes: notesWithStatus,
      visit_date: new Date(visitDate).toISOString(),
    });
  };

  const resetForm = () => {
    setSelectedPatient('');
    setDiagnosis('');
    setTestsPerformed('');
    setPrescription('');
    setDoctorNotes('');
    setVisitStatus('completed');
    setLabFile(null);
    setVisitDate(new Date().toISOString().slice(0, 16));
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-12 text-center space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-10">
            <FiCheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Record Created Successfully!
            </h2>
            <p className="text-gray-600 mb-6">
              The visit record has been saved to the patient&apos;s file.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={resetForm} variant="default" size="lg">
                <FiFileText className="mr-2 h-4 w-4" />
                Create Another Record
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Add / Update Record
          </h1>
          <p className="text-gray-600 mt-1">
            Create a new consultation or visit record for a patient
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FiUser className="h-5 w-5" />
                Patient &amp; Visit Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Patient selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Patient <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  required
                >
                  <option value="">
                    {loadingPatients
                      ? 'Loading patients…'
                      : '-- Choose a patient --'}
                  </option>
                  {patientsData?.results?.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.name} ({p.unique_patient_id}) – {p.age} yrs, {p.gender}
                    </option>
                  ))}
                </select>
                {patientsData?.count === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No patients in your list. Scan a QR code first.
                  </p>
                )}
              </div>

              {/* Visit date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visit Date &amp; Time
                </label>
                <Input
                  type="datetime-local"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                />
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnosis <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Upper respiratory tract infection, mild dehydration…"
                  required
                />
              </div>

              {/* Prescription */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prescription
                </label>
                <textarea
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Tab Paracetamol 500 mg – 1 TDS × 5 days…"
                />
              </div>

              {/* Status Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={visitStatus}
                  onChange={(e) => setVisitStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tests Performed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tests Performed
                </label>
                <textarea
                  value={testsPerformed}
                  onChange={(e) => setTestsPerformed(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. CBC, Chest X-ray, Blood sugar (fasting)…"
                />
              </div>

              {/* Upload Lab File (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Lab Report (optional)
                </label>
                {labFile ? (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-4 py-2.5 bg-gray-50">
                    <FiFileText className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-gray-700 flex-1 truncate">
                      {labFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLabFile(null)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <FiUpload className="h-5 w-5" />
                    Click to upload PDF or image
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setLabFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Doctor Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor Notes
                </label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any additional clinical notes, follow-up instructions…"
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={
                    createMutation.isPending ||
                    !selectedPatient ||
                    !diagnosis.trim()
                  }
                >
                  {createMutation.isPending ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Saving…
                    </>
                  ) : (
                    <>
                      <FiSave className="mr-2 h-5 w-5" />
                      Save Visit Record
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AddRecordPage, ['doctor']);
