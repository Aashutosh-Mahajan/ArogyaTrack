'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Loader2, MapPin, Pencil, Plus, ShieldCheck, User, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { EmptyState, Panel, Skeleton, StatusPill } from '@/components/ui/page';
import { Switch } from '@/components/ui/switch';
import { Field, fieldClass, flattenErrors } from '@/components/auth/FormKit';
import { initialsOf } from '@/components/layout/useShell';
import { cn } from '@/lib/utils';
import type { PatientProfile, Profile } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONS = [
  { value: 'child', get label() { return tr("Child"); } },
  { value: 'parent', get label() { return tr("Parent"); } },
  { value: 'spouse', get label() { return tr("Spouse"); } },
  { value: 'sibling', get label() { return tr("Sibling"); } },
  { value: 'other', get label() { return tr("Other"); } },
];
const REL_LABEL: Record<string, string> = { get self() { return tr("Account holder"); }, get child() { return tr("Child"); }, get parent() { return tr("Parent"); }, get spouse() { return tr("Spouse"); }, get sibling() { return tr("Sibling"); }, get other() { return tr("Family member"); } };

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

function ageFrom(dob: string) {
  const d = new Date(dob);
  const t = new Date();
  return t.getFullYear() - d.getFullYear() - (t < new Date(t.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}

/* ─── Add family member ───────────────────────────────────────────── */
function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', relationship: 'child', gender: 'female', blood_group: '', date_of_birth: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      api.patients.createProfile({
        name: form.name.trim(),
        relationship: form.relationship as any,
        gender: form.gender as any,
        blood_group: form.blood_group as any,
        date_of_birth: form.date_of_birth,
        age: ageFrom(form.date_of_birth),
        ...(form.phone ? { phone: form.phone } : {}),
      } as any),
    onSuccess: () => {
      toast.success(tr("{name} added to your family", { name: form.name }));
      qc.invalidateQueries({ queryKey: ['my-profiles'] });
      onOpenChange(false);
      setForm({ name: '', relationship: 'child', gender: 'female', blood_group: '', date_of_birth: '', phone: '' });
    },
    onError: (e: any) => setErrors(flattenErrors(e?.response?.data)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!/^[A-Za-z\s'-]{2,100}$/.test(form.name.trim())) er.name = tr("Letters and spaces only, at least 2 characters");
    if (!form.date_of_birth) er.date_of_birth = tr("Enter a date of birth");
    if (!form.blood_group) er.blood_group = tr("Choose a blood group");
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) er.phone = '10-digit mobile number';
    setErrors(er);
    if (!Object.keys(er).length) create.mutate();
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-pop data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-[17px] font-semibold">{tr("Add a family member")}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[13.5px] text-muted-foreground">{tr("They get their own health ID and records under your account.")}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Close")}><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <Field label={tr("Full name")} required error={errors.name}>
              {(id) => <input id={id} value={form.name} onChange={set('name')} className={fieldClass(!!errors.name)} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr("Relationship")} required error={errors.relationship}>
                {(id) => (
                  <select id={id} value={form.relationship} onChange={set('relationship')} className={fieldClass()}>
                    {RELATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                )}
              </Field>
              <Field label={tr("Gender")} required>
                {(id) => (
                  <select id={id} value={form.gender} onChange={set('gender')} className={fieldClass()}>
                    <option value="female">{tr("Female")}</option>
                    <option value="male">{tr("Male")}</option>
                    <option value="other">{tr("Other")}</option>
                  </select>
                )}
              </Field>
              <Field label={tr("Date of birth")} required error={errors.date_of_birth}>
                {(id) => <input id={id} type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth} onChange={set('date_of_birth')} className={fieldClass(!!errors.date_of_birth)} />}
              </Field>
              <Field label={tr("Blood group")} required error={errors.blood_group}>
                {(id) => (
                  <select id={id} value={form.blood_group} onChange={set('blood_group')} className={fieldClass(!!errors.blood_group)}>
                    <option value="">{tr("Select")}</option>
                    {BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <Field label={tr("Mobile number")} error={errors.phone} hint={tr("Optional")}>
              {(id) => <input id={id} inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} className={fieldClass(!!errors.phone)} />}
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{tr("Cancel")}</Dialog.Close>
              <button type="submit" disabled={create.isPending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{tr("Add member")}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── Main view ───────────────────────────────────────────────────── */
export function ProfileView() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (params.get('add') === '1') setAdding(true);
  }, [params]);

  const profileQ = useQuery<Profile>({ queryKey: ['profile'], queryFn: () => api.patients.getProfile() });
  const consentQ = useQuery<PatientProfile>({ queryKey: ['patient-profile'], queryFn: () => api.patients.getPatientProfile(), retry: false });
  const familyQ = useQuery({ queryKey: ['my-profiles'], queryFn: () => api.patients.getMyProfiles() as Promise<{ active_profile_id: string; profiles: Profile[] }> });
  const profile = profileQ.data;

  const save = useMutation({
    mutationFn: (data: Partial<Profile>) => api.patients.updateProfile(data),
    onSuccess: (res: any) => {
      toast.success(tr("Profile updated"));
      setEditing(false);
      setErrors({});
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['my-profiles'] });
      qc.invalidateQueries({ queryKey: ['patient-card'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (res?.name) {
        const [first, ...rest] = String(res.name).split(' ');
        updateUser({ first_name: first, last_name: rest.join(' ') });
      }
    },
    onError: (e: any) => setErrors(flattenErrors(e?.response?.data)),
  });

  const sharing = useMutation({
    mutationFn: (v: boolean) => api.patients.updatePatientProfile({ data_sharing_enabled: v } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-profile'] });
      toast.success(tr("Preference saved"));
    },
  });

  const switchTo = useMutation({
    mutationFn: (id: string) => api.patients.switchProfile(id),
    onSuccess: async () => {
      toast.success(tr("Switched profile"));
      await qc.invalidateQueries();
    },
  });

  const startEdit = () => {
    if (!profile) return;
    setForm({
      name: profile.name,
      phone: profile.phone,
      date_of_birth: profile.date_of_birth,
      blood_group: profile.blood_group,
      gender: profile.gender,
      address: profile.address,
      district: profile.district,
      state: profile.state,
      pincode: profile.pincode,
    });
    setErrors({});
    setEditing(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Profile> = { ...form };
    if (form.date_of_birth) (payload as any).age = ageFrom(form.date_of_birth);
    save.mutate(payload);
  };

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (profileQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return <EmptyState icon={User} title={tr("No profile found")} description={tr("Your account does not have a patient profile yet.")} />;
  }

  const family = familyQ.data?.profiles ?? [];
  const activeId = String(familyQ.data?.active_profile_id ?? profile.id);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Identity */}
        <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-xl font-semibold text-primary-foreground">
            {initialsOf(profile.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[22px] font-semibold tracking-tight">{profile.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span className="font-mono">{profile.patient_id}</span>
              <span aria-hidden="true">·</span>
              <span>{REL_LABEL[profile.relationship] ?? cap(profile.relationship)}</span>
              {profile.date_of_birth && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{tr("{ageFrom} years", { ageFrom: ageFrom(profile.date_of_birth) })}</span>
                </>
              )}
            </div>
          </div>
          {!editing && (
            <button onClick={startEdit} className="inline-flex h-9 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13px] font-medium shadow-sm hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" />{' '}{tr("Edit details")}</button>
          )}
        </section>

        {editing ? (
          <Panel title={tr("Edit details")} icon={Pencil}>
            <form onSubmit={submit} className="space-y-5" noValidate>
              {errors.non_field_errors && <p className="text-sm text-destructive">{errors.non_field_errors}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={tr("Full name")} error={errors.name}>{(id) => <input id={id} value={form.name || ''} onChange={set('name')} className={fieldClass(!!errors.name)} />}</Field>
                <Field label={tr("Mobile number")} error={errors.phone}>{(id) => <input id={id} value={form.phone || ''} onChange={set('phone')} className={fieldClass(!!errors.phone)} />}</Field>
                <Field label={tr("Date of birth")} error={errors.date_of_birth}>{(id) => <input id={id} type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth || ''} onChange={set('date_of_birth')} className={fieldClass(!!errors.date_of_birth)} />}</Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={tr("Gender")} error={errors.gender}>
                    {(id) => (
                      <select id={id} value={form.gender || ''} onChange={set('gender')} className={fieldClass()}>
                        <option value="female">{tr("Female")}</option>
                        <option value="male">{tr("Male")}</option>
                        <option value="other">{tr("Other")}</option>
                      </select>
                    )}
                  </Field>
                  <Field label={tr("Blood group")} error={errors.blood_group}>
                    {(id) => (
                      <select id={id} value={form.blood_group || ''} onChange={set('blood_group')} className={fieldClass()}>
                        {BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    )}
                  </Field>
                </div>
              </div>
              <Field label={tr("Address")} error={errors.address}>{(id) => <textarea id={id} rows={2} value={form.address || ''} onChange={set('address')} className={`${fieldClass(!!errors.address)} h-auto py-2.5`} />}</Field>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label={tr("District")} error={errors.district}>{(id) => <input id={id} value={form.district || ''} onChange={set('district')} className={fieldClass(!!errors.district)} />}</Field>
                <Field label={tr("State")} error={errors.state}>{(id) => <input id={id} value={form.state || ''} onChange={set('state')} className={fieldClass(!!errors.state)} />}</Field>
                <Field label={tr("PIN code")} error={errors.pincode}>{(id) => <input id={id} value={form.pincode || ''} onChange={set('pincode')} className={fieldClass(!!errors.pincode)} />}</Field>
              </div>
              <div className="flex justify-end gap-2 border-t pt-5">
                <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{tr("Cancel")}</button>
                <button type="submit" disabled={save.isPending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{tr("Save changes")}</button>
              </div>
            </form>
          </Panel>
        ) : (
          <>
            <Panel title={tr("Personal details")} icon={User}>
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label={tr("Date of birth")} value={fmt(profile.date_of_birth)} />
                <Detail label={tr("Gender")} value={cap(profile.gender)} />
                <Detail label={tr("Blood group")} value={profile.blood_group} />
                <Detail label={tr("Mobile")} value={profile.phone} />
                <Detail label={tr("Member since")} value={fmt(profile.created_at)} />
                <Detail label={tr("Last updated")} value={fmt(profile.updated_at)} />
              </dl>
            </Panel>
            <Panel title={tr("Address")} icon={MapPin}>
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3"><Detail label={tr("Street address")} value={profile.address} /></div>
                <Detail label={tr("District")} value={profile.district} />
                <Detail label={tr("State")} value={profile.state} />
                <Detail label={tr("PIN code")} value={profile.pincode} />
              </dl>
            </Panel>
          </>
        )}
      </div>

      <div className="space-y-6">
        <Panel
          title={tr("Family")}
          description={tr("Profiles managed from this account")}
          icon={Users}
          actions={
            <button onClick={() => setAdding(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-[12.5px] font-medium text-primary hover:bg-primary/15">
              <Plus className="h-3.5 w-3.5" />{' '}{tr("Add")}</button>
          }
        >
          {familyQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <ul className="space-y-2">
              {family.map((p) => {
                const active = String(p.id) === activeId;
                return (
                  <li key={p.id} className={cn('flex items-center gap-3 rounded-xl border p-3', active && 'border-primary/40 bg-primary/5')}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">{initialsOf(p.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{REL_LABEL[p.relationship] ?? p.relationship} · {p.blood_group}</div>
                    </div>
                    {active ? (
                      <StatusPill tone="primary" dot={false}><Check className="h-3 w-3" />{' '}{tr("Viewing")}</StatusPill>
                    ) : (
                      <button
                        onClick={() => switchTo.mutate(String(p.id))}
                        disabled={switchTo.isPending}
                        className="h-8 rounded-lg border px-2.5 text-[12.5px] font-medium hover:bg-muted disabled:opacity-60"
                      >{tr("Switch")}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {consentQ.data && (
          <Panel title={tr("Privacy & consent")} icon={ShieldCheck}>
            <ul className="space-y-3 text-[13.5px]">
              {[
                { label: tr("Terms of service"), ok: consentQ.data.terms_accepted, at: consentQ.data.terms_accepted_at },
                { label: tr("Secure record storage"), ok: consentQ.data.consent_store_data, at: consentQ.data.consent_store_data_at },
                { label: tr("Doctor access via health card"), ok: consentQ.data.consent_doctor_access, at: consentQ.data.consent_doctor_access_at },
              ].map((c) => (
                <li key={c.label} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{c.label}</div>
                    {c.at && <div className="text-xs text-muted-foreground">{tr("Given {fmt}", { fmt: fmt(c.at) })}</div>}
                  </div>
                  <StatusPill tone={c.ok ? 'success' : 'neutral'}>{c.ok ? tr("Given") : tr("Not given")}</StatusPill>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-start justify-between gap-4 border-t pt-4">
              <div>
                <div className="text-[13.5px] font-medium">{tr("Share anonymised data for research")}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{tr("Only aggregated, k-anonymised statistics are ever shared.")}</div>
              </div>
              <Switch
                checked={!!consentQ.data.data_sharing_enabled}
                disabled={sharing.isPending}
                onCheckedChange={(v) => sharing.mutate(v)}
                aria-label={tr("Share anonymised data for research")}
              />
            </div>
          </Panel>
        )}
      </div>

      <AddMemberDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
