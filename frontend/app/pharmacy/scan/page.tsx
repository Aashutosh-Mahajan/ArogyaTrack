'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ClipboardList, CreditCard, Keyboard, Loader2 } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { QRScanner } from '@/components/pharmacy/QRScanner';
import { PageHeader, Panel } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { extractError } from '@/components/auth/SignInForm';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

type Mode = 'rx' | 'card' | 'id';

const MODES: { k: Mode; l: string; icon: typeof ClipboardList; hint: string }[] = [
  { k: 'rx', get l() { return t("Prescription QR"); }, icon: ClipboardList, get hint() { return t("Scan the QR the patient shows from their prescription."); } },
  { k: 'card', get l() { return t("Health card"); }, icon: CreditCard, get hint() { return t("Scan the patient’s health card to see all their prescriptions."); } },
  { k: 'id', get l() { return t("Patient ID"); }, icon: Keyboard, get hint() { return t("Type the ID printed on the health card."); } },
];

function ScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('rx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [key, setKey] = useState(0);

  const openPatient = (payload: { token?: string; patient_id?: string }) => {
    sessionStorage.setItem('pharmacy_scan_query', JSON.stringify(payload));
    router.push('/pharmacy/dispense/patient');
  };

  const handle = useCallback(
    async (text: string) => {
      setError(null);
      if (mode === 'card') return openPatient({ token: text });
      setBusy(true);
      try {
        const res: any = await api.pharmacy.scanPrescription(text);
        if (res.warning) toast(res.warning);
        router.push(`/pharmacy/dispense/${res.prescription.id}`);
      } catch (e: any) {
        const d = e?.response?.data;
        setError(d?.qr_data?.[0] || extractError(e, t("That QR is not a valid ArogyaTrack prescription.")));
        setKey((k) => k + 1);
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode]
  );

  const current = MODES.find((m) => m.k === mode)!;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Scan")} description={t("Verify a prescription's signature, or pull up every prescription for a patient.")} />
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl border bg-card p-1 shadow-sm">
        {MODES.map((m) => (
          <button key={m.k} onClick={() => { setMode(m.k); setError(null); setKey((k) => k + 1); }} className={cn('inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors', mode === m.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <m.icon className="h-4 w-4" /> <span className="hidden sm:inline">{m.l}</span>
          </button>
        ))}
      </div>
      <Panel title={current.l} description={current.hint} icon={current.icon}>
        {mode === 'id' ? (
          <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) openPatient({ patient_id: manual.trim().toUpperCase() }); }} className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="HS-2026-XXXXXX" className={`${fieldClass()} font-mono uppercase`} aria-label={t("Patient ID")} autoFocus />
            <button type="submit" disabled={!manual.trim()} className="h-11 shrink-0 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">{t("Find")}</button>
          </form>
        ) : busy ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-[13.5px] text-muted-foreground">{t("Verifying signature…")}</p></div>
        ) : (
          <QRScanner key={`${mode}-${key}`} isActive={false} onScan={handle} />
        )}
        {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">{error}</p>}
      </Panel>
    </div>
  );
}

export default withAuth(ScanPage, ['pharmacist']);
