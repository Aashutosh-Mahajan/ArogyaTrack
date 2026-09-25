'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookmarkPlus,
  ChevronRight,
  ClipboardList,
  Clock,
  FilePlus2,
  FileText,
  FlaskConical,
  HeartPulse,
  Loader2,
  Plus,
  ShieldAlert,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, Panel, Skeleton, SkeletonRows, StatusPill } from '@/components/ui/page';
import { Field, fieldClass, flattenErrors } from '@/components/auth/FormKit';
import { initialsOf } from '@/components/layout/useShell';
import { RecordDetailModal, doctorLabel, visitToRecent } from '@/components/dashboard/RecordDetailModal';
import { cn } from '@/lib/utils';
import type { MedicalRecord, Prescription, RecentRecord } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

interface Chart {
  patient: { id: string; unique_patient_id: string; name: string; age: number; gender: string; blood_group: string; date_of_birth: string | null; phone: string | null; district: string | null; state: string | null };
  access: { expires_at: string | null; method: string | null };
  latest_vitals: Record<string, { value: number; secondary_value: number | null; unit: string; recorded_at: string }>;
  lab_results: { test_name: string; value: number; unit: string; normal_min: number; normal_max: number; status: string; tested_at: string }[];
  allergies: { id: number; allergen: string; reaction_type: string; severity: number; added_by_name: string | null; created_at: string }[];
  chronic_conditions: { id: number; icd_10_code: string; disease_name: string; is_active: boolean; added_by_name: string | null; created_at: string }[];
  medical_records: { id: number; symptoms: string; notes: string; created_at: string; doctor: { name: string } | null; diagnoses: { icd_10_code: string; disease_name: string; severity: number }[] }[];
  visit_records: MedicalRecord[];
  prescriptions: Prescription[];
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const TABS = ['Overview', 'Visits', 'Prescriptions', 'Diagnoses'] as const;
const SEV = { 1: { get l() { return tr("Mild"); }, t: 'neutral' as const }, 2: { get l() { return tr("Moderate"); }, t: 'warning' as const }, 3: { get l() { return tr("Severe"); }, t: 'danger' as const } };
const RX = { pending: { get l() { return tr("Not dispensed"); }, t: 'info' as const }, partially_dispensed: { get l() { return tr("Partly dispensed"); }, t: 'warning' as const }, fully_dispensed: { get l() { return tr("Dispensed"); }, t: 'success' as const } };

function AddAllergy({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ allergen: '', reaction_type: '', severity: '2' });
  const [err, setErr] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: () => api.medical.addPatientAllergy(patientId, { allergen: f.allergen.trim(), reaction_type: f.reaction_type.trim(), severity: Number(f.severity) }),
    onSuccess: () => {
      toast.success(tr("Allergy recorded"));
      setOpen(false);
      setF({ allergen: '', reaction_type: '', severity: '2' });
      onDone();
    },
    onError: (e: any) => setErr(flattenErrors(e?.response?.data)),
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-[12.5px] font-medium text-primary hover:bg-primary/15">
        <Plus className="h-3.5 w-3.5" />{' '}{tr("Add")}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-pop">
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-[17px] font-semibold">{tr("Record an allergy")}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Close")}><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const er: Record<string, string> = {};
              if (!f.allergen.trim()) er.allergen = tr("Enter the allergen");
              if (!f.reaction_type.trim()) er.reaction_type = tr("Describe the reaction");
              setErr(er);
              if (!Object.keys(er).length) m.mutate();
            }}
          >
            <Field label={tr("Allergen")} error={err.allergen}>{(id) => <input id={id} value={f.allergen} onChange={(e) => setF({ ...f, allergen: e.target.value })} placeholder={tr("e.g. Penicillin")} className={fieldClass(!!err.allergen)} />}</Field>
            <Field label={tr("Reaction")} error={err.reaction_type}>{(id) => <input id={id} value={f.reaction_type} onChange={(e) => setF({ ...f, reaction_type: e.target.value })} placeholder={tr("e.g. Hives, anaphylaxis")} className={fieldClass(!!err.reaction_type)} />}</Field>
            <Field label={tr("Severity")}>
              {(id) => (
                <select id={id} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className={fieldClass()}>
                  <option value="1">{tr("Mild")}</option>
                  <option value="2">{tr("Moderate")}</option>
                  <option value="3">{tr("Severe")}</option>
                </select>
              )}
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close type="button" className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{tr("Cancel")}</Dialog.Close>
              <button type="submit" disabled={m.isPending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
                {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{tr("Save allergy")}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddCondition({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ disease_name: '', icd_10_code: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: () => api.medical.addPatientCondition(patientId, { disease_name: f.disease_name.trim(), icd_10_code: f.icd_10_code.trim().toUpperCase(), is_active: true }),
    onSuccess: () => {
      toast.success(tr("Condition recorded"));
      setOpen(false);
      setF({ disease_name: '', icd_10_code: '' });
      onDone();
    },
    onError: (e: any) => setErr(flattenErrors(e?.response?.data)),
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-[12.5px] font-medium text-primary hover:bg-primary/15">
        <Plus className="h-3.5 w-3.5" />{' '}{tr("Add")}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-pop">
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-[17px] font-semibold">{tr("Record a long-term condition")}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Close")}><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const er: Record<string, string> = {};
              if (!f.disease_name.trim()) er.disease_name = tr("Enter the condition");
              if (!/^[A-Za-z]\d{2}(\.\d{1,4})?$/.test(f.icd_10_code.trim())) er.icd_10_code = tr("Use an ICD-10 code such as E11.9 or I10");
              setErr(er);
              if (!Object.keys(er).length) m.mutate();
            }}
          >
            <Field label={tr("Condition")} error={tr(err.disease_name)}>{(id) => <input id={id} value={tr(f.disease_name)} onChange={(e) => setF({ ...f, disease_name: e.target.value })} placeholder={tr("e.g. Type 2 diabetes mellitus")} className={fieldClass(!!err.disease_name)} />}</Field>
            <Field label={tr("ICD-10 code")} error={err.icd_10_code}>{(id) => <input id={id} value={f.icd_10_code} onChange={(e) => setF({ ...f, icd_10_code: e.target.value })} placeholder="E11.9" className={`${fieldClass(!!err.icd_10_code)} font-mono uppercase`} />}</Field>
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close type="button" className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{tr("Cancel")}</Dialog.Close>
              <button type="submit" disabled={m.isPending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
                {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{tr("Save condition")}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PatientChartPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const [selected, setSelected] = useState<RecentRecord | null>(null);

  const chart = useQuery<Chart>({ queryKey: ['patient-chart', id], queryFn: () => api.medical.getPatientHistory(id) as Promise<Chart> });
  const refresh = () => qc.invalidateQueries({ queryKey: ['patient-chart', id] });

  const keep = useMutation({
    mutationFn: () => api.medical.addPatientToMyList(id),
    onSuccess: () => {
      toast.success(tr("Patient kept on your list for ongoing care"));
      refresh();
      qc.invalidateQueries({ queryKey: ['myPatients'] });
    },
  });
  const delAllergy = useMutation({ mutationFn: (aid: number) => api.medical.deletePatientAllergy(id, String(aid)), onSuccess: () => { toast.success(tr("Allergy removed")); refresh(); } });
  const delCondition = useMutation({ mutationFn: (cid: number) => api.medical.deletePatientCondition(id, String(cid)), onSuccess: () => { toast.success(tr("Condition removed")); refresh(); } });

  if (chart.isError) {
    const status = (chart.error as any)?.response?.status;
    return (
      <div className="mx-auto max-w-lg py-16">
        {status === 403 ? (
          <EmptyState icon={ShieldAlert} title={tr("Your access to this patient has ended")} description={tr("Scan the patient's health card again to reopen their records.")} action={<Link href="/doctor/scan-qr" className="inline-flex h-9 items-center rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button">{tr("Scan health card")}</Link>} />
        ) : (
          <ErrorState onRetry={() => chart.refetch()} />
        )}
      </div>
    );
  }

  const c = chart.data;
  const p = c?.patient;
  const onList = c?.access?.method === 'added_to_list';
  const bp = c?.latest_vitals?.blood_pressure;
  const sugar = c?.latest_vitals?.sugar;
  const weight = c?.latest_vitals?.weight;
  const abnormalLabs = (c?.lab_results ?? []).filter((l) => l.status !== 'normal');

  return (
    <div className="space-y-6">
      <Link href="/doctor/patients" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />{' '}{tr("My patients")}</Link>

      {/* Identity */}
      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm lg:flex-row lg:items-center">
        {chart.isLoading || !p ? (
          <Skeleton className="h-14 w-72" />
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-lg font-semibold text-primary-foreground">{initialsOf(p.name)}</span>
            <div className="min-w-0">
              <h1 className="truncate text-[24px] font-semibold tracking-tight">{p.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                <span className="font-mono">{p.unique_patient_id}</span>
                <span>{tr("{age} years · {gender}", { age: p.age, gender: p.gender })}</span>
                <span className="font-semibold text-destructive">{p.blood_group}</span>
                {p.district && <span>{p.district}{p.state ? `, ${p.state}` : ''}</span>}
                {p.phone && <span>{p.phone}</span>}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {c?.access?.expires_at && (
            <StatusPill tone={onList ? 'primary' : 'warning'}>
              <Clock className="h-3 w-3" /> {onList ? tr("On your list until {fmt}", { fmt: fmt(c.access.expires_at) }) : tr("Access until {value}", { value: new Date(c.access.expires_at).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) })}
            </StatusPill>
          )}
          {c && !onList && (
            <button onClick={() => keep.mutate()} disabled={keep.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border bg-card px-3 text-[13px] font-medium shadow-sm hover:bg-muted disabled:opacity-60">
              {keep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}{' '}{tr("Keep on my list")}</button>
          )}
          <Link href={`/doctor/patients/${id}/create-consultation`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button">
            <FilePlus2 className="h-4 w-4" />{' '}{tr("New consultation")}</Link>
        </div>
      </section>

      {/* Alerts strip */}
      {c && (c.allergies.length > 0 || abnormalLabs.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {c.allergies.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/5 px-2.5 py-1 text-[12.5px] font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />{' '}{tr("Allergy: {allergen}", { allergen: a.allergen })}
            </span>
          ))}
          {abnormalLabs.map((l) => (
            <span key={l.test_name} className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/8 px-2.5 py-1 text-[12.5px] font-medium text-warning">
              <FlaskConical className="h-3.5 w-3.5" /> {l.test_name} {l.value} {l.unit} ({l.status})
            </span>
          ))}
        </div>
      )}

      <div className="inline-flex rounded-[10px] border bg-card p-1 shadow-sm" role="tablist">
        {TABS.map((t) => {
          const n = t === 'Visits' ? c?.visit_records.length : t === 'Prescriptions' ? c?.prescriptions.length : t === 'Diagnoses' ? c?.medical_records.length : undefined;
          return (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors', tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t}
              {n !== undefined && <span className="tabular ml-1.5 opacity-75">{n}</span>}
            </button>
          );
        })}
      </div>

      {chart.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={5} /></div>
      ) : !c ? null : tab === 'Overview' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: HeartPulse, label: tr("Blood pressure"), v: bp ? `${Math.round(bp.value)}/${Math.round(bp.secondary_value ?? 0)}` : '—', u: 'mmHg', at: bp?.recorded_at },
                { icon: Activity, label: tr("Blood glucose"), v: sugar ? Math.round(sugar.value) : '—', u: 'mg/dL', at: sugar?.recorded_at },
                { icon: Stethoscope, label: tr("Weight"), v: weight ? weight.value : '—', u: weight?.unit || 'kg', at: weight?.recorded_at },
              ].map((x) => (
                <div key={x.label} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><x.icon className="h-3.5 w-3.5" /> {x.label}</div>
                  <div className="tabular mt-2 text-[24px] font-semibold tracking-tight">{x.v}<span className="ml-1 text-xs font-normal text-muted-foreground">{x.u}</span></div>
                  <div className="text-[11.5px] text-muted-foreground">{x.at ? fmt(x.at) : tr("Not recorded")}</div>
                </div>
              ))}
            </div>

            <Panel title={tr("Latest lab results")} icon={FlaskConical}>
              {c.lab_results.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-[13.5px]">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="pb-2 font-medium">{tr("Test")}</th><th className="pb-2 font-medium">{tr("Result")}</th><th className="pb-2 font-medium">{tr("Range")}</th><th className="pb-2 font-medium">{tr("Date")}</th><th className="pb-2 text-right font-medium">{tr("Status")}</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {c.lab_results.map((l) => (
                        <tr key={l.test_name}>
                          <td className="py-2.5 pr-3 font-medium">{l.test_name}</td>
                          <td className="tabular py-2.5 pr-3">{l.value} {l.unit}</td>
                          <td className="tabular py-2.5 pr-3 text-muted-foreground">{l.normal_min}–{l.normal_max}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{fmt(l.tested_at)}</td>
                          <td className="py-2.5 text-right"><StatusPill tone={l.status === 'normal' ? 'success' : l.status === 'high' ? 'danger' : 'warning'}>{l.status}</StatusPill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13.5px] text-muted-foreground">{tr("No lab results on record.")}</p>
              )}
            </Panel>

            <Panel title={tr("Recent visits")} icon={FileText} actions={<button onClick={() => setTab('Visits')} className="text-[13px] font-medium text-primary">{tr("All visits")}</button>} bodyClassName="px-3 pb-3 md:px-3">
              {c.visit_records.length ? (
                <ul>
                  {c.visit_records.slice(0, 4).map((v) => (
                    <li key={v.id}>
                      <button onClick={() => setSelected(visitToRecent(v))} className="record-item w-full text-left">
                        <span className="record-icon"><FileText className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="record-title block truncate">{v.diagnosis || tr("Consultation")}</span>
                          <span className="record-meta">{doctorLabel(v.doctor_name)} · {tr(v.department)} · {fmt(v.visit_date)}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={FileText} title={tr("No visits recorded yet")} />
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title={tr("Allergies")} icon={AlertTriangle} actions={<AddAllergy patientId={id} onDone={refresh} />}>
              {c.allergies.length ? (
                <ul className="space-y-2">
                  {c.allergies.map((a) => {
                    const sv = SEV[(a.severity as 1 | 2 | 3) ?? 1] ?? SEV[1];
                    return (
                      <li key={a.id} className="group flex items-start gap-3 rounded-xl border p-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-medium">{a.allergen}</div>
                          <div className="text-xs text-muted-foreground">{a.reaction_type}{a.added_by_name ? ` · ${a.added_by_name}` : tr(" · self-reported")}</div>
                        </div>
                        <StatusPill tone={sv.t}>{sv.l}</StatusPill>
                        <button onClick={() => delAllergy.mutate(a.id)} className="rounded-md p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100" aria-label={tr("Remove {allergen}", { allergen: a.allergen })}><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13.5px] text-muted-foreground">{tr("No known allergies.")}</p>
              )}
            </Panel>
            <Panel title={tr("Long-term conditions")} icon={HeartPulse} actions={<AddCondition patientId={id} onDone={refresh} />}>
              {c.chronic_conditions.length ? (
                <ul className="space-y-2">
                  {c.chronic_conditions.map((cc) => (
                    <li key={cc.id} className="group flex items-start gap-3 rounded-xl border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium">{cc.disease_name || cc.icd_10_code}</div>
                        <div className="text-xs text-muted-foreground"><span className="font-mono">{cc.icd_10_code}</span>{' '}{tr("· since {fmt}", { fmt: fmt(cc.created_at) })}</div>
                      </div>
                      <button onClick={() => delCondition.mutate(cc.id)} className="rounded-md p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100" aria-label={tr("Remove {disease_name}", { disease_name: cc.disease_name })}><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-muted-foreground">{tr("None recorded.")}</p>
              )}
            </Panel>
          </div>
        </div>
      ) : tab === 'Visits' ? (
        c.visit_records.length ? (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
            {c.visit_records.map((v) => (
              <li key={v.id}>
                <button onClick={() => setSelected(visitToRecent(v))} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/40">
                  <span className="w-24 shrink-0 text-[13px] text-muted-foreground">{fmt(v.visit_date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold first-letter:uppercase">{v.diagnosis}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{doctorLabel(v.doctor_name)} · {tr(v.department)}{v.report_attachments?.length ? tr(" · {length} report(s)", { length: v.report_attachments.length }) : ''}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileText} title={tr("No visits recorded")} action={<Link href={`/doctor/patients/${id}/create-consultation`} className="text-[13.5px] font-semibold text-primary">{tr("Record the first consultation")}</Link>} />
        )
      ) : tab === 'Prescriptions' ? (
        c.prescriptions.length ? (
          <div className="space-y-3">
            {c.prescriptions.map((rx) => {
              const st = RX[rx.status as keyof typeof RX] ?? { l: rx.status, t: 'neutral' as const };
              return (
                <article key={rx.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span className="font-mono text-[14px] font-semibold">{(rx as any).prescription_number}</span>
                    <StatusPill tone={st.t}>{st.l}</StatusPill>
                    <span className="ml-auto text-[13px] text-muted-foreground">{doctorLabel(rx.doctor_name)} · {fmt((rx as any).issued_at || rx.created_at)}</span>
                  </div>
                  <ul className="mt-3 divide-y rounded-xl border text-[13.5px]">
                    {rx.medicines.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5">
                        <span className="font-medium">{m.medicine_name}</span>
                        <span className="text-muted-foreground">{tr("{dosage} · {frequency} · {duration_days} days", { dosage: m.dosage, frequency: m.frequency, duration_days: m.duration_days })}</span>
                        <span className="ml-auto text-xs capitalize text-muted-foreground">{m.dispense_status.replace('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title={tr("No prescriptions")} />
        )
      ) : c.medical_records.length ? (
        <ul className="space-y-3">
          {c.medical_records.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap gap-1.5">
                {r.diagnoses.map((d, i) => <span key={i} className="tag"><span className="font-mono">{d.icd_10_code}</span> · {tr(d.disease_name)}</span>)}
              </div>
              {r.symptoms && <p className="mt-2 text-[13.5px]"><span className="text-muted-foreground">{tr("Symptoms:")}{' '}</span>{r.symptoms}</p>}
              {r.notes && <p className="mt-1 text-[13.5px] text-muted-foreground">{r.notes}</p>}
              <div className="mt-2 text-xs text-muted-foreground">{r.doctor?.name ? doctorLabel(r.doctor.name) : tr("Doctor")} · {fmt(r.created_at)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Stethoscope} title={tr("No coded diagnoses")} description={tr("ICD-10 diagnoses added during consultations appear here.")} />
      )}

      {selected && <RecordDetailModal open onOpenChange={(o) => !o && setSelected(null)} record={selected} />}
    </div>
  );
}

export default withAuth(PatientChartPage, ['doctor']);
