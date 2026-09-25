'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading } from '@/components/auth/SignInForm';
import { CheckRow, Field, FileDrop, PasswordInput, Stepper, fieldClass, flattenErrors } from '@/components/auth/FormKit';
import type { DoctorRegistrationData } from '@/types';
import { t, m } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

const STEPS = [m("About you"), m("Practice"), m("Documents")];
/* Must match DoctorRegistrationSerializer.degree choices. */
const DEGREES = ['MBBS', 'MD', 'MS', 'DNB', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'Other'];
const SPECIALIZATIONS = [
  m("General Medicine"), m("Cardiology"), m("Neurology"), m("Orthopaedics"), m("Paediatrics"), m("Dermatology"), m("Ophthalmology"), m("ENT"),
  m("Psychiatry"), m("Radiology"), m("Anaesthesiology"), m("General Surgery"), m("Obstetrics & Gynaecology"), m("Pulmonology"), m("Gastroenterology"),
];

const FIELD_STEP: Record<string, number> = {
  first_name: 0, last_name: 0, email: 0, phone: 0, date_of_birth: 0,
  medical_license: 1, degree: 1, degree_other: 1, specialization: 1, experience_years: 1, clinic_name: 1, clinic_address: 1, consultation_fee: 1,
  password: 2, license_certificate: 2, degree_certificate: 2, government_id: 2, terms_accepted: 2,
};

type Form = {
  first_name: string; last_name: string; email: string; phone: string; date_of_birth: string;
  medical_license: string; degree: string; degree_other: string; specialization: string; experience_years: string;
  clinic_name: string; clinic_address: string; consultation_fee: string;
  password: string; terms_accepted: boolean;
};

type Files = { license_certificate: File | null; degree_certificate: File | null; government_id: File | null };

function maxDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 23);
  return d.toISOString().slice(0, 10);
}

export default function DoctorRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Form>({
    first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
    medical_license: '', degree: 'MBBS', degree_other: '', specialization: '', experience_years: '',
    clinic_name: '', clinic_address: '', consultation_fee: '',
    password: '', terms_accepted: false,
  });
  const [files, setFiles] = useState<Files>({ license_certificate: null, degree_certificate: null, government_id: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };
  const onText = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(key, e.target.value as any);
  const setFile = (key: keyof Files) => (f: File | null) => {
    setFiles((p) => ({ ...p, [key]: f }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.first_name.trim().length < 2) e.first_name = t("Enter your first name");
      if (!form.last_name.trim()) e.last_name = t("Enter your last name");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t("Enter a valid email address");
      if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = t("10-digit mobile number starting with 6–9");
      if (!form.date_of_birth) e.date_of_birth = t("Enter your date of birth");
      else if (form.date_of_birth > maxDob()) e.date_of_birth = t("Doctors must be at least 23 years old");
    }
    if (s === 1) {
      if (!/^[A-Za-z0-9\-/]{6,20}$/.test(form.medical_license.trim())) e.medical_license = t("6–20 letters, digits, - or /");
      if (form.degree === 'Other' && !form.degree_other.trim()) e.degree_other = t("Name your degree");
      if (!form.specialization) e.specialization = t("Choose a specialisation");
      if (form.experience_years === '' || Number(form.experience_years) < 0) e.experience_years = t("Enter years of experience");
    }
    if (s === 2) {
      if (form.password.length < 8) e.password = t("Use at least 8 characters");
      if (!files.license_certificate) e.license_certificate = t("Upload your licence certificate");
      if (!files.degree_certificate) e.degree_certificate = t("Upload your degree certificate");
      if (!files.government_id) e.government_id = t("Upload a government ID");
      if (!form.terms_accepted) e.terms_accepted = t("Required");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validate(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (step < STEPS.length - 1) return next();
    if (!validate(2)) return;
    setLoading(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        email: form.email.trim().toLowerCase(),
        medical_license: form.medical_license.trim().toUpperCase(),
        experience_years: Number(form.experience_years),
        license_certificate: files.license_certificate,
        degree_certificate: files.degree_certificate,
        government_id: files.government_id,
      };
      if (form.degree !== 'Other') delete payload.degree_other;
      if (!form.consultation_fee) delete payload.consultation_fee;
      await api.auth.registerDoctorWithDocuments(payload as unknown as DoctorRegistrationData);
      toast.success(t("Registration submitted. Verify your email to continue."));
      router.push(`/verify-email?email=${encodeURIComponent(String(payload.email))}&role=doctor`);
    } catch (err: any) {
      const fieldErrors = flattenErrors(err?.response?.data);
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
        setStep(Math.min(...Object.keys(fieldErrors).map((k) => FIELD_STEP[k] ?? 2)));
        setFormError(fieldErrors.non_field_errors || t("Some details need attention."));
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
      headline={<>{tRich("Join the network as a <em>verified</em> clinician.", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>}
      points={[
        t("An administrator reviews your licence before patient data opens up"),
        t("Your documents are stored privately and used only for verification"),
        t("Once approved, scan health cards and prescribe with safety checks"),
      ]}
    >
      <AuthHeading eyebrow={t("Doctor registration")} title={t("Register as a doctor")} />
      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/8 px-3.5 py-3 text-[13px] text-foreground/80">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{t("After you verify your email, an administrator checks your licence. You can sign in meanwhile, but patient data stays locked until approval.")}</div>
      <Stepper steps={STEPS} current={step} />

      {formError && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="space-y-5">
            {step === 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("First name")} required error={errors.first_name}>
                    {(id) => <input id={id} value={form.first_name} onChange={onText('first_name')} autoComplete="given-name" className={fieldClass(!!errors.first_name)} />}
                  </Field>
                  <Field label={t("Last name")} required error={errors.last_name}>
                    {(id) => <input id={id} value={form.last_name} onChange={onText('last_name')} autoComplete="family-name" className={fieldClass(!!errors.last_name)} />}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Email")} required error={errors.email}>
                    {(id) => <input id={id} type="email" value={form.email} onChange={onText('email')} autoComplete="email" placeholder="you@hospital.in" className={fieldClass(!!errors.email)} />}
                  </Field>
                  <Field label={t("Mobile number")} required error={errors.phone}>
                    {(id) => <input id={id} type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} className={fieldClass(!!errors.phone)} />}
                  </Field>
                </div>
                <Field label={t("Date of birth")} required error={errors.date_of_birth} className="sm:max-w-[50%]">
                  {(id) => <input id={id} type="date" value={form.date_of_birth} max={maxDob()} onChange={onText('date_of_birth')} className={fieldClass(!!errors.date_of_birth)} />}
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Medical registration number")} required error={errors.medical_license} hint={t("As issued by your state medical council")}>
                    {(id) => <input id={id} value={form.medical_license} onChange={onText('medical_license')} placeholder={t("e.g. MH-2019-04821")} className={`${fieldClass(!!errors.medical_license)} uppercase`} />}
                  </Field>
                  <Field label={t("Years of experience")} required error={errors.experience_years}>
                    {(id) => <input id={id} type="number" min={0} max={60} value={form.experience_years} onChange={onText('experience_years')} className={fieldClass(!!errors.experience_years)} />}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Degree")} required error={errors.degree}>
                    {(id) => (
                      <select id={id} value={form.degree} onChange={onText('degree')} className={fieldClass(!!errors.degree)}>
                        {DEGREES.map((d) => <option key={d} value={d}>{t(d)}</option>)}
                      </select>
                    )}
                  </Field>
                  {form.degree === 'Other' ? (
                    <Field label={t("Degree name")} required error={errors.degree_other}>
                      {(id) => <input id={id} value={form.degree_other} onChange={onText('degree_other')} className={fieldClass(!!errors.degree_other)} />}
                    </Field>
                  ) : (
                    <Field label={t("Specialisation")} required error={errors.specialization}>
                      {(id) => (
                        <select id={id} value={form.specialization} onChange={onText('specialization')} className={fieldClass(!!errors.specialization)}>
                          <option value="">{t("Select")}</option>
                          {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                        </select>
                      )}
                    </Field>
                  )}
                </div>
                {form.degree === 'Other' && (
                  <Field label={t("Specialisation")} required error={errors.specialization}>
                    {(id) => (
                      <select id={id} value={form.specialization} onChange={onText('specialization')} className={fieldClass(!!errors.specialization)}>
                        <option value="">{t("Select")}</option>
                        {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                      </select>
                    )}
                  </Field>
                )}
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                  <Field label={t("Hospital or clinic")} error={errors.clinic_name}>
                    {(id) => <input id={id} value={form.clinic_name} onChange={onText('clinic_name')} className={fieldClass(!!errors.clinic_name)} />}
                  </Field>
                  <Field label={t("Consultation fee (₹)")} error={errors.consultation_fee}>
                    {(id) => <input id={id} type="number" min={0} step="1" value={form.consultation_fee} onChange={onText('consultation_fee')} className={fieldClass(!!errors.consultation_fee)} />}
                  </Field>
                </div>
                <Field label={t("Clinic address")} error={errors.clinic_address}>
                  {(id) => <textarea id={id} rows={2} value={form.clinic_address} onChange={onText('clinic_address')} className={`${fieldClass(!!errors.clinic_address)} h-auto py-2.5`} />}
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <Field label={t("Password")} required error={errors.password}>
                  {(id) => <PasswordInput id={id} value={form.password} onChange={onText('password') as any} invalid={!!errors.password} />}
                </Field>
                <FileDrop label={t("Medical licence certificate")} required file={files.license_certificate} onFile={setFile('license_certificate')} error={errors.license_certificate} />
                <FileDrop label={t("Degree certificate")} required file={files.degree_certificate} onFile={setFile('degree_certificate')} error={errors.degree_certificate} />
                <FileDrop label={t("Government ID")} required file={files.government_id} onFile={setFile('government_id')} error={errors.government_id} />
                <div className="rounded-xl border bg-muted/30 p-3">
                  <CheckRow checked={form.terms_accepted} onChange={(v) => set('terms_accepted', v)} invalid={!!errors.terms_accepted}>{t("I accept the terms of service and confirm these documents are genuine.")}</CheckRow>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />{' '}{t("Back")}</button>
          ) : (
            <Link href="/doctor/signin" className="text-[13.5px] text-muted-foreground hover:text-foreground">{t("Already registered?")}{' '}<span className="font-semibold text-primary">{t("Sign in")}</span>
            </Link>
          )}
          <button type="submit" disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-[14.5px] font-medium text-primary-foreground shadow-button transition-transform active:scale-[0.98] disabled:opacity-70">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{' '}{t("Submitting…")}</> : step < STEPS.length - 1 ? <>{t("Continue")}{' '}<ArrowRight className="h-4 w-4" /></> : <>{t("Submit for review")}{' '}<ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </form>
    </SplitSignInLayout>
  );
}
