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
import { CheckRow, ChipToggle, Field, FileDrop, PasswordInput, Stepper, fieldClass, flattenErrors } from '@/components/auth/FormKit';
import type { PatientRegistrationData } from '@/types';
import { t, m } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

const STEPS = [m("About you"), m("Health history"), m("Contact"), m("Account")];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CONDITIONS = [m("Diabetes"), m("Hypertension"), m("Heart Disease"), m("Asthma"), m("Thyroid Disorder"), m("Kidney Disease"), m("Liver Disease"), m("Cancer"), m("None")];
const ALLERGIES = [m("Penicillin"), m("Aspirin"), m("Sulfa Drugs"), m("NSAIDs"), m("Latex"), m("Peanuts"), m("Shellfish"), m("None")];

/** Which step each backend field lives on, so server errors jump to the right place. */
const FIELD_STEP: Record<string, number> = {
  first_name: 0, last_name: 0, date_of_birth: 0, gender: 0, blood_group: 0,
  existing_conditions: 1, known_allergies: 1,
  email: 2, phone: 2, address: 2, district: 2, state: 2, pincode: 2,
  password: 3, aadhar_id_proof: 3, terms_accepted: 3, consent_store_data: 3, consent_doctor_access: 3,
};

type Form = {
  first_name: string; last_name: string; date_of_birth: string; gender: 'male' | 'female' | 'other'; blood_group: string;
  email: string; phone: string; address: string; district: string; state: string; pincode: string;
  password: string; terms_accepted: boolean; consent_store_data: boolean; consent_doctor_access: boolean;
};

export default function PatientRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Form>({
    first_name: '', last_name: '', date_of_birth: '', gender: 'male', blood_group: '',
    email: '', phone: '', address: '', district: '', state: '', pincode: '',
    password: '', terms_accepted: false, consent_store_data: false, consent_doctor_access: false,
  });
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [idProof, setIdProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };
  const onText = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(key, e.target.value as any);

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.first_name.trim().length < 2) e.first_name = t("Enter your first name");
      if (!form.last_name.trim()) e.last_name = t("Enter your last name");
      if (!form.date_of_birth) e.date_of_birth = t("Enter your date of birth");
      else if (new Date(form.date_of_birth) > new Date()) e.date_of_birth = t("Date of birth cannot be in the future");
      if (!form.blood_group) e.blood_group = t("Choose a blood group");
    }
    if (s === 2) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t("Enter a valid email address");
      if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = t("10-digit mobile number starting with 6–9");
      if (!form.address.trim()) e.address = t("Enter your address");
      if (!form.district.trim()) e.district = t("Enter your district");
      if (!form.state.trim()) e.state = t("Enter your state");
      if (form.pincode && !/^\d{6}$/.test(form.pincode)) e.pincode = t("6-digit PIN code");
    }
    if (s === 3) {
      if (form.password.length < 8) e.password = t("Use at least 8 characters");
      if (!form.terms_accepted) e.terms_accepted = t("Required");
      if (!form.consent_store_data) e.consent_store_data = t("Required");
      if (!form.consent_doctor_access) e.consent_doctor_access = t("Required");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validate(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (step < STEPS.length - 1) return next();
    if (!validate(3)) return;
    setLoading(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        email: form.email.trim().toLowerCase(),
        country: t("India"),
        existing_conditions: conditions.join(', '),
        known_allergies: allergies.join(', '),
        ...(idProof ? { aadhar_id_proof: idProof } : {}),
      };
      await api.auth.registerPatientWithDocuments(payload as unknown as PatientRegistrationData);
      toast.success(t("Account created. Check your email for a verification code."));
      router.push(`/verify-email?email=${encodeURIComponent(payload.email)}&role=patient`);
    } catch (err: any) {
      const fieldErrors = flattenErrors(err?.response?.data);
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
        const firstStep = Math.min(...Object.keys(fieldErrors).map((k) => FIELD_STEP[k] ?? 3));
        setStep(firstStep);
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
      headline={<>{tRich("Create your <em>health ID.</em>", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>}
      points={[
        t("A QR health card is issued as soon as you verify your email"),
        t("Allergies and conditions you add are visible to your doctors"),
        t("Add family members to the same account later"),
      ]}
    >
      <AuthHeading eyebrow={t("Patient registration")} title={t("Create a patient account")} />
      <Stepper steps={STEPS} current={step} />

      {formError && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-[13.5px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("Date of birth")} required error={errors.date_of_birth} className="sm:col-span-1">
                    {(id) => <input id={id} type="date" value={form.date_of_birth} max={new Date().toISOString().slice(0, 10)} onChange={onText('date_of_birth')} className={fieldClass(!!errors.date_of_birth)} />}
                  </Field>
                  <Field label={t("Gender")} error={errors.gender}>
                    {(id) => (
                      <select id={id} value={form.gender} onChange={onText('gender')} className={fieldClass()}>
                        <option value="male">{t("Male")}</option>
                        <option value="female">{t("Female")}</option>
                        <option value="other">{t("Other")}</option>
                      </select>
                    )}
                  </Field>
                  <Field label={t("Blood group")} required error={errors.blood_group}>
                    {(id) => (
                      <select id={id} value={form.blood_group} onChange={onText('blood_group')} className={fieldClass(!!errors.blood_group)}>
                        <option value="">{t("Select")}</option>
                        {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    )}
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-[14px] text-muted-foreground">{t("Optional. These are saved to your record so doctors see them before prescribing.")}</p>
                <div className="space-y-2">
                  <div className="text-[13px] font-medium">{t("Existing conditions")}</div>
                  <ChipToggle options={CONDITIONS} selected={conditions} onChange={setConditions} exclusive="None" allowCustom customPlaceholder={t("Another condition")} />
                </div>
                <div className="space-y-2">
                  <div className="text-[13px] font-medium">{t("Known allergies")}</div>
                  <ChipToggle options={ALLERGIES} selected={allergies} onChange={setAllergies} exclusive="None" allowCustom customPlaceholder={t("Another allergy")} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Email")} required error={errors.email}>
                    {(id) => <input id={id} type="email" value={form.email} onChange={onText('email')} autoComplete="email" placeholder="you@example.com" className={fieldClass(!!errors.email)} />}
                  </Field>
                  <Field label={t("Mobile number")} required error={errors.phone}>
                    {(id) => <input id={id} type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} autoComplete="tel-national" placeholder="98765 43210" className={fieldClass(!!errors.phone)} />}
                  </Field>
                </div>
                <Field label={t("Address")} required error={errors.address}>
                  {(id) => <textarea id={id} rows={2} value={form.address} onChange={onText('address')} autoComplete="street-address" className={`${fieldClass(!!errors.address)} h-auto py-2.5`} />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("District")} required error={errors.district}>
                    {(id) => <input id={id} value={form.district} onChange={onText('district')} className={fieldClass(!!errors.district)} />}
                  </Field>
                  <Field label={t("State")} required error={errors.state}>
                    {(id) => <input id={id} value={form.state} onChange={onText('state')} autoComplete="address-level1" className={fieldClass(!!errors.state)} />}
                  </Field>
                  <Field label={t("PIN code")} error={errors.pincode}>
                    {(id) => <input id={id} inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" className={fieldClass(!!errors.pincode)} />}
                  </Field>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <Field label={t("Password")} required error={errors.password}>
                  {(id) => <PasswordInput id={id} value={form.password} onChange={onText('password') as any} invalid={!!errors.password} />}
                </Field>
                <FileDrop label={t("Aadhaar or government ID (optional)")} file={idProof} onFile={setIdProof} error={errors.aadhar_id_proof} />
                <div className="space-y-1 rounded-xl border bg-muted/30 p-3">
                  <CheckRow checked={form.terms_accepted} onChange={(v) => set('terms_accepted', v)} invalid={!!errors.terms_accepted}>{t("I accept the terms of service and privacy policy.")}</CheckRow>
                  <CheckRow checked={form.consent_store_data} onChange={(v) => set('consent_store_data', v)} invalid={!!errors.consent_store_data}>{t("I consent to ArogyaTrack storing my health records securely.")}</CheckRow>
                  <CheckRow checked={form.consent_doctor_access} onChange={(v) => set('consent_doctor_access', v)} invalid={!!errors.consent_doctor_access}>{t("I allow doctors I share my health card with to view my records.")}</CheckRow>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          {step > 0 ? (
            <button type="button" onClick={back} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />{' '}{t("Back")}</button>
          ) : (
            <Link href="/patient/signin" className="text-[13.5px] text-muted-foreground hover:text-foreground">{t("Already registered?")}{' '}<span className="font-semibold text-primary">{t("Sign in")}</span>
            </Link>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-[14.5px] font-medium text-primary-foreground shadow-button transition-transform active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{' '}{t("Creating account…")}</>
            ) : step < STEPS.length - 1 ? (
              <>{t("Continue")}{' '}<ArrowRight className="h-4 w-4" /></>
            ) : (
              <>{t("Create account")}{' '}<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </form>
    </SplitSignInLayout>
  );
}
