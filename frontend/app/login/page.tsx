'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock } from 'lucide-react';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading, SignInForm } from '@/components/auth/SignInForm';
import { t } from '@/lib/i18n';

function LoginContent() {
  const message = useSearchParams().get('message');

  const notice =
    message === 'verified' ? (
      <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/8 px-3.5 py-3 text-[13.5px] text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />{' '}{t("Email verified. Sign in to continue.")}</div>
    ) : message === 'doctor_verified' ? (
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/8 px-3.5 py-3 text-[13.5px] text-warning">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />{' '}{t("Email verified. Your licence is now with an administrator for approval.")}</div>
    ) : message === 'reset' ? (
      <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/8 px-3.5 py-3 text-[13.5px] text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />{' '}{t("Password updated. Sign in with your new password.")}</div>
    ) : null;

  return (
    <SplitSignInLayout>
      <AuthHeading
        eyebrow={t("Welcome back")}
        title={t("Sign in to ArogyaTrack")}
        description={t("One sign-in for patients, doctors, pharmacists and health authorities.")}
      />
      <SignInForm notice={notice} />
      <div className="mt-8 border-t pt-6 text-center text-[13px] text-muted-foreground">{t("Prefer a role-specific portal?")}{' '}
        <Link href="/roles" className="font-medium text-foreground hover:text-primary">{t("Choose your role")}</Link>
      </div>
    </SplitSignInLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
