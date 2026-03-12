'use client';

import React, { useState, useCallback } from 'react';
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
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiShield,
  FiAlertTriangle,
  FiAlertCircle,
  FiCheckCircle,
  FiSend,
  FiSearch,
  FiLoader,
} from 'react-icons/fi';

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
function CreatePrescriptionPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const queryClient = useQueryClient();

  // State
  const [medicines, setMedicines] = useState<MedicineEntry[]>([emptyEntry()]);
  const [searchTerms, setSearchTerms] = useState<string[]>(['']);
  const [activeSearch, setActiveSearch] = useState<number | null>(null);
  const [agentReport, setAgentReport] = useState<AgentReport | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>('');
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);

  // Fetch patient data
  const { data: patientsData } = useQuery({
    queryKey: ['myPatients'],
    queryFn: async () => {
      const response = await api.medical.getMyPatients();
      return response as { count: number; results: MyPatient[] };
    },
  });
  const patient = patientsData?.results?.find(
    (p) => p.patient_id === patientId
  );

  // Pharmacy list query
  const { data: pharmacyList } = useQuery({
    queryKey: ['pharmacy-list', pharmacySearch],
    queryFn: async () => {
      const res = await api.pharmacy.list(pharmacySearch ? { search: pharmacySearch } : undefined);
      return res as { id: string; name: string; address: string; phone: string }[];
    },
  });

  const selectedPharmacy = pharmacyList?.find((p) => p.id === selectedPharmacyId);

  // Medicine search
  const { data: searchResults } = useQuery({
    queryKey: ['medicine-search', searchTerms[activeSearch ?? -1]],
    queryFn: () =>
      api.prescriptions.getMedicines({ search: searchTerms[activeSearch ?? 0] }),
    enabled: activeSearch !== null && (searchTerms[activeSearch] ?? '').length >= 2,
  });

  // AI Validation mutation
  const validateMutation = useMutation({
    mutationFn: (payload: any) => api.prescriptions.validate(payload),
    onSuccess: (data: any) => {
      setAgentReport(data as AgentReport);
    },
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

  // Create prescription mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.prescriptions.create(payload),
    onSuccess: () => {
      toast.success('Prescription created successfully');
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to create prescription');
    },
  });

  // Handlers
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
    setMedicines((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
    setAgentReport(null);
  };

  const selectMedicine = (idx: number, med: Medicine) => {
    updateEntry(idx, 'medicine', med);
    setSearchTerms((prev) => prev.map((s, i) => (i === idx ? med.name : s)));
    setActiveSearch(null);
  };

  const hasValidMedicines = medicines.some(
    (m) => m.medicine && m.dosage && m.frequency
  );

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
    if (selectedPharmacyId) {
      payload.pharmacy_id = selectedPharmacyId;
    }
    validateMutation.mutate(payload);
  };

  const handleSubmit = () => {
    const payload = {
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
    };
    createMutation.mutate(payload);
  };

  const canSubmit = useCallback(() => {
    if (!hasValidMedicines) return false;
    if (!agentReport) return false;
    if (agentReport.overall_status === 'blocked' && !overrideReason.trim()) return false;
    return true;
  }, [hasValidMedicines, agentReport, overrideReason]);

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-12 text-center space-y-6">
          <Card className="bg-emerald-50/50 border border-emerald-100 shadow-xl">
            <CardContent className="p-12">
              <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiCheckCircle className="h-12 w-12 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Prescription Created</h2>
              <p className="text-slate-600 mb-8 text-lg">
                The prescription has been created with QR code and is ready for dispensing.
              </p>
              <Button
                onClick={() => router.push(`/doctor/patients/${patientId}`)}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Back to Patient
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/doctor/patients/${patientId}`)}
          >
            <FiArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create Prescription</h1>
            <p className="text-slate-500">
              {patient ? `${patient.name} (${patient.unique_patient_id})` : 'Loading patient...'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Medicine entries (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
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
                            setSearchTerms((prev) =>
                              prev.map((s, i) => (i === idx ? e.target.value : s))
                            );
                            setActiveSearch(idx);
                            if (!e.target.value) updateEntry(idx, 'medicine', null);
                          }}
                          onFocus={() => setActiveSearch(idx)}
                        />
                      </div>
                      {activeSearch === idx &&
                        searchResults &&
                        (searchResults as Medicine[]).length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {(searchResults as Medicine[]).map((med) => (
                              <button
                                key={med.id}
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
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">
                          Dosage
                        </label>
                        <Input
                          placeholder="e.g. 500mg"
                          value={entry.dosage}
                          onChange={(e) => updateEntry(idx, 'dosage', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">
                          Frequency
                        </label>
                        <Input
                          placeholder="e.g. 3 times daily"
                          value={entry.frequency}
                          onChange={(e) => updateEntry(idx, 'frequency', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">
                          Duration (days)
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={entry.duration_days}
                          onChange={(e) =>
                            updateEntry(idx, 'duration_days', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                    </div>

                    {/* Quantity / Instructions */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">
                          Quantity
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={entry.quantity}
                          onChange={(e) =>
                            updateEntry(idx, 'quantity', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">
                          Special Instructions
                        </label>
                        <Input
                          placeholder="e.g. After meals"
                          value={entry.special_instructions}
                          onChange={(e) =>
                            updateEntry(idx, 'special_instructions', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addMedicineRow}
                  className="w-full border-dashed"
                >
                  <FiPlus className="mr-2 h-4 w-4" /> Add Another Medicine
                </Button>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleValidate}
                disabled={!hasValidMedicines || validateMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-base font-semibold"
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

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit() || createMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base font-semibold disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <>
                    <FiLoader className="mr-2 h-5 w-5 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <FiSend className="mr-2 h-5 w-5" /> Submit Prescription
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right: Agent Report Panel (1 col) */}
          <div className="space-y-4">
            {!agentReport && !validateMutation.isPending && (
              <Card className="border-0 shadow-lg bg-slate-50/80 backdrop-blur-md">
                <CardContent className="p-8 text-center">
                  <FiShield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">
                    Add medicines and click &quot;Validate Prescription&quot; to run AI safety
                    checks.
                  </p>
                </CardContent>
              </Card>
            )}

            {validateMutation.isPending && (
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

            {agentReport && (
              <>
                {/* Overall status */}
                <Card
                  className={`border-0 shadow-lg backdrop-blur-md overflow-hidden ${STATUS_COLORS[agentReport.overall_status]?.bg} border ${STATUS_COLORS[agentReport.overall_status]?.border}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {agentReport.overall_status === 'safe' && (
                        <FiCheckCircle className="h-8 w-8 text-emerald-600" />
                      )}
                      {agentReport.overall_status === 'warning' && (
                        <FiAlertTriangle className="h-8 w-8 text-amber-600" />
                      )}
                      {agentReport.overall_status === 'blocked' && (
                        <FiAlertCircle className="h-8 w-8 text-rose-600" />
                      )}
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
                      <CardTitle className="text-sm font-semibold text-slate-700">
                        Medicine Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      {agentReport.medicines.map((med, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-100 rounded-lg p-3 space-y-1.5"
                        >
                          <p className="font-semibold text-sm text-slate-800">
                            {med.medicine_name}
                          </p>
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
                            <p className="text-xs text-slate-600 italic">
                              {med.recommendation}
                            </p>
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
                      <CardTitle className="text-sm font-semibold text-slate-700">
                        Drug Interactions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      {agentReport.drug_interactions.map((inter, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-100 rounded-lg p-3"
                        >
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
                      <CardTitle className="text-sm font-semibold text-blue-700">
                        Suggested Alternatives
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      {agentReport.alternatives.map((alt, idx) => (
                        <div
                          key={idx}
                          className="bg-white/80 rounded-lg p-3 border border-blue-100"
                        >
                          <p className="text-xs text-slate-500">
                            Instead of{' '}
                            <span className="font-semibold text-slate-700">
                              {alt.replaces}
                            </span>
                          </p>
                          <p className="text-sm font-semibold text-blue-700 mt-0.5">
                            {alt.suggested_alternative}
                          </p>
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
                        <p className="text-xs text-rose-500">
                          Override will be recorded in the audit log.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(CreatePrescriptionPage, ['doctor']);
