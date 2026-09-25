'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, AlertTriangle, BookmarkPlus, Clock, FilePlus2, FileText, HeartPulse, Keyboard, Loader2, QrCode, ScanLine, User } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { QRScanner } from '@/components/pharmacy/QRScanner';
import { PageHeader, Panel, StatusPill } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { extractError } from '@/components/auth/SignInForm';
import { initialsOf } from '@/components/layout/useShell';
import { cn } from '@/lib/utils';
import { t as tr, intlLocale } from '@/lib/i18n';

interface ScanResult {
  patient: { id: string; unique_patient_id: string; name: string; age: number; gender: string; blood_group: string; district: string | null; phone: string | null; profile_photo_url: string | null };
  card_info: { issued_at: string | null; expires_at: string | null };
  access: { expires_at: string | null; method: string | null };
  latest_vitals: { blood_pressure: { value: string; status: string; recorded_at: string } | null; blood_sugar: { value: number; unit: string; status: string; recorded_at: string } | null };
  allergies: { id: number; allergen: string; reaction_type: string }[];
  chronic_conditions: { id: number; disease_name: string; icd_10_code: string }[];
  visit_records: { id: number; diagnosis: string; visit_date: string; doctor_name: string }[];
  prescriptions: { id: string; status: string }[];
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function ScanQRPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'scan' | 'id'>('scan');
  const [manualId, setManualId] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);

  const lookup = useMutation({
    mutationFn: (data: { token?: string; patient_id?: string }) => api.patients.scanPatientQR(data) as Promise<ScanResult>,
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      qc.invalidateQueries({ queryKey: ['myPatients'] });
      qc.invalidateQueries({ queryKey: ['doctor-dashboard-summary'] });
    },
    onError: (e: any) => {
      setResult(null);
      setError(extractError(e, tr("That code could not be read as an ArogyaTrack health card.")));
    },
  });

  const keep = useMutation({
    mutationFn: (pid: string) => api.medical.addPatientToMyList(pid),
    onSuccess: (_d, pid) => {
      toast.success(tr("Patient kept on your list"));
      qc.invalidateQueries({ queryKey: ['myPatients'] });
      setResult((r) => (r && r.patient.id === pid ? { ...r, access: { ...r.access, method: 'added_to_list' } } : r));
    },
  });

  const onScan = useCallback((token: string) => lookup.mutate({ token }), [lookup]);

  // A doctor who opened a /patient/qr/<token> link lands here with the token stashed.
  // Deferred so a StrictMode remount cancels the first run instead of firing a
  // mutation whose observer is then detached (leaving the UI stuck pending).
  useEffect(() => {
    const t = sessionStorage.getItem('qr_scan_token');
    if (!t) return;
    const h = setTimeout(() => {
      sessionStorage.removeItem('qr_scan_token');
      lookup.mutate({ token: t });
    }, 0);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = result;
  const onList = r?.access?.method === 'added_to_list';

  return (
    <div>
      <PageHeader title={tr("Scan health card")} description={tr("Scanning a patient's QR gives you 24 hours of logged access to their records. Keep them on your list for ongoing care.")} />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Panel
          title={mode === 'scan' ? tr("Scan QR") : tr("Returning patient")}
          icon={mode === 'scan' ? ScanLine : Keyboard}
          actions={
            <div className="inline-flex rounded-lg border p-0.5">
              {[
                { k: 'scan' as const, l: tr("Scan") },
                { k: 'id' as const, l: tr("Patient ID") },
              ].map((t) => (
                <button key={t.k} onClick={() => setMode(t.k)} className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium', mode === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{t.l}</button>
              ))}
            </div>
          }
        >
          {mode === 'scan' ? (
            <QRScanner key={scanKey} isActive={false} onScan={onScan} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualId.trim()) lookup.mutate({ patient_id: manualId.trim().toUpperCase() });
              }}
              className="space-y-3"
            >
              <p className="text-[13px] text-muted-foreground">{tr("For patients you already have access to. New patients must present their card.")}</p>
              <input value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="HS-2026-XXXXXX" className={`${fieldClass()} font-mono uppercase`} aria-label={tr("Patient ID")} />
              <button type="submit" disabled={!manualId.trim() || lookup.isPending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
                {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}{' '}{tr("Open records")}</button>
            </form>
          )}
        </Panel>

        <div>
          {lookup.isPending ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-[13.5px] text-muted-foreground">{tr("Verifying card and loading history…")}</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-6 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="max-w-md text-[14px] text-foreground">{error}</p>
              <button onClick={() => { setError(null); setScanKey((k) => k + 1); }} className="text-[13px] font-medium text-primary hover:underline">{tr("Scan again")}</button>
            </div>
          ) : r ? (
            <div className="space-y-4">
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    {r.patient.profile_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.patient.profile_photo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-lg font-semibold text-primary-foreground">{initialsOf(r.patient.name)}</span>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-[20px] font-semibold tracking-tight">{r.patient.name}</h2>
                      <div className="text-[13px] text-muted-foreground"><span className="font-mono">{r.patient.unique_patient_id}</span>{' '}{tr("· {age} y · {gender} ·", { age: r.patient.age, gender: r.patient.gender })}{' '}<span className="font-semibold text-destructive">{r.patient.blood_group}</span></div>
                    </div>
                  </div>
                  {r.access?.expires_at && (
                    <StatusPill tone={onList ? 'primary' : 'success'}><Clock className="h-3 w-3" />{onList ? tr("On your list") : tr("Access until {value}", { value: new Date(r.access.expires_at).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) })}</StatusPill>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  <Link href={`/doctor/patients/${r.patient.id}/create-consultation`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button"><FilePlus2 className="h-4 w-4" />{' '}{tr("Start consultation")}</Link>
                  <Link href={`/doctor/patients/${r.patient.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-medium hover:bg-muted"><FileText className="h-4 w-4" />{' '}{tr("Full chart")}</Link>
                  {!onList && (
                    <button onClick={() => keep.mutate(r.patient.id)} disabled={keep.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-medium hover:bg-muted disabled:opacity-60">
                      {keep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}{' '}{tr("Keep on my list")}</button>
                  )}
                  <button onClick={() => { setResult(null); setScanKey((k) => k + 1); }} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium text-muted-foreground hover:bg-muted"><QrCode className="h-4 w-4" />{' '}{tr("Scan another")}</button>
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel title={tr("Alerts")} icon={AlertTriangle}>
                  <div className="space-y-3 text-[13px]">
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{tr("Allergies")}</div>
                      {r.allergies.length ? <div className="flex flex-wrap gap-1.5">{r.allergies.map((a) => <span key={a.id} className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{a.allergen}</span>)}</div> : <span className="text-muted-foreground">{tr("None recorded")}</span>}
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{tr("Conditions")}</div>
                      {r.chronic_conditions.length ? <div className="flex flex-wrap gap-1.5">{r.chronic_conditions.map((c) => <span key={c.id} className="tag">{c.disease_name || c.icd_10_code}</span>)}</div> : <span className="text-muted-foreground">{tr("None recorded")}</span>}
                    </div>
                  </div>
                </Panel>
                <Panel title={tr("Latest vitals")} icon={HeartPulse}>
                  <dl className="grid grid-cols-2 gap-3 text-[13px]">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <dt className="text-xs text-muted-foreground">{tr("Blood pressure")}</dt>
                      <dd className="tabular mt-1 text-[18px] font-semibold">{r.latest_vitals.blood_pressure?.value ?? '—'}</dd>
                      {r.latest_vitals.blood_pressure && <StatusPill tone={r.latest_vitals.blood_pressure.status === 'normal' ? 'success' : 'warning'} className="mt-1">{r.latest_vitals.blood_pressure.status}</StatusPill>}
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <dt className="text-xs text-muted-foreground">{tr("Glucose")}</dt>
                      <dd className="tabular mt-1 text-[18px] font-semibold">{r.latest_vitals.blood_sugar ? Math.round(r.latest_vitals.blood_sugar.value) : '—'}</dd>
                      {r.latest_vitals.blood_sugar && <StatusPill tone={r.latest_vitals.blood_sugar.status === 'normal' ? 'success' : 'warning'} className="mt-1">{r.latest_vitals.blood_sugar.status}</StatusPill>}
                    </div>
                  </dl>
                </Panel>
              </div>

              <Panel title={tr("Recent visits")} icon={FileText}>
                {r.visit_records.length ? (
                  <ul className="divide-y text-[13.5px]">
                    {r.visit_records.slice(0, 5).map((v) => (
                      <li key={v.id} className="flex gap-4 py-2.5 first:pt-0 last:pb-0">
                        <span className="w-24 shrink-0 text-muted-foreground">{fmt(v.visit_date)}</span>
                        <span className="min-w-0 flex-1 truncate font-medium first-letter:uppercase">{v.diagnosis}</span>
                        <span className="hidden text-muted-foreground sm:inline">{v.doctor_name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13.5px] text-muted-foreground">{tr("No previous visits on record.")}</p>
                )}
              </Panel>
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 text-center">
              <QrCode className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-sm text-[14px] text-muted-foreground">{tr("Scan the QR on the patient's health card. Their allergies, conditions, vitals and visit history appear here.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(ScanQRPage, ['doctor']);
