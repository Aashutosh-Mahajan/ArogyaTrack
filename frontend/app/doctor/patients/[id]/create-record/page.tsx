'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { MyPatient } from '@/types';
import toast from 'react-hot-toast';
import { FiSave, FiUser, FiFileText, FiCheckCircle, FiUpload, FiX, FiFile, FiCalendar, FiActivity, FiEdit3, FiArrowLeft } from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_REPORT_FILES = 5;

function CreatePatientRecordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [diagnosis, setDiagnosis] = useState('');
  const [testsPerformed, setTestsPerformed] = useState('');
  const [prescription, setPrescription] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [visitStatus, setVisitStatus] = useState('completed');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [submitted, setSubmitted] = useState(false);

  const STATUS_OPTIONS = [
    { value: 'completed', label: t('status_completed') },
    { value: 'follow_up', label: t('status_follow_up') },
    { value: 'critical', label: t('status_critical') },
  ];

  // Fetch patient details to show in header
  const { data: patientsData, isLoading: loadingPatient } = useQuery({
    queryKey: ['myPatients'],
    queryFn: async () => {
      const response = await api.medical.getMyPatients();
      return response as { count: number; results: MyPatient[] };
    },
  });

  const patient = patientsData?.results?.find(p => p.patient_id === patientId);

  const createMutation = useMutation({
    mutationFn: (payload: { data: Record<string, string>; files: File[] }) =>
      api.medical.createVisitRecord(patientId, payload.data, payload.files),
    onSuccess: () => {
      toast.success(t('record_saved_success'));
      setSubmitted(true);
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['doctor-recent-records'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['patient-records', patientId] }); // Specific for this patient
      queryClient.invalidateQueries({ queryKey: ['visit-records-list'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || t('failed_load'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      toast.error(t('diagnosis') + ' is required');
      return;
    }

    const statusLabel =
      STATUS_OPTIONS.find((s) => s.value === visitStatus)?.label ?? visitStatus;
    const notesWithStatus = [
      doctorNotes.trim(),
      `[Status: ${statusLabel}]`,
    ]
      .filter(Boolean)
      .join('\n');

    createMutation.mutate({
      data: {
        diagnosis: diagnosis.trim(),
        tests_performed: testsPerformed.trim(),
        prescription: prescription.trim(),
        doctor_notes: notesWithStatus,
        visit_date: new Date(visitDate).toISOString(),
      },
      files: reportFiles,
    });
  };

  const handleBackToPatient = () => {
    router.push(`/doctor/patients/${patientId}`);
  };

  if (loadingPatient) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-12 text-center space-y-6">
          <Card className="bg-emerald-50/50 border border-emerald-100 shadow-xl shadow-emerald-50/50 backdrop-blur-md">
            <CardContent className="p-12">
              <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <FiCheckCircle className="h-12 w-12 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                {t('record_saved_success')}
              </h2>
              <p className="text-slate-600 mb-8 max-w-md mx-auto text-lg">
                {t('record_saved_desc')}
              </p>
              <div className="flex justify-center gap-4">
                <Button onClick={handleBackToPatient} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200">
                  <FiFileText className="mr-2 h-5 w-5" />
                  {t('patient_history')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="text-center sm:text-left flex flex-col sm:flex-row items-center gap-4">
          <Button variant="ghost" className="shrink-0" onClick={handleBackToPatient}>
            <FiArrowLeft className="h-6 w-6 text-slate-500" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <FiEdit3 className="h-8 w-8" />
              </span>
              {t('add_record_title')}
            </h1>
            <p className="text-slate-500 mt-2 text-lg">
              {patient ? `${patient.name} (${patient.unique_patient_id})` : t('add_record_subtitle')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-8">
            {/* Date Section (Patient is fixed) */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                  <FiCalendar className="h-5 w-5 text-blue-500" />
                  {t('visit_details')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">
                    {t('visit_date')}
                  </label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="datetime-local"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Details */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                  <FiActivity className="h-5 w-5 text-emerald-500" />
                  Clinical Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">
                    {t('diagnosis')} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                    placeholder="e.g. Acute Viral Fever"
                    required
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 block">
                      {t('prescription')}
                    </label>
                    <textarea
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                      placeholder="e.g. Tab Paracetamol 500mg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 block">
                      {t('tests_performed')}
                    </label>
                    <textarea
                      value={testsPerformed}
                      onChange={(e) => setTestsPerformed(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                      placeholder="e.g. CBC, Widal"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">
                    {t('doctor_notes')}
                  </label>
                  <textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                    placeholder="Additional observation notes..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">
                    {t('status')}
                  </label>
                  <div className="relative">
                    <select
                      value={visitStatus}
                      onChange={(e) => setVisitStatus(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all appearance-none"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" /> </svg>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                  <FiFileText className="h-5 w-5 text-purple-500" />
                  {t('upload_reports')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {reportFiles.length > 0 && (
                  <div className="grid gap-3 mb-4 sm:grid-cols-2">
                    {reportFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 transition-all hover:border-purple-200 hover:bg-purple-50/50"
                      >
                        <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiFile className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setReportFiles((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors"
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {reportFiles.length < MAX_REPORT_FILES && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-8 transition-all hover:border-purple-400 hover:bg-purple-50/30 flex flex-col items-center justify-center text-center space-y-3"
                  >
                    <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                      <FiUpload className="h-6 w-6 text-slate-400 group-hover:text-purple-600" />
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium group-hover:text-purple-700 transition-colors">
                        {reportFiles.length === 0 ? t('click_upload') : t('add_more_files')}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {t('upload_reports_desc')}
                      </p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const valid: File[] = [];
                    files.forEach(file => {
                      if (ALLOWED_FILE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE) {
                        valid.push(file);
                      } else {
                        toast.error(
                          !ALLOWED_FILE_TYPES.includes(file.type) ? `Invalid Type: ${file.name}` : `Too Large: ${file.name}`
                        );
                      }
                    });
                    setReportFiles(prev => [...prev, ...valid].slice(0, MAX_REPORT_FILES));
                    e.target.value = '';
                  }}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="pt-4 pb-12">
              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={createMutation.isPending || !diagnosis.trim()}
              >
                {createMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2 h-5 w-5" />
                    {t('save_record')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(CreatePatientRecordPage, ['doctor']);
