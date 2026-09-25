'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { QRScanner } from '@/components/pharmacy/QRScanner';
import { StatusPill } from '@/components/ui/page';
import { extractError } from '@/components/auth/SignInForm';
import type { Prescription } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

/** A prescription QR encodes "<prescription id>|<signature>". */
function parse(text: string): { id: string; hash: string } | null {
  const [id, hash] = text.trim().split('|');
  return id && hash ? { id, hash } : null;
}

const ITEM: Record<string, string> = { get pending() { return t("Not yet dispensed"); }, get dispensed() { return t("Dispensed"); }, get unavailable() { return t("Unavailable"); }, get patient_has() { return t("Patient already had it"); } };

function VerifyContent() {
  const params = useSearchParams();
  const [result, setResult] = useState<Prescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = useCallback(async (id: string, hash: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = (await api.prescriptions.verifyQR(id, hash)) as { verified: boolean; prescription: Prescription };
      setResult(res.prescription);
    } catch (e) {
      setError(extractError(e, t("This prescription could not be verified.")));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = params.get('id');
    const hash = params.get('hash');
    const data = params.get('data');
    const p = id && hash ? { id, hash } : data ? parse(data) : null;
    if (p) verify(p.id, p.hash);
  }, [params, verify]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between px-5 py-5 md:px-10">
        <Logo />
        <LanguageSwitcher />
          <ThemeToggle className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted" />
      </header>
      <main id="main" className="mx-auto max-w-xl px-5 pb-16 pt-6">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></span>
          <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">{t("Verify a prescription")}</h1>
          <p className="mt-2 text-[14.5px] text-muted-foreground">{t("Scan the QR printed on an ArogyaTrack prescription to confirm it was issued by a registered doctor and has not been altered.")}</p>
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-5 shadow-sm">
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-[13.5px] text-muted-foreground">{t("Checking signature…")}</p></div>
          ) : result ? (
            <div>
              <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-[14px] font-medium text-success">
                <CheckCircle2 className="h-5 w-5" />{' '}{t("Genuine prescription — signature verified")}</div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-[13.5px]">
                <div><dt className="text-xs text-muted-foreground">{t("Prescription")}</dt><dd className="font-mono font-semibold">{(result as any).prescription_number}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t("Issued")}</dt><dd className="font-medium">{new Date((result as any).issued_at || result.created_at).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t("Patient")}</dt><dd className="font-medium">{result.patient_name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t("Doctor")}</dt><dd className="font-medium">{result.doctor_name}</dd></div>
              </dl>
              <ul className="mt-5 divide-y rounded-xl border text-[13.5px]">
                {result.medicines.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="font-medium">{m.medicine_name}</span>
                    <span className="text-muted-foreground">{t("{dosage} · {frequency} · {duration_days} d", { dosage: m.dosage, frequency: m.frequency, duration_days: m.duration_days })}</span>
                    <StatusPill tone={m.dispense_status === 'dispensed' ? 'success' : 'neutral'} className="ml-auto">{ITEM[m.dispense_status] ?? m.dispense_status}</StatusPill>
                  </li>
                ))}
              </ul>
              <button onClick={() => setResult(null)} className="mt-5 w-full text-center text-[13.5px] font-medium text-primary">{t("Verify another")}</button>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-[13.5px] text-destructive">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <QRScanner
                isActive={false}
                onScan={(text) => {
                  const p = parse(text);
                  if (p) verify(p.id, p.hash);
                  else setError(t("That QR is not an ArogyaTrack prescription."));
                }}
              />
            </>
          )}
        </div>
        <p className="mt-6 text-center text-[13px] text-muted-foreground">{t("Pharmacist?")}{' '}<Link href="/pharmacist/signin" className="font-medium text-primary hover:underline">{t("Sign in to dispense")}</Link>
        </p>
      </main>
    </div>
  );
}

export default function VerifyPrescriptionPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}
