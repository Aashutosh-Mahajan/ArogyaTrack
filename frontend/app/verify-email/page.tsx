'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading, extractError } from '@/components/auth/SignInForm';
import { OtpInput } from '@/components/auth/OtpInput';
import { t as tr } from '@/lib/i18n';

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const role = params.get('role') || 'patient';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verify = useCallback(
    async (value: string) => {
      if (value.length !== 6 || !email) return;
      setLoading(true);
      setError(null);
      try {
        await api.auth.verifyEmail(email, value);
        setVerified(true);
        setTimeout(() => router.push(role === 'doctor' ? '/login?message=doctor_verified' : '/login?message=verified'), 1600);
      } catch (err: any) {
        const d = err?.response?.data;
        setError(d?.otp?.[0] || extractError(err, tr("That code is invalid or has expired.")));
        setCode('');
      } finally {
        setLoading(false);
      }
    },
    [email, role, router]
  );

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      await api.auth.sendOtp(email);
      toast.success(tr("A new code is on its way."));
      setCountdown(60);
      setCode('');
    } catch (err) {
      setError(extractError(err, tr("Could not send a new code. Try again shortly.")));
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <SplitSignInLayout backHref="/signup" backLabel={tr("Register")}>
        <AuthHeading
          title={tr("Verification link incomplete")}
          description={tr("We need the email you registered with. Start registration again to get a new code.")}
        />
        <Link href="/signup" className="inline-flex h-11 items-center rounded-[10px] bg-primary px-5 text-[14.5px] font-medium text-primary-foreground shadow-button">{tr("Back to registration")}</Link>
      </SplitSignInLayout>
    );
  }

  return (
    <SplitSignInLayout backHref="/login" backLabel={tr("Sign in")}>
      {verified ? (
        <div className="text-center">
          <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{tr("Email verified")}</h1>
          <p className="mt-2 text-[14.5px] text-muted-foreground">
            {role === 'doctor'
              ? tr("Your licence now goes to an administrator for review. Taking you to sign in…")
              : tr("Taking you to sign in…")}
          </p>
        </div>
      ) : (
        <>
          <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </span>
          <AuthHeading
            title={tr("Check your inbox")}
            description={
              <>{tr("We sent a 6-digit code to")}{' '}<span className="font-medium text-foreground">{email}</span>.
              </>
            }
          />
          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <OtpInput value={code} onChange={setCode} onComplete={verify} invalid={!!error} disabled={loading} />
          <button
            type="button"
            onClick={() => verify(code)}
            disabled={loading || code.length !== 6}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{' '}{tr("Verifying…")}</>
            ) : (
              tr('Verify email')
            )}
          </button>
          <p className="mt-6 text-center text-[13.5px] text-muted-foreground">{tr("Didn't get it?")}{' '}
            {countdown > 0 ? (
              <span className="tabular">{tr("Resend in {countdown}s", { countdown })}</span>
            ) : (
              <button type="button" onClick={resend} disabled={resending} className="font-semibold text-primary hover:underline disabled:opacity-60">
                {resending ? tr("Sending…") : tr("Send a new code")}
              </button>
            )}
          </p>
        </>
      )}
    </SplitSignInLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
