'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Loader2, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading, extractError } from '@/components/auth/SignInForm';
import { OtpInput } from '@/components/auth/OtpInput';
import { Field, PasswordInput, fieldClass } from '@/components/auth/FormKit';
import { t } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors({ email: t("Enter a valid email address") });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      await api.auth.requestPasswordReset(email.trim().toLowerCase());
    } catch {
      // The response is the same either way, so accounts can't be enumerated.
    } finally {
      setLoading(false);
      setStep('reset');
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (code.length !== 6) fe.code = t("Enter the 6-digit code");
    if (password.length < 8) fe.password = t("Use at least 8 characters");
    if (password !== confirm) fe.confirm = t("Passwords do not match");
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;
    setLoading(true);
    setError(null);
    try {
      await api.auth.confirmPasswordReset(email.trim().toLowerCase(), code, password);
      router.push('/login?message=reset');
    } catch (err: any) {
      const d = err?.response?.data;
      setError(d?.otp?.[0] || d?.new_password?.[0] || extractError(err, t("Reset failed. Request a new code and try again.")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SplitSignInLayout backHref="/login" backLabel={t("Sign in")}>
      <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <KeyRound className="h-6 w-6" />
      </span>
      {step === 'email' ? (
        <>
          <AuthHeading title={t("Reset your password")} description={t("Enter the email on your account and we will send a reset code.")} />
          <form onSubmit={requestCode} className="space-y-4" noValidate>
            <Field label={t("Email")} error={fieldErrors.email}>
              {(id) => (
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id={id}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`${fieldClass(!!fieldErrors.email)} pl-10`}
                  />
                </div>
              )}
            </Field>
            <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-button disabled:opacity-70">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{' '}{t("Sending…")}</>
              ) : (
                t('Send reset code')
              )}
            </button>
          </form>
        </>
      ) : (
        <>
          <AuthHeading
            title={t("Choose a new password")}
            description={
              <>{t('If an account exists for {email}, a 6-digit code is on its way.', { email })}
              </>
            }
          />
          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <form onSubmit={reset} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <div className="text-[13px] font-medium">{t("Reset code")}</div>
              <OtpInput value={code} onChange={setCode} invalid={!!fieldErrors.code} />
              {fieldErrors.code && <p className="text-xs font-medium text-destructive">{fieldErrors.code}</p>}
            </div>
            <Field label={t("New password")} error={fieldErrors.password}>
              {(id) => <PasswordInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!fieldErrors.password} />}
            </Field>
            <Field label={t("Confirm new password")} error={fieldErrors.confirm}>
              {(id) => (
                <PasswordInput id={id} name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!fieldErrors.confirm} showMeter={false} />
              )}
            </Field>
            <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-button disabled:opacity-70">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{' '}{t("Updating…")}</>
              ) : (
                t('Update password')
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="w-full text-center text-[13.5px] text-muted-foreground hover:text-foreground"
            >{t("Use a different email")}</button>
          </form>
        </>
      )}
      <p className="mt-8 text-center text-[13.5px] text-muted-foreground">{t("Remembered it?")}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">{t("Sign in")}</Link>
      </p>
    </SplitSignInLayout>
  );
}
