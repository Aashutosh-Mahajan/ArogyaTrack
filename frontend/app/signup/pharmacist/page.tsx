'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading } from '@/components/auth/SignInForm';
import { CheckRow, Field, FileDrop, PasswordInput, Stepper, fieldClass, flattenErrors } from '@/components/auth/FormKit';
import { t, m } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

const STEPS = [m("About you"), m("Licence & account")];
const DEGREES = [m("D.Pharm"), m("B.Pharm"), m("M.Pharm"), m("Pharm.D"), m("Ph.D (Pharmacy)")];
const FIELD_STEP: Record<string, number> = {
  first_name: 0, last_name: 0, email: 0, pharmacy_name: 0, degree: 0,
  license_number: 1, license_certificate: 1, password: 1, terms_accepted: 1,
};

type Form = {
  first_name: string; last_name: string; email: string; pharmacy_name: string; degree: string;
  license_number: string; password: string; terms_accepted: boolean;
};

export default function PharmacistRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Form>({
    first_name: '', last_name: '', email: '', pharmacy_name: '', degree: '',
    license_number: '', password: '', terms_accepted: false,
  });
  const [certificate, setCertificate] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };
  const onText = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, e.target.value as any);

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.first_name.trim().length < 2) e.first_name = t("Enter your first name");
      if (!form.last_name.trim()) e.last_name = t("Enter your last name");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t("Enter a valid email address");
      if (!form.degree) e.degree = t("Choose your qualification");
    }
    if (s === 1) {
      if (!form.license_number.trim()) e.license_number = t("Enter your pharmacy council registration number");
      if (!certificate) e.license_certificate = t("Upload your licence certificate");
      if (form.password.length < 8) e.password = t("Use at least 8 characters");
      if (!form.terms_accepted) e.terms_accepted = t("Required");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (step === 0) {
      if (validate(0)) setStep(1);
      return;
    }
    if (!validate(1)) return;
    setLoading(true);
    setFormError(null);
    try {
      const email = form.email.trim().toLowerCase();
      await api.auth.registerPharmacist({ ...form, email, license_number: form.license_number.trim(), license_certificate: certificate });
      toast.success(t("Account created. Check your email for a verification code."));
      router.push(`/verify-email?email=${encodeURIComponent(email)}&role=pharmacist`);
    } catch (err: any) {
      const fieldErrors = flattenErrors(err?.response?.data);
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
        setStep(Math.min(...Object.keys(fieldErrors).map((k) => FIELD_STEP[k] ?? 1)));
        setFormError(t("Some details need attention."));
      } else {
        setFormError(err?.response?.data?.detail || t("Registration failed. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SplitSignInLayout
      wide
      backHref="/signup"
      backLabel={t("Account types")}
      headline={<>{tRich("Dispense with <em>certainty.</em>", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>}
      points={[
        t("Verify prescription signatures before dispensing"),
        t("Record partial and full dispensing per item"),
        t("Keep stock, batches and expiry dates in one place"),
      ]}
    >
      <AuthHeading eyebrow={t("Pharmacist registration")} title={t("Register your pharmacy")} />
      <Stepper steps={STEPS} current={step} />

      {formError && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="space-y-5">
            {step === 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("First name")} required error={errors.first_name}>
                    {(id) => <input id={id} value={form.first_name} onChange={onText('first_name')} autoComplete="given-name" className={fieldClass(!!errors.first_name)} />}
                  </Field>
                  <Field label={t("Last name")} required error={errors.last_name}>
                    {(id) => <input id={id} value={form.last_name} onChange={onText('last_name')} autoComplete="family-name" className={fieldClass(!!errors.last_name)} />}
                  </Field>
                </div>
                <Field label={t("Email")} required error={errors.email}>
                  {(id) => <input id={id} type="email" value={form.email} onChange={onText('email')} autoComplete="email" placeholder="you@pharmacy.in" className={fieldClass(!!errors.email)} />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Pharmacy name")} error={errors.pharmacy_name}>
                    {(id) => <input id={id} value={form.pharmacy_name} onChange={onText('pharmacy_name')} autoComplete="organization" className={fieldClass(!!errors.pharmacy_name)} />}
                  </Field>
                  <Field label={t("Qualification")} required error={errors.degree}>
                    {(id) => (
                      <select id={id} value={form.degree} onChange={onText('degree')} className={fieldClass(!!errors.degree)}>
                        <option value="">{t("Select")}</option>
                        {DEGREES.map((d) => <option key={d} value={d}>{t(d)}</option>)}
                      </select>
                    )}
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label={t("Pharmacy council registration number")} required error={errors.license_number}>
                  {(id) => <input id={id} value={form.license_number} onChange={onText('license_number')} className={fieldClass(!!errors.license_number)} />}
                </Field>
                <FileDrop label={t("Licence certificate")} required file={certificate} onFile={(f) => { setCertificate(f); setErrors((e) => ({ ...e, license_certificate: '' })); }} error={errors.license_certificate} />
                <Field label={t("Password")} required error={errors.password}>
                  {(id) => <PasswordInput id={id} value={form.password} onChange={onText('password') as any} invalid={!!errors.password} />}
                </Field>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <CheckRow checked={form.terms_accepted} onChange={(v) => set('terms_accepted', v)} invalid={!!errors.terms_accepted}>{t("I accept the terms of service and confirm my licence details are accurate.")}</CheckRow>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(0)} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />{' '}{t("Back")}</button>
          ) : (
            <Link href="/pharmacist/signin" className="text-[13.5px] text-muted-foreground hover:text-foreground">{t("Already registered?")}{' '}<span className="font-semibold text-primary">{t("Sign in")}</span>
            </Link>
          )}
          <button type="submit" disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-[14.5px] font-medium text-primary-foreground shadow-button transition-transform active:scale-[0.98] disabled:opacity-70">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{' '}{t("Creating account…")}</> : step === 0 ? <>{t("Continue")}{' '}<ArrowRight className="h-4 w-4" /></> : <>{t("Create account")}{' '}<ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </form>
    </SplitSignInLayout>
  );
}
