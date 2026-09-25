'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Field, fieldClass, flattenErrors } from '@/components/auth/FormKit';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/lib/i18n';

export interface PharmacyInfo {
  id: string;
  name: string;
  license_number: string;
  address: string;
  district: string;
  phone: string;
  email: string;
  gstin?: string;
  is_active: boolean;
}

/** The signed-in pharmacist's pharmacy; `data` is null when none has been set up yet. */
export function useMyPharmacy() {
  return useQuery<PharmacyInfo | null>({
    queryKey: ['my-pharmacy'],
    queryFn: async () => {
      try {
        return (await api.pharmacy.getMine()) as PharmacyInfo;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function PharmacySetup({ initial, onSaved }: { initial?: PharmacyInfo | null; onSaved?: () => void }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const editing = !!initial;
  const [f, setF] = useState({
    name: initial?.name ?? '',
    license_number: initial?.license_number ?? '',
    address: initial?.address ?? '',
    district: initial?.district ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? user?.email ?? '',
    gstin: initial?.gstin ?? '',
  });
  const [err, setErr] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => (editing ? api.pharmacy.updateMine(f) : api.pharmacy.createMine(f)),
    onSuccess: () => {
      toast.success(editing ? t("Pharmacy details updated") : t("Pharmacy set up. You can now manage stock and dispense."));
      qc.invalidateQueries({ queryKey: ['my-pharmacy'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-stats'] });
      onSaved?.();
    },
    onError: (e: any) => setErr(flattenErrors(e?.response?.data)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = t("Enter the pharmacy name");
    if (!f.license_number.trim()) er.license_number = t("Enter the drug licence number");
    if (!f.address.trim()) er.address = t("Enter the address");
    if (!/^[6-9]\d{9}$|^\d{10,12}$/.test(f.phone.replace(/\D/g, ''))) er.phone = t("Enter a valid phone number");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) er.email = t("Enter a valid email");
    if (f.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(f.gstin.trim().toUpperCase())) er.gstin = t("Enter a valid 15-character GSTIN");
    setErr(er);
    if (!Object.keys(er).length) save.mutate();
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!editing && (
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-[13.5px]">
            <div className="font-semibold">{t("Set up your pharmacy")}</div>
            <p className="mt-0.5 text-muted-foreground">{t("Stock, dispensing records and the pharmacy directory doctors see are all tied to your pharmacy.")}</p>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Pharmacy name")} required error={err.name}>{(id) => <input id={id} value={f.name} onChange={set('name')} className={fieldClass(!!err.name)} />}</Field>
        <Field label={t("Drug licence number")} required error={err.license_number}>{(id) => <input id={id} value={f.license_number} onChange={set('license_number')} className={fieldClass(!!err.license_number)} />}</Field>
      </div>
      <Field label={t("Address")} required error={err.address}>{(id) => <textarea id={id} rows={2} value={f.address} onChange={set('address')} className={`${fieldClass(!!err.address)} h-auto py-2.5`} />}</Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("District")} error={err.district}>{(id) => <input id={id} value={f.district} onChange={set('district')} className={fieldClass()} />}</Field>
        <Field label={t("Phone")} required error={err.phone}>{(id) => <input id={id} inputMode="tel" value={f.phone} onChange={set('phone')} className={fieldClass(!!err.phone)} />}</Field>
        <Field label={t("Email")} required error={err.email}>{(id) => <input id={id} type="email" value={f.email} onChange={set('email')} className={fieldClass(!!err.email)} />}</Field>
      </div>
      <Field label={t("GSTIN (optional)")} error={err.gstin} hint={t("Printed on invoices. With a GSTIN, bills are issued as tax invoices.")}>
        {(id) => <input id={id} value={f.gstin ?? ''} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1Z5" maxLength={15} className={`${fieldClass(!!err.gstin)} font-mono uppercase`} />}
      </Field>
      <div className="flex justify-end">
        <button type="submit" disabled={save.isPending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? t("Save changes") : t("Create pharmacy")}
        </button>
      </div>
    </form>
  );
}
