'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Medicine, MyPatient } from '@/types';
import toast from 'react-hot-toast';
import {
  FiSave,
  FiUser,
  FiFileText,
  FiCheckCircle,
  FiUpload,
  FiX,
  FiFile,
  FiCalendar,
  FiActivity,
  FiEdit3,
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiShield,
  FiAlertTriangle,
  FiAlertCircle,
  FiSearch,
  FiLoader,
  FiPackage,
  FiSend,
} from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';

/* ──────────────── constants ──────────────── */
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REPORT_FILES = 5;

/* ──────────────── types ──────────────── */
interface MedicineEntry {
  medicine: Medicine | null;
  dosage: string;
  frequency: string;
  duration_days: number;
  quantity: number;
  special_instructions: string;
}

interface AgentMedicineReport {
  medicine_name: string;
  allergy_conflict: boolean;
  allergy_detail: string;
  dosage_status: string;
  dosage_detail: string;
  stock_status: string;
  stock_detail: string;
  recommendation: string;
}

interface AgentInteraction {
  medicine_a: string;
  medicine_b: string;
  severity: string;
  detail: string;
}

interface AgentAlternative {
  replaces: string;
  suggested_alternative: string;
  reason: string;
}

interface AgentReport {
  overall_status: 'safe' | 'warning' | 'blocked';
  medicines: AgentMedicineReport[];
  drug_interactions: AgentInteraction[];
  alternatives: AgentAlternative[];
  summary: string;
  agent_unavailable?: boolean;
}

/* ──────────────── helpers ──────────────── */
const emptyEntry = (): MedicineEntry => ({
  medicine: null,
  dosage: '',
  frequency: '',
  duration_days: 7,
  quantity: 1,
  special_instructions: '',
});

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  safe: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-600' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-500' },
  blocked: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-600' },
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-slate-100 text-slate-700',
  moderate: 'bg-amber-100 text-amber-800',
  major: 'bg-orange-100 text-orange-800',
  contraindicated: 'bg-rose-100 text-rose-800',
};

/* ──────────────── component ──────────────── */
function CreateConsultationPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Visit record state ── */
  const [diagnosis, setDiagnosis] = useState('');
  const [testsPerformed, setTestsPerformed] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [visitStatus, setVisitStatus] = useState('completed');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 16));

  /* ── Prescription state ── */
  const [includePrescription, setIncludePrescription] = useState(false);
  const [medicines, setMedicines] = useState<MedicineEntry[]>([emptyEntry()]);
  const [searchTerms, setSearchTerms] = useState<string[]>(['']);
  const [activeSearch, setActiveSearch] = useState<number | null>(null);
  const [agentReport, setAgentReport] = useState<AgentReport | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>('');
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const STATUS_OPTIONS = [
    { value: 'completed', label: t('status_completed') },
    { value: 'follow_up', label: t('status_follow_up') },
    { value: 'critical', label: t('status_critical') },
  ];

  /* ── Queries ── */
  const { data: patientsData, isLoading: loadingPatient } = useQuery({
    queryKey: ['myPatients'],
    queryFn: async () => {
      const response = await api.medical.getMyPatients();
      return response as { count: number; results: MyPatient[] };
    },
  });
  const patient = patientsData?.results?.find((p) => p.patient_id === patientId);

  const { data: pharmacyList } = useQuery({
    queryKey: ['pharmacy-list', pharmacySearch],
    queryFn: async () => {
      const res = await api.pharmacy.list(pharmacySearch ? { search: pharmacySearch } : undefined);
      return res as { id: string; name: string; address: string; phone: string }[];
    },
    enabled: includePrescription,
  });
  const selectedPharmacy = pharmacyList?.find((p) => p.id === selectedPharmacyId);

  const { data: searchResults } = useQuery({
    queryKey: ['medicine-search', searchTerms[activeSearch ?? -1]],
    queryFn: () => api.prescriptions.getMedicines({ search: searchTerms[activeSearch ?? 0] }),
    enabled: activeSearch !== null && (searchTerms[activeSearch] ?? '').length >= 2,
  });

  /* ── AI Validation ── */
  const validateMutation = useMutation({
    mutationFn: (payload: any) => api.prescriptions.validate(payload),
    onSuccess: (data: any) => setAgentReport(data as AgentReport),
    onError: () => {
      toast.error('Validation service unavailable. You may proceed manually.');
      setAgentReport({
        overall_status: 'warning',
        medicines: [],
        drug_interactions: [],
        alternatives: [],
        summary: 'Automated validation was unavailable. Please review the prescription manually.',
        agent_unavailable: true,
      });
    },
  });

  /* ── Medicine handlers ── */
  const addMedicineRow = () => {
    setMedicines((prev) => [...prev, emptyEntry()]);
    setSearchTerms((prev) => [...prev, '']);
  };

  const removeMedicineRow = (idx: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== idx));
    setSearchTerms((prev) => prev.filter((_, i) => i !== idx));
    setAgentReport(null);
  };

  const updateEntry = (idx: number, field: keyof MedicineEntry, value: any) => {
    setMedicines((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
    setAgentReport(null);
  };

  const selectMedicine = (idx: number, med: Medicine) => {
    updateEntry(idx, 'medicine', med);
    setSearchTerms((prev) => prev.map((s, i) => (i === idx ? med.name : s)));
    setActiveSearch(null);
  };

  const hasValidMedicines = medicines.some((m) => m.medicine && m.dosage && m.frequency);

  const handleValidate = () => {
    const payload: any = {
      patient_id: patientId,
      medicines: medicines
        .filter((m) => m.medicine)
        .map((m) => ({
          medicine_id: m.medicine!.id,
          dosage: m.dosage,
          frequency: m.frequency,
          duration_days: m.duration_days,
        })),
    };
    if (selectedPharmacyId) payload.pharmacy_id = selectedPharmacyId;
    validateMutation.mutate(payload);
  };

  /* ── Combined submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      toast.error(t('diagnosis') + ' is required');
      return;
    }

    if (includePrescription && hasValidMedicines) {
      // Must validate before submitting prescription
      if (!agentReport) {
        toast.error('Please validate the prescription first using AI safety check.');
        return;
      }
      if (agentReport.overall_status === 'blocked' && !overrideReason.trim()) {
        toast.error('Prescription is blocked. Provide an override reason or remove medicines.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const statusLabel = STATUS_OPTIONS.find((s) => s.value === visitStatus)?.label ?? visitStatus;
      const notesWithStatus = [doctorNotes.trim(), `[Status: ${statusLabel}]`].filter(Boolean).join('\n');

      // 1. Create visit record
      await api.medical.createVisitRecord(
        patientId,
        {
          diagnosis: diagnosis.trim(),
          tests_performed: testsPerformed.trim(),
          prescription: prescriptionNotes.trim(),
          doctor_notes: notesWithStatus,
          visit_date: new Date(visitDate).toISOString(),
        },
        reportFiles.length > 0 ? reportFiles : undefined,
      );

      // 2. Create prescription if toggled and has medicines
      if (includePrescription && hasValidMedicines) {
        await api.prescriptions.create({
          patient_id: patientId,
          medicines: medicines
            .filter((m) => m.medicine)
            .map((m) => ({
              medicine: m.medicine!.id,
              dosage: m.dosage,
              frequency: m.frequency,
              duration_days: m.duration_days,
              quantity: m.quantity,
              special_instructions: m.special_instructions,
            })),
        });
      }

      toast.success(
        includePrescription && hasValidMedicines
          ? 'Consultation record & prescription created successfully'
          : t('record_saved_success'),
      );
      setSubmitted(true);

      queryClient.invalidateQueries({ queryKey: ['doctor-recent-records'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['patient-records', patientId] });
      queryClient.invalidateQueries({ queryKey: ['visit-records-list'] });
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToPatient = () => router.push(`/doctor/patients/${patientId}`);

  /* ── Loading ── */
  if (loadingPatient) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  /* ── Success ── */
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
                {includePrescription && hasValidMedicines
                  ? 'Consultation & Prescription Saved'
                  : t('record_saved_success')}
              </h2>
              <p className="text-slate-600 mb-8 max-w-md mx-auto text-lg">
                {includePrescription && hasValidMedicines
                  ? 'Visit record and prescription have been created. The prescription QR code is ready for dispensing.'
                  : t('record_saved_desc')}
              </p>
              <Button
                onClick={handleBackToPatient}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
              >
                <FiFileText className="mr-2 h-5 w-5" />
                {t('patient_history')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  /* ── Form ── */
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="shrink-0" onClick={handleBackToPatient}>
            <FiArrowLeft className="h-6 w-6 text-slate-500" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <FiEdit3 className="h-8 w-8" />
              </span>
              New Consultation
            </h1>
            <p className="text-slate-500 mt-2 text-lg">
              {patient ? `${patient.name} (${patient.unique_patient_id})` : t('add_record_subtitle')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ═══════════ LEFT COLUMN (2 cols) ═══════════ */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── Visit Details ── */}
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
                    <label className="text-sm font-medium text-slate-700 block">{t('visit_date')}</label>
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

              {/* ── Clinical Information ── */}
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
                      <label className="text-sm font-medium text-slate-700 block">{t('tests_performed')}</label>
                      <textarea
                        value={testsPerformed}
                        onChange={(e) => setTestsPerformed(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                        placeholder="e.g. CBC, Widal"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 block">{t('prescription')}</label>
                      <textarea
                        value={prescriptionNotes}
                        onChange={(e) => setPrescriptionNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                        placeholder="Free-text treatment notes..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 block">{t('doctor_notes')}</label>
                    <textarea
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                      placeholder="Additional observation notes..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 block">{t('status')}</label>
                    <div className="relative">
                      <select
                        value={visitStatus}
                        onChange={(e) => setVisitStatus(e.target.value)}
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all appearance-none"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Reports Upload ── */}
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
                            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReportFiles((prev) => prev.filter((_, i) => i !== idx))}
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
                      className="group cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-6 transition-all hover:border-purple-400 hover:bg-purple-50/30 flex flex-col items-center justify-center text-center space-y-2"
                    >
                      <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                        <FiUpload className="h-5 w-5 text-slate-400 group-hover:text-purple-600" />
                      </div>
                      <p className="text-slate-700 font-medium group-hover:text-purple-700 text-sm">
                        {reportFiles.length === 0 ? t('click_upload') : t('add_more_files')}
                      </p>
                      <p className="text-xs text-slate-500">{t('upload_reports_desc')}</p>
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
                      files.forEach((file) => {
                        if (ALLOWED_FILE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE) {
                          valid.push(file);
                        } else {
                          toast.error(
                            !ALLOWED_FILE_TYPES.includes(file.type)
                              ? `Invalid Type: ${file.name}`
                              : `Too Large: ${file.name}`,
                          );
                        }
                      });
                      setReportFiles((prev) => [...prev, ...valid].slice(0, MAX_REPORT_FILES));
                      e.target.value = '';
                    }}
                  />
                </CardContent>
              </Card>

              {/* ══════════ PRESCRIPTION TOGGLE ══════════ */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                <CardContent className="p-6">
                  <label className="flex items-center gap-4 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={includePrescription}
                        onChange={(e) => {
                          setIncludePrescription(e.target.checked);
                          if (!e.target.checked) setAgentReport(null);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-7 bg-slate-200 rounded-full peer-checked:bg-indigo-600 transition-colors" />
                      <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                    </div>
                    <div>
                      <span className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <FiPackage className="h-5 w-5 text-indigo-500" />
                        Add Digital Prescription
                      </span>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Add medicine details with AI safety validation and QR-based dispensing
                      </p>
                    </div>
                  </label>
                </CardContent>
              </Card>

              {/* ══════════ PRESCRIPTION SECTION (conditional) ══════════ */}
              {includePrescription && (
                <>
                  {/* Pharmacy selector */}
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
                    <CardHeader className="border-b border-slate-100 py-3 px-4">
                      <CardTitle className="text-sm text-slate-800">Target Pharmacy (for stock check)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-3 text-slate-400 h-4 w-4" />
                        <Input
                          placeholder="Search pharmacy by name..."
                          className="pl-9"
                          value={selectedPharmacy ? selectedPharmacy.name : pharmacySearch}
                          onChange={(e) => {
                            setPharmacySearch(e.target.value);
                            setSelectedPharmacyId('');
                            setShowPharmacyDropdown(true);
                            setAgentReport(null);
                          }}
                          onFocus={() => setShowPharmacyDropdown(true)}
                        />
                        {selectedPharmacyId && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPharmacyId('');
                              setPharmacySearch('');
                              setAgentReport(null);
                            }}
                            className="absolute right-3 top-3 text-slate-400 hover:text-rose-500"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        )}
                        {showPharmacyDropdown && !selectedPharmacyId && pharmacyList && pharmacyList.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {pharmacyList.map((ph) => (
                              <button
                                key={ph.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPharmacyId(ph.id);
                                  setPharmacySearch('');
                                  setShowPharmacyDropdown(false);
                                  setAgentReport(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-violet-50 text-sm"
                              >
                                <span className="font-medium">{ph.name}</span>
                                <span className="text-slate-400 ml-2 text-xs">{ph.address}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedPharmacy && (
                        <p className="text-xs text-violet-600 mt-1.5">
                          Selected: {selectedPharmacy.name} — {selectedPharmacy.address}
                        </p>
                      )}
                      {!selectedPharmacyId && (
                        <p className="text-xs text-slate-400 mt-1.5">
                          Optional — select a pharmacy to check medicine stock availability.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Medicine entries */}
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="text-lg text-slate-800">Prescribed Medicines</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {medicines.map((entry, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 relative"
                        >
                          {medicines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMedicineRow(idx)}
                              className="absolute top-3 right-3 text-slate-400 hover:text-rose-500"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          )}
                          {/* Medicine search */}
                          <div className="relative">
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">
                              Medicine #{idx + 1}
                            </label>
                            <div className="relative">
                              <FiSearch className="absolute left-3 top-3 text-slate-400 h-4 w-4" />
                              <Input
                                placeholder="Search medicine..."
                                className="pl-9"
                                value={searchTerms[idx] || ''}
                                onChange={(e) => {
                                  setSearchTerms((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)));
                                  setActiveSearch(idx);
                                  if (!e.target.value) updateEntry(idx, 'medicine', null);
                                }}
                                onFocus={() => setActiveSearch(idx)}
                              />
                            </div>
                            {activeSearch === idx && searchResults && (searchResults as Medicine[]).length > 0 && (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {(searchResults as Medicine[]).map((med) => (
                                  <button
                                    key={med.id}
                                    type="button"
                                    onClick={() => selectMedicine(idx, med)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                                  >
                                    <span className="font-medium">{med.name}</span>
                                    <span className="text-slate-400 ml-2">({med.generic_name})</span>
                                    <span className="text-slate-400 ml-2 text-xs">{med.drug_class}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {entry.medicine && (
                              <p className="text-xs text-emerald-600 mt-1">
                                Selected: {entry.medicine.name} ({entry.medicine.generic_name})
                              </p>
                            )}
                          </div>
                          {/* Dosage / Frequency / Duration */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Dosage</label>
                              <Input
                                placeholder="e.g. 500mg"
                                value={entry.dosage}
                                onChange={(e) => updateEntry(idx, 'dosage', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Frequency</label>
                              <Input
                                placeholder="e.g. 3 times daily"
                                value={entry.frequency}
                                onChange={(e) => updateEntry(idx, 'frequency', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Duration (days)</label>
                              <Input
                                type="number"
                                min={1}
                                value={entry.duration_days}
                                onChange={(e) => updateEntry(idx, 'duration_days', parseInt(e.target.value) || 1)}
                              />
                            </div>
                          </div>
                          {/* Quantity / Instructions */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Quantity</label>
                              <Input
                                type="number"
                                min={1}
                                value={entry.quantity}
                                onChange={(e) => updateEntry(idx, 'quantity', parseInt(e.target.value) || 1)}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Special Instructions</label>
                              <Input
                                placeholder="e.g. After meals"
                                value={entry.special_instructions}
                                onChange={(e) => updateEntry(idx, 'special_instructions', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button type="button" variant="outline" onClick={addMedicineRow} className="w-full border-dashed">
                        <FiPlus className="mr-2 h-4 w-4" /> Add Another Medicine
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Validate button */}
                  <Button
                    type="button"
                    onClick={handleValidate}
                    disabled={!hasValidMedicines || validateMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-base font-semibold"
                  >
                    {validateMutation.isPending ? (
                      <>
                        <FiLoader className="mr-2 h-5 w-5 animate-spin" /> Validating with AI...
                      </>
                    ) : (
                      <>
                        <FiShield className="mr-2 h-5 w-5" /> Validate Prescription
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* ══════════ SUBMIT ══════════ */}
              <div className="pt-2 pb-12">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    submitting ||
                    !diagnosis.trim() ||
                    (includePrescription && hasValidMedicines && !agentReport)
                  }
                >
                  {submitting ? (
                    <>
                      <FiLoader className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="mr-2 h-5 w-5" />
                      {includePrescription && hasValidMedicines
                        ? 'Save Consultation & Prescription'
                        : t('save_record')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ═══════════ RIGHT COLUMN — AI Report Panel ═══════════ */}
            <div className="space-y-4">
              {/* Patient info card */}
              {patient && (
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <FiUser className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{patient.name}</p>
                        <p className="text-xs text-slate-500">
                          {patient.age} yrs &middot; {patient.gender} &middot; {patient.blood_group}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>ID: {patient.unique_patient_id}</p>
                      <p>District: {patient.district}</p>
                      <p>Visits: {patient.visit_count}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Agent report */}
              {includePrescription && !agentReport && !validateMutation.isPending && (
                <Card className="border-0 shadow-lg bg-slate-50/80 backdrop-blur-md">
                  <CardContent className="p-8 text-center">
                    <FiShield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">
                      Add medicines and click &quot;Validate Prescription&quot; to run AI safety checks.
                    </p>
                  </CardContent>
                </Card>
              )}

              {includePrescription && validateMutation.isPending && (
                <Card className="border-0 shadow-lg bg-indigo-50/80 backdrop-blur-md border border-indigo-200">
                  <CardContent className="p-8 text-center">
                    <FiLoader className="h-12 w-12 text-indigo-400 mx-auto mb-3 animate-spin" />
                    <p className="text-indigo-600 font-semibold">AI Agent Analyzing...</p>
                    <p className="text-indigo-400 text-sm mt-1">
                      Checking allergies, interactions, dosages, and pharmacy stock
                    </p>
                  </CardContent>
                </Card>
              )}

              {includePrescription && agentReport && (
                <>
                  {/* Overall status */}
                  <Card
                    className={`border-0 shadow-lg backdrop-blur-md overflow-hidden ${STATUS_COLORS[agentReport.overall_status]?.bg} border ${STATUS_COLORS[agentReport.overall_status]?.border}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {agentReport.overall_status === 'safe' && <FiCheckCircle className="h-8 w-8 text-emerald-600" />}
                        {agentReport.overall_status === 'warning' && <FiAlertTriangle className="h-8 w-8 text-amber-600" />}
                        {agentReport.overall_status === 'blocked' && <FiAlertCircle className="h-8 w-8 text-rose-600" />}
                        <div>
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase text-white ${STATUS_COLORS[agentReport.overall_status]?.badge}`}
                          >
                            {agentReport.overall_status}
                          </span>
                          {agentReport.agent_unavailable && (
                            <span className="ml-2 text-xs text-slate-500">(AI unavailable)</span>
                          )}
                        </div>
                      </div>
                      <p className={`text-sm ${STATUS_COLORS[agentReport.overall_status]?.text}`}>
                        {agentReport.summary}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Per-medicine reports */}
                  {agentReport.medicines.length > 0 && (
                    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Medicine Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {agentReport.medicines.map((med, idx) => (
                          <div key={idx} className="border border-slate-100 rounded-lg p-3 space-y-1.5">
                            <p className="font-semibold text-sm text-slate-800">{med.medicine_name}</p>
                            {med.allergy_conflict && (
                              <p className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded">
                                Allergy: {med.allergy_detail}
                              </p>
                            )}
                            {med.dosage_status !== 'appropriate' && (
                              <p className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded">
                                Dosage {med.dosage_status}: {med.dosage_detail}
                              </p>
                            )}
                            {med.stock_status !== 'in_stock' && (
                              <p className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                                Stock: {med.stock_detail}
                              </p>
                            )}
                            {med.recommendation && (
                              <p className="text-xs text-slate-600 italic">{med.recommendation}</p>
                            )}
                            {!med.allergy_conflict &&
                              med.dosage_status === 'appropriate' &&
                              med.stock_status === 'in_stock' && (
                                <p className="text-xs text-emerald-600">All checks passed</p>
                              )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Drug interactions */}
                  {agentReport.drug_interactions.length > 0 && (
                    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Drug Interactions</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {agentReport.drug_interactions.map((inter, idx) => (
                          <div key={idx} className="border border-slate-100 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-slate-800">
                                {inter.medicine_a} + {inter.medicine_b}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${SEVERITY_COLORS[inter.severity] || 'bg-slate-100 text-slate-600'}`}
                              >
                                {inter.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">{inter.detail}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Alternatives */}
                  {agentReport.alternatives.length > 0 && (
                    <Card className="border-0 shadow-lg bg-blue-50/50 backdrop-blur-md border border-blue-100">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-blue-700">Suggested Alternatives</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {agentReport.alternatives.map((alt, idx) => (
                          <div key={idx} className="bg-white/80 rounded-lg p-3 border border-blue-100">
                            <p className="text-xs text-slate-500">
                              Instead of <span className="font-semibold text-slate-700">{alt.replaces}</span>
                            </p>
                            <p className="text-sm font-semibold text-blue-700 mt-0.5">{alt.suggested_alternative}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{alt.reason}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Override for blocked */}
                  {agentReport.overall_status === 'blocked' && (
                    <Card className="border-0 shadow-lg bg-rose-50/50 backdrop-blur-md border border-rose-200">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-sm font-semibold text-rose-700">
                          This prescription is blocked. To override, provide a reason:
                        </p>
                        <textarea
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="Clinical justification for overriding the safety block..."
                          className="w-full rounded-lg border border-rose-200 p-3 text-sm focus:ring-2 focus:ring-rose-400 outline-none resize-none"
                          rows={3}
                        />
                        {overrideReason.trim() && (
                          <p className="text-xs text-rose-500">Override will be recorded in the audit log.</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* When prescription is off, show a simpler info card */}
              {!includePrescription && (
                <Card className="border-0 shadow-lg bg-slate-50/80 backdrop-blur-md">
                  <CardContent className="p-6 text-center">
                    <FiPackage className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">
                      Toggle &quot;Add Digital Prescription&quot; to include medicines with AI safety validation.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(CreateConsultationPage, ['doctor']);
