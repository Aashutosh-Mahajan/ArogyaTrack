'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, LogIn, ShieldCheck, ShieldX } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/brand/Logo';
import { roleHome } from '@/lib/roles';
import { t } from '@/lib/i18n';

/**
 * Landing page for health-card links (/patient/qr/<token>).
 * Doctors are forwarded to the scanner with the token; pharmacists to the
 * dispensing view; everyone else is told the records stay private.
 */
export default function QRScanLandingPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    if (user.role === 'doctor') {
      sessionStorage.setItem('qr_scan_token', decodeURIComponent(token));
      router.replace('/doctor/scan-qr');
    } else if (user.role === 'pharmacist') {
      sessionStorage.setItem('pharmacy_scan_query', JSON.stringify({ token: decodeURIComponent(token) }));
      router.replace('/pharmacy/dispense/patient');
    }
  }, [hydrated, isAuthenticated, user, token, router]);

  const forwarding = hydrated && isAuthenticated && (user?.role === 'doctor' || user?.role === 'pharmacist');

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-5 py-5 md:px-10"><Logo /></header>
      <main id="main" className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          {!hydrated || forwarding ? (
            <>
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
              <p className="mt-4 text-[14px] text-muted-foreground">{t("Opening this health card…")}</p>
            </>
          ) : isAuthenticated ? (
            <>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><ShieldX className="h-6 w-6" /></span>
              <h1 className="mt-4 text-[20px] font-semibold">{t("Records stay private")}</h1>
              <p className="mt-2 text-[14px] text-muted-foreground">{t("Only verified doctors and pharmacists can open a patient's records from their health card.")}</p>
              <Link href={roleHome(user?.role)} className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button">{t("Go to my dashboard")}</Link>
            </>
          ) : (
            <>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></span>
              <h1 className="mt-4 text-[20px] font-semibold">{t("ArogyaTrack health card")}</h1>
              <p className="mt-2 text-[14px] text-muted-foreground">{t("This card belongs to a registered patient. Doctors and pharmacists can sign in to open it. Access is logged.")}</p>
              <div className="mt-6 flex justify-center gap-2">
                <Link href="/doctor/signin" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button"><LogIn className="h-4 w-4" />{' '}{t("Doctor sign-in")}</Link>
                <Link href="/pharmacist/signin" className="inline-flex h-10 items-center rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{t("Pharmacist")}</Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{t("After signing in, scan the card again.")}</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
