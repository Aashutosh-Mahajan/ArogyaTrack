'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Loader2,
  Paperclip,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { Field, fieldClass } from '@/components/auth/FormKit';
import { Panel, Skeleton, StatusPill } from '@/components/ui/page';
import { Switch } from '@/components/ui/switch';
import { CDSSPanel } from '@/components/cdss/CDSSPanel';
import { initialsOf } from '@/components/layout/useShell';
import { cn } from '@/lib/utils';
import type { CDSSResult, Medicine } from '@/types';
import { t as tr, m } from '@/lib/i18n';

/* ── types ─────────────────────────────────────────────────────── */
interface Row {
  key: number;
  medicine: Medicine | null;
  query: string;
  dosage: string;
  frequency: string;
  duration_days: string;
  quantity: string;
  special_instructions: string;
}

interface SafetyReport {
  overall_status: 'safe' | 'warning' | 'blocked';
  medicines: { medicine_name: string; allergy_conflict: boolean; allergy_detail: string; dosage_status: string; dosage_detail: string; stock_status: string; stock_detail: string; recommendation: string }[];
  drug_interactions: { medicine_a: string; medicine_b: string; severity: string; detail: string }[];
  alternatives?: { replaces: string; suggested_alternative: string; reason: string }[];
  summary: string;
  engine?: 'rules' | 'ai';
}

const FREQUENCIES = [m("Once daily"), m("Twice daily"), m("Three times daily"), m("Four times daily"), m("At bedtime"), m("Every 8 hours"), m("As needed")];
const OUTCOMES = [
  { value: 'completed', get label() { return tr("Completed"); } },
  { value: 'follow_up', get label() { return tr("Follow-up needed"); } },
  { value: 'critical', get label() { return tr("Critical"); } },
];
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE = 10 * 1024 * 1024;

let rowKey = 1;
const emptyRow = (): Row => ({ key: rowKey++, medicine: null, query: '', dosage: '', frequency: tr("Twice daily"), duration_days: '5', quantity: '10', special_instructions: '' });

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/* ── medicine combobox ─────────────────────────────────────────── */
function MedicinePicker({ row, onPick, onQuery }: { row: Row; onPick: (m: Medicine) => void; onQuery: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [debounced, setDebounced] = useState(row.query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(row.query.trim()), 250);
    return () => clearTimeout(t);
  }, [row.query]);
  const results = useQuery<Medicine[]>({
    queryKey: ['medicine-search', debounced],
    queryFn: () => api.prescriptions.getMedicines({ search: debounced }),
    enabled: open && debounced.length >= 2 && debounced !== row.medicine?.name,
  });

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={row.query}
        onChange={(e) => {
          onQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={tr("Search medicine")}
        className={cn(fieldClass(), 'pl-9', row.medicine && 'border-primary/40 bg-primary/[0.03]')}
        aria-label={tr("Medicine")}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
      />
      {open && debounced.length >= 2 && debounced !== row.medicine?.name && (
        <div id={listId} className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-pop">
          {results.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{' '}{tr("Searching…")}</div>
          ) : results.data?.length ? (
            results.data.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(m);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-muted"
              >
                <span className="text-[13.5px] font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.generic_name} · {m.drug_class}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">{tr("No medicine matches “{debounced}”.", { debounced })}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── safety report ─────────────────────────────────────────────── */
function SafetyCard({ report }: { report: SafetyReport }) {
  const tone = report.overall_status === 'blocked' ? 'danger' : report.overall_status === 'warning' ? 'warning' : 'success';
  return (
    <div className={cn('rounded-xl border p-4', tone === 'danger' ? 'border-destructive/30 bg-destructive/5' : tone === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5')}>
      <div className="flex flex-wrap items-center gap-2">
        {tone === 'success' ? <ShieldCheck className="h-4 w-4 text-success" /> : <AlertTriangle className={cn('h-4 w-4', tone === 'danger' ? 'text-destructive' : 'text-warning')} />}
        <span className="text-[14px] font-semibold">{report.overall_status === 'blocked' ? tr("Blocked") : report.overall_status === 'warning' ? tr("Review before issuing") : tr("No problems found")}</span>
        <span className="ml-auto text-[11.5px] text-muted-foreground">{report.engine === 'ai' ? tr("AI review + recorded data") : tr("Checked against recorded allergies, interactions, dosing and stock")}</span>
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">{report.summary}</p>
      {report.drug_interactions?.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {report.drug_interactions.map((i, n) => (
            <li key={n} className="rounded-lg bg-card px-3 py-2 text-[13px]">
              <div className="flex items-center gap-2 font-medium">{i.medicine_a} + {i.medicine_b}<StatusPill tone={i.severity === 'contraindicated' || i.severity === 'major' ? 'danger' : 'warning'} className="ml-auto capitalize">{i.severity}</StatusPill></div>
              <div className="text-muted-foreground">{i.detail}</div>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-3 space-y-1.5">
        {report.medicines?.filter((m) => m.allergy_conflict || ['too_high', 'too_low'].includes(m.dosage_status) || ['low_stock', 'out_of_stock'].includes(m.stock_status) || (m.recommendation && m.recommendation !== 'No issues found.')).map((m, n) => (
          <li key={n} className="rounded-lg bg-card px-3 py-2 text-[13px]">
            <div className="font-medium">{m.medicine_name}</div>
            {m.allergy_conflict && <div className="text-destructive">{m.allergy_detail}</div>}
            {['too_high', 'too_low'].includes(m.dosage_status) && <div className="text-warning">{m.dosage_detail}</div>}
            {['low_stock', 'out_of_stock'].includes(m.stock_status) && <div className="text-warning">{m.stock_detail}</div>}
            {m.recommendation && m.recommendation !== 'No issues found.' && <div className="text-muted-foreground">{m.recommendation}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────── */
function CreateConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const chart = useQuery({ queryKey: ['patient-chart', id], queryFn: () => api.medical.getPatientHistory(id) as Promise<any> });
  const cdssStatus = useQuery({ queryKey: ['cdss-status'], queryFn: () => api.cdss.status(), staleTime: 10 * 60_000 });

  const [notes, setNotes] = useState({ diagnosis: '', tests_performed: '', doctor_notes: '', visit_date: localNow(), outcome: 'completed' });
  const [vitals, setVitals] = useState({ bp_systolic: '', bp_diastolic: '', blood_sugar: '', weight: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [withRx, setWithRx] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [pharmacyId, setPharmacyId] = useState('');
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [override, setOverride] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Set once the visit is stored, so a retry after a blocked prescription does not duplicate it.
  const [visitSaved, setVisitSaved] = useState(false);
  const [done, setDone] = useState<{ rx: boolean } | null>(null);
  const [cdss, setCdss] = useState<CDSSResult | null>(null);

  const pharmacies = useQuery({ queryKey: ['pharmacy-list'], queryFn: () => api.pharmacy.list() as Promise<{ id: string; name: string; address?: string }[]>, enabled: withRx });

  const readyRows = rows.filter((r) => r.medicine && r.dosage.trim() && r.frequency);
  // Rows that repeat a medicine already picked above; one line per medicine.
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<number>();
    for (const r of rows) {
      if (!r.medicine) continue;
      const mid = String(r.medicine.id);
      if (seen.has(mid)) dupes.add(r.key);
      seen.add(mid);
    }
    return dupes;
  }, [rows]);
  const medPayload = useMemo(
    () => readyRows.map((r) => ({ medicine_id: r.medicine!.id, dosage: r.dosage.trim(), frequency: r.frequency, duration_days: Number(r.duration_days) || 1, quantity: Number(r.quantity) || 1 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  );

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setReport(null);
  };

  const safety = useMutation({
    mutationFn: () => api.prescriptions.validate({ patient_id: id, medicines: medPayload, ...(pharmacyId ? { pharmacy_id: pharmacyId } : {}) }) as Promise<SafetyReport>,
    onSuccess: setReport,
  });

  const hasClinicalText = !!(notes.diagnosis.trim() || notes.doctor_notes.trim());
  const analyse = useMutation({
    mutationFn: () => api.cdss.analyze(id, [notes.diagnosis, notes.tests_performed, notes.doctor_notes].filter(Boolean).join('. ')),
    onSuccess: setCdss,
  });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(f.type)) {
        toast.error(tr("{name}: only PDF, JPG or PNG", { name: f.name }));
        continue;
      }
      if (f.size > MAX_FILE) {
        toast.error(tr("{name} is over 10 MB", { name: f.name }));
        continue;
      }
      if (next.length >= 5) {
        toast.error(tr("Up to 5 reports per visit"));
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!notes.diagnosis.trim()) er.diagnosis = tr("Enter a diagnosis or presenting problem");
    if (!!vitals.bp_systolic !== !!vitals.bp_diastolic) er.bp = tr("Enter both systolic and diastolic");
    if (withRx) {
      if (!readyRows.length) er.rx = tr("Add at least one medicine with a dose and frequency, or turn off the prescription");
      else if (duplicateKeys.size) er.rx = tr("A medicine is listed twice. Remove the repeat or combine it into one line");
      else if (!report) er.rx = tr("Run the safety check before issuing the prescription");
      else if (report.overall_status === 'blocked' && override.trim().length < 10) er.override = tr("Explain why you are overriding the block (at least 10 characters)");
    }
    setErrors(er);
    if (Object.keys(er).length) {
      toast.error(tr("Some details need attention"));
      return;
    }

    setSaving(true);
    try {
      const outcome = OUTCOMES.find((o) => o.value === notes.outcome)!.label;
      const rxText = readyRows.map((r) => `${r.medicine!.name} ${r.dosage} ${r.frequency} for ${r.duration_days} days`).join(', ');
      if (!visitSaved) await api.medical.createVisitRecord(
        id,
        {
          diagnosis: notes.diagnosis.trim(),
          tests_performed: notes.tests_performed.trim(),
          prescription: withRx ? rxText : '',
          doctor_notes: [notes.doctor_notes.trim(), notes.outcome !== 'completed' ? `[Status: ${outcome}]` : ''].filter(Boolean).join('\n'),
          visit_date: new Date(notes.visit_date).toISOString(),
          ...Object.fromEntries(Object.entries(vitals).filter(([, v]) => v !== '')),
        },
        files.length ? files : undefined
      );
      setVisitSaved(true);

      if (withRx) {
        await api.prescriptions.create({
          patient_id: id,
          medicines: readyRows.map((r) => ({
            medicine: r.medicine!.id,
            dosage: r.dosage.trim(),
            frequency: r.frequency,
            duration_days: Number(r.duration_days) || 1,
            quantity: Number(r.quantity) || 1,
            special_instructions: r.special_instructions.trim(),
          })),
          ...(report?.overall_status === 'blocked' ? { override_reason: override.trim() } : {}),
        });
      }

      ['patient-chart', 'myPatients', 'doctor-dashboard-summary', 'doctor-recent-activity', 'doctor-high-risk'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setDone({ rx: withRx });
    } catch (err: any) {
      const d = err?.response?.data;
      if (err?.response?.status === 409 && d?.safety) {
        setReport(d.safety);
        setErrors({ override: tr("The server safety check blocked this prescription. Record an override reason to proceed.") });
      }
    } finally {
      setSaving(false);
    }
  };

  const p = chart.data?.patient;

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12 text-success"><CheckCircle2 className="h-7 w-7" /></span>
        <h1 className="mt-5 text-[24px] font-semibold tracking-tight">{tr("Consultation saved")}</h1>
        <p className="mt-2 text-[14.5px] text-muted-foreground">{done.rx ? tr("The visit and prescription are now on {name}'s record. The patient can show the prescription QR at any pharmacy on the network.", { name: p?.name ?? tr("the patient") }) : tr("The visit is now on {name}'s record.", { name: p?.name ?? tr("the patient") })}
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href={`/doctor/patients/${id}`} className="inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button">{tr("Back to chart")}</Link>
          <Link href="/doctor/scan-qr" className="inline-flex h-10 items-center rounded-[10px] border bg-card px-4 text-[13.5px] font-medium shadow-sm hover:bg-muted">{tr("Next patient")}</Link>
        </div>
      </div>
    );
  }

  const setN = (k: keyof typeof notes) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setNotes((n) => ({ ...n, [k]: e.target.value }));
  const setV = (k: keyof typeof vitals) => (e: React.ChangeEvent<HTMLInputElement>) => setVitals((v) => ({ ...v, [k]: e.target.value.replace(/[^\d.]/g, '') }));

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="rounded-lg border bg-card p-2 text-muted-foreground shadow-sm hover:bg-muted" aria-label={tr("Back")}><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <div className="kicker">{tr("New consultation")}</div>
            {p ? <h1 className="text-[22px] font-semibold tracking-tight">{p.name} <span className="text-[14px] font-normal text-muted-foreground">{tr("· {age} y · {gender} · {blood_group}", { age: p.age, gender: p.gender, blood_group: p.blood_group })}</span></h1> : <Skeleton className="mt-1 h-7 w-64" />}
          </div>
        </div>
        <button type="submit" disabled={saving || chart.isError} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-5 text-[14px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{' '}{tr("Save consultation")}</button>
      </div>

      {chart.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13.5px] text-destructive">{tr("You no longer have access to this patient.")}{' '}<Link href="/doctor/scan-qr" className="font-semibold underline">{tr("Scan their health card")}</Link>{' '}{tr("to continue.")}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title={tr("Vitals")} description={tr("Optional. Saved to the patient's trend charts.")} icon={HeartPulse}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label={tr("Systolic (mmHg)")} error={errors.bp}>{(i) => <input id={i} inputMode="numeric" value={vitals.bp_systolic} onChange={setV('bp_systolic')} placeholder="120" className={fieldClass(!!errors.bp)} />}</Field>
              <Field label={tr("Diastolic (mmHg)")}>{(i) => <input id={i} inputMode="numeric" value={vitals.bp_diastolic} onChange={setV('bp_diastolic')} placeholder="80" className={fieldClass(!!errors.bp)} />}</Field>
              <Field label={tr("Glucose (mg/dL)")}>{(i) => <input id={i} inputMode="decimal" value={vitals.blood_sugar} onChange={setV('blood_sugar')} placeholder="110" className={fieldClass()} />}</Field>
              <Field label={tr("Weight (kg)")}>{(i) => <input id={i} inputMode="decimal" value={vitals.weight} onChange={setV('weight')} placeholder="68" className={fieldClass()} />}</Field>
            </div>
          </Panel>

          <Panel title={tr("Clinical notes")} icon={FileText}>
            <div className="space-y-4">
              <Field label={tr("Diagnosis")} required error={errors.diagnosis}>{(i) => <input id={i} value={notes.diagnosis} onChange={setN('diagnosis')} placeholder={tr("e.g. Acute viral pharyngitis")} className={fieldClass(!!errors.diagnosis)} />}</Field>
              <Field label={tr("Tests performed or ordered")}>{(i) => <textarea id={i} rows={2} value={notes.tests_performed} onChange={setN('tests_performed')} placeholder={tr("One per line, e.g. CBC, CRP")} className={`${fieldClass()} h-auto py-2.5`} />}</Field>
              <Field label={tr("Notes")}>{(i) => <textarea id={i} rows={3} value={notes.doctor_notes} onChange={setN('doctor_notes')} placeholder={tr("History, examination findings, advice")} className={`${fieldClass()} h-auto py-2.5`} />}</Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tr("Visit date and time")}>{(i) => <input id={i} type="datetime-local" value={notes.visit_date} max={localNow()} onChange={setN('visit_date')} className={fieldClass()} />}</Field>
                <Field label={tr("Outcome")}>
                  {(i) => (
                    <select id={i} value={notes.outcome} onChange={setN('outcome')} className={fieldClass()}>
                      {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </Field>
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-medium">{tr("Reports")}</div>
                <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-[10px] border border-dashed bg-muted/30 px-4 py-3 text-left hover:bg-muted/60">
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[13px]"><span className="font-medium">{tr("Attach lab or imaging reports")}</span><span className="block text-xs text-muted-foreground">{tr("PDF, JPG or PNG · up to 10 MB each · max 5")}</span></span>
                </button>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground">{tr("{value} KB", { value: (f.size / 1024).toFixed(0) })}</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, n) => n !== i))} className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label={tr("Remove {name}", { name: f.name })}><X className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          <Panel
            title={tr("Prescription")}
            description={tr("Checked for allergies, interactions, dosing and stock before it is issued")}
            icon={ClipboardList}
            actions={
              <Switch checked={withRx} onCheckedChange={(v) => { setWithRx(v); setReport(null); }} aria-label={tr("Include a prescription")} />
            }
          >
            {!withRx ? (
              <p className="text-[13.5px] text-muted-foreground">{tr("Turn on to prescribe medicines with this visit.")}</p>
            ) : (
              <div className="space-y-4">
                {rows.map((r, n) => (
                  <div key={r.key} className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{tr("Medicine {value}", { value: n + 1 })}</span>
                      {rows.length > 1 && (
                        <button type="button" onClick={() => { setRows(rows.filter((x) => x.key !== r.key)); setReport(null); }} className="rounded-md p-1 text-muted-foreground hover:text-destructive" aria-label={tr("Remove medicine")}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                      <MedicinePicker row={r} onQuery={(q) => updateRow(r.key, { query: q, medicine: r.medicine && q === r.medicine.name ? r.medicine : null })} onPick={(m) => updateRow(r.key, { medicine: m, query: m.name, dosage: r.dosage || (m.name.match(/\d+(\.\d+)?\s*(mg|mcg|iu)/i)?.[0] ?? '') })} />
                      <input value={r.dosage} onChange={(e) => updateRow(r.key, { dosage: e.target.value })} placeholder={tr("Dose, e.g. 500 mg")} className={fieldClass()} aria-label={tr("Dose")} />
                    </div>
                    {duplicateKeys.has(r.key) && (
                      <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                        {tr("{name} is already listed above. Remove this line or combine the dose and quantity into one.", { name: r.medicine?.name })}</p>
                    )}
                    {r.medicine?.standard_dosages && Object.keys(r.medicine.standard_dosages).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">{tr("Standard:")}{' '}{Object.entries(r.medicine.standard_dosages).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
                      <select value={r.frequency} onChange={(e) => updateRow(r.key, { frequency: e.target.value })} className={fieldClass()} aria-label={tr("Frequency")}>
                        {FREQUENCIES.map((f) => <option key={f} value={f}>{tr(f)}</option>)}
                      </select>
                      <div className="relative"><input inputMode="numeric" value={r.duration_days} onChange={(e) => updateRow(r.key, { duration_days: e.target.value.replace(/\D/g, '') })} className={`${fieldClass()} pr-12`} aria-label={tr("Duration in days")} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{tr("days")}</span></div>
                      <div className="relative"><input inputMode="numeric" value={r.quantity} onChange={(e) => updateRow(r.key, { quantity: e.target.value.replace(/\D/g, '') })} className={`${fieldClass()} pr-12`} aria-label={tr("Quantity")} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{tr("units")}</span></div>
                    </div>
                    <input value={r.special_instructions} onChange={(e) => updateRow(r.key, { special_instructions: e.target.value })} placeholder={tr("Instructions, e.g. after food")} className={`${fieldClass()} mt-3`} aria-label={tr("Instructions")} />
                  </div>
                ))}
                <button type="button" onClick={() => setRows([...rows, emptyRow()])} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium hover:bg-muted">
                  <Plus className="h-4 w-4" />{' '}{tr("Add medicine")}</button>

                <div className="grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto] md:items-end">
                  <Field label={tr("Check stock at pharmacy (optional)")}>
                    {(i) => (
                      <select id={i} value={pharmacyId} onChange={(e) => { setPharmacyId(e.target.value); setReport(null); }} className={fieldClass()}>
                        <option value="">{tr("No pharmacy selected")}</option>
                        {pharmacies.data?.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                      </select>
                    )}
                  </Field>
                  <button type="button" onClick={() => safety.mutate()} disabled={!readyRows.length || duplicateKeys.size > 0 || safety.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-primary/40 bg-primary/5 px-4 text-[13.5px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50">
                    {safety.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{' '}{tr("Run safety check")}</button>
                </div>
                {errors.rx && <p className="text-xs font-medium text-destructive">{errors.rx}</p>}
                {report && <SafetyCard report={report} />}
                {report?.overall_status === 'blocked' && (
                  <Field label={tr("Override reason")} required error={errors.override} hint={tr("Recorded in the audit log with your name.")}>
                    {(i) => <textarea id={i} rows={2} value={override} onChange={(e) => setOverride(e.target.value)} placeholder={tr("Why this prescription is clinically justified despite the block")} className={`${fieldClass(!!errors.override)} h-auto py-2.5`} />}
                  </Field>
                )}
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title={tr("Patient snapshot")} icon={Pill}>
            {chart.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : chart.data ? (
              <div className="space-y-4 text-[13px]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[13px] font-semibold text-accent-foreground">{initialsOf(p?.name || '')}</span>
                  <div><div className="font-semibold">{p?.name}</div><div className="font-mono text-xs text-muted-foreground">{p?.unique_patient_id}</div></div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">{tr("Allergies")}</div>
                  {chart.data.allergies.length ? (
                    <div className="flex flex-wrap gap-1.5">{chart.data.allergies.map((a: any) => <span key={a.id} className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"><AlertTriangle className="h-3 w-3" />{a.allergen}</span>)}</div>
                  ) : <span className="text-muted-foreground">{tr("None recorded")}</span>}
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">{tr("Conditions")}</div>
                  {chart.data.chronic_conditions.length ? (
                    <div className="flex flex-wrap gap-1.5">{chart.data.chronic_conditions.map((c: any) => <span key={c.id} className="tag">{tr(c.disease_name)}</span>)}</div>
                  ) : <span className="text-muted-foreground">{tr("None recorded")}</span>}
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">{tr("Active medicines")}</div>
                  {chart.data.prescriptions.filter((rx: any) => rx.status !== 'fully_dispensed').flatMap((rx: any) => rx.medicines).length ? (
                    <ul className="space-y-1">{chart.data.prescriptions.filter((rx: any) => rx.status !== 'fully_dispensed').flatMap((rx: any) => rx.medicines).slice(0, 8).map((m: any) => <li key={m.id}>{m.medicine_name} <span className="text-muted-foreground">· {m.dosage} {m.frequency}</span></li>)}</ul>
                  ) : <span className="text-muted-foreground">{tr("None")}</span>}
                </div>
              </div>
            ) : null}
          </Panel>

          {cdss ? (
            <CDSSPanel result={cdss} onClose={() => setCdss(null)} onUseDiagnosis={(t) => setNotes((n) => ({ ...n, diagnosis: t }))} />
          ) : (
            <Panel title={tr("Decision support")} icon={Brain}>
              {cdssStatus.data?.available === false ? (
                <p className="text-[13px] text-muted-foreground">{tr("AI decision support is not configured on this server. An administrator can enable it by setting")}{' '}<span className="font-mono">{tr("AI_API_KEY")}</span>{' '}{tr("(and optionally")}{' '}<span className="font-mono">{tr("AI_BASE_URL")}</span>{' '}{tr("and")}{' '}<span className="font-mono">{tr("AI_MODEL")}</span>{tr(") in the backend")}{' '}<span className="font-mono">.env</span>.</p>
              ) : (
                <>
                  <p className="text-[13px] text-muted-foreground">{tr("Get differential diagnoses, suggested tests and warnings from the notes above and the patient's anonymised history.")}</p>
                  <button type="button" onClick={() => analyse.mutate()} disabled={analyse.isPending || !hasClinicalText} className="mt-3 inline-flex h-9 items-center gap-2 rounded-[10px] border border-primary/40 bg-primary/5 px-3.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground">
                    {analyse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />} {analyse.isPending ? tr("Analysing… (about 20 s)") : tr("Analyse symptoms")}
                  </button>
                  {!hasClinicalText && !analyse.isPending && (
                    <p className="mt-2 text-xs text-muted-foreground">{tr("Enter a diagnosis or notes above first; the analysis is based on them.")}</p>
                  )}
                </>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </form>
  );
}

export default withAuth(CreateConsultationPage, ['doctor']);
