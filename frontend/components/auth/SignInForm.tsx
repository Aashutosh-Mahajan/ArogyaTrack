'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { OtpInput } from '@/components/auth/OtpInput';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { roleHome } from '@/lib/roles';
import { Input } from '@/components/ui/input';
import type { UserRole } from '@/types';
import { t, m } from '@/lib/i18n';

const schema = z.object({
  email: z.string().min(1, m('Enter your email')).email(m('Enter a valid email address')),
  password: z.string().min(1, m('Enter your password')),
});

type FormData = z.infer<typeof schema>;

interface SignInFormProps {
  /** Restrict sign-in to these roles; omit to accept any role. */
  roles?: UserRole[];
  roleName?: string;
  emailPlaceholder?: string;
  registerHref?: string;
  registerLabel?: string;
  notice?: React.ReactNode;
}

export function extractError(error: any, fallback = t('Something went wrong. Please try again.')) {
  const d = error?.response?.data;
  if (!d) return error?.message === 'Network Error' ? t("Cannot reach the server. Check that the API is running.") : fallback;
  if (typeof d === 'string') return fallback;
  if (d.non_field_errors?.[0]) return t(d.non_field_errors[0]);
  if (d.detail) return t(d.detail);
  if (d.message) return t(d.message);
  const first = Object.values(d)[0];
  if (Array.isArray(first) && typeof first[0] === 'string') return t(first[0]);
  if (typeof first === 'string') return t(first);
  return fallback;
}

export function SignInForm({
  roles,
  roleName,
  emailPlaceholder = 'you@example.com',
  registerHref = '/signup',
  registerLabel = t('Create an account'),
  notice,
}: SignInFormProps) {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ token: string; email: string } | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const { errors, isSubmitting } = form.formState;

  const finish = async (user: any) => {
    if (roles && !roles.includes(user.role)) {
      // Signed in through the wrong portal: end the session that was just created.
      try { await api.auth.logout(); } catch { /* ignore */ }
      setChallenge(null);
      setFormError(
        t("This account is registered as a {role}. Use the {value} sign-in instead.", { role: user.role, value: user.role === 'admin' ? 'authority' : user.role })
      );
      return;
    }
    setAuth(user);
    toast.success(t("Signed in as {value}", { value: user.first_name || user.email }));
    router.push(roleHome(user.role));
  };

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      const response: any = await api.auth.login(data.email.trim(), data.password);
      if (response.requires_2fa) {
        setChallenge({ token: response.challenge, email: response.email });
        return;
      }
      await finish(response.user);
    } catch (error: any) {
      setFormError(extractError(error, t("Email or password is incorrect.")));
    }
  };

  const verifyCode = async (value: string) => {
    if (!challenge || value.length !== 6) return;
    setVerifying(true);
    setFormError(null);
    try {
      const response: any = await api.auth.verifyLogin2FA(challenge.token, value);
      await finish(response.user);
    } catch (error: any) {
      const d = error?.response?.data;
      setFormError(d?.otp?.[0] || extractError(error, t("That code did not work.")));
      setCode('');
      if (error?.response?.status === 400 && d?.detail) setChallenge(null);
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!challenge) return;
    try {
      await api.auth.resendLogin2FA(challenge.token);
      toast.success(t("A new code is on its way"));
    } catch (error) {
      setFormError(extractError(error, t("Could not send a new code.")));
    }
  };

  if (challenge) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-3.5 py-3 text-[13.5px]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{t("Two-step sign-in is on. Enter the 6-digit code sent to")}{' '}<span className="font-medium text-foreground">{challenge.email}</span>.
          </span>
        </div>
        {formError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        <OtpInput value={code} onChange={setCode} onComplete={verifyCode} invalid={!!formError} disabled={verifying} />
        <button
          type="button"
          onClick={() => verifyCode(code)}
          disabled={verifying || code.length !== 6}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60"
        >
          {verifying ? <><Loader2 className="h-4 w-4 animate-spin" />{' '}{t("Verifying…")}</> : t('Verify and sign in')}
        </button>
        <div className="flex justify-between text-[13px]">
          <button type="button" onClick={() => { setChallenge(null); setCode(''); setFormError(null); }} className="text-muted-foreground hover:text-foreground">{t("Use a different account")}</button>
          <button type="button" onClick={resend} className="font-medium text-primary hover:underline">{t("Resend code")}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {notice}

      {formError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-medium text-foreground">{t("Email")}</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={emailPlaceholder}
            aria-invalid={!!errors.email}
            className="pl-10"
            {...form.register('email')}
          />
        </div>
        {errors.email && <p className="text-xs font-medium text-destructive">{t(errors.email.message ?? '')}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-[13px] font-medium text-foreground">{t("Password")}</label>
          <Link href="/forgot-password" className="text-[12.5px] font-medium text-primary hover:underline">{t("Forgot password?")}</Link>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t("Your password")}
            aria-invalid={!!errors.password}
            className="pl-10 pr-10"
            {...form.register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={showPassword ? t("Hide password") : t("Show password")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs font-medium text-destructive">{t(errors.password.message ?? '')}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="group mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-button transition-[transform,opacity] active:scale-[0.99] disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />{' '}{t("Signing in…")}</>
        ) : (
          <>{roleName ? t("Sign in as {role}", { role: roleName }) : t("Sign in")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      {registerHref && (
        <p className="pt-3 text-center text-[13.5px] text-muted-foreground">{t("New here?")}{' '}
          <Link href={registerHref} className="font-semibold text-primary hover:underline">
            {registerLabel}
          </Link>
        </p>
      )}
    </form>
  );
}

export function AuthHeading({ eyebrow, title, description }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <div className="kicker mb-3 text-primary">{eyebrow}</div>}
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground">{title}</h1>
      {description && <p className="mt-2 text-[14.5px] text-muted-foreground">{description}</p>}
    </div>
  );
}
