'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ban, Check, ClipboardList, Loader2, PackageCheck, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusPill } from '@/components/ui/page';
import { extractError } from '@/components/auth/SignInForm';
import { doctorLabel } from '@/components/dashboard/RecordDetailModal';
import { cn } from '@/lib/utils';
import { estimateCost, money } from '@/lib/billing';
import { BillPanel } from './BillPanel';
import type { Prescription } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

interface InventoryRow {
  id: string;
  medicine: string;
  quantity_in_stock: number;
  unit_price: string | null;
  expiry_date: string | null;
}

const RX = {
  pending: { get l() { return t("Not dispensed"); }, t: 'info' as const },
  partially_dispensed: { get l() { return t("Partly dispensed"); }, t: 'warning' as const },
  fully_dispensed: { get l() { return t("Completed"); }, t: 'success' as const },
};
const ITEM = {
  pending: { get l() { return t("Pending"); }, t: 'neutral' as const },
  dispensed: { get l() { return t("Dispensed"); }, t: 'success' as const },
  unavailable: { get l() { return t("Unavailable"); }, t: 'danger' as const },
  patient_has: { get l() { return t("Patient has it"); }, t: 'info' as const },
};

/** Stock usable today per medicine (expired batches excluded). */
export function useStockByMedicine() {
  const inv = useQuery<InventoryRow[]>({ queryKey: ['pharmacy-inventory', false], queryFn: () => api.pharmacy.getInventory() as Promise<InventoryRow[]> });
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const m = new Map<string, number>();
    const batches = new Map<string, InventoryRow[]>();
    for (const r of inv.data ?? []) {
      batches.set(String(r.medicine), [...(batches.get(String(r.medicine)) ?? []), r]);
      if (r.expiry_date && r.expiry_date < today) continue;
      m.set(String(r.medicine), (m.get(String(r.medicine)) ?? 0) + r.quantity_in_stock);
    }
    return { stock: m, batches, loading: inv.isLoading };
  }, [inv.data, inv.isLoading]);
}

export function DispenseList({ prescriptions, onChanged }: { prescriptions: Prescription[]; onChanged: () => void }) {
  const qc = useQueryClient();
  const { stock, batches } = useStockByMedicine();
  const [qty, setQty] = useState<Record<string, string>>({});

  const act = useMutation({
    mutationFn: (v: { id: string; status: 'dispensed' | 'unavailable' | 'patient_has'; quantity?: number }) =>
      api.pharmacy.dispense({ prescription_medicine_id: v.id, status: v.status, ...(v.quantity ? { quantity_dispensed: v.quantity } : {}) }),
    onSuccess: (_d, v) => {
      toast.success(v.status === 'dispensed' ? t("Dispensed and stock updated") : v.status === 'unavailable' ? t("Marked unavailable") : t("Marked as already with patient"));
      ['pharmacy-inventory', 'pharmacy-stats', 'pharmacy-history', 'pharmacy-billing'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onChanged();
    },
    onError: (e: any) => {
      if (e?.response?.data?.code === 'pharmacy_missing') toast.error(t("Set up your pharmacy on the dashboard before dispensing."));
      else toast.error(extractError(e, t("Could not update this item.")));
    },
  });

  if (!prescriptions.length) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-[13.5px] text-muted-foreground">{t("No prescriptions on record for this patient.")}</p>;
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((rx) => {
        const st = RX[rx.status as keyof typeof RX] ?? RX.pending;
        return (
          <article key={rx.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="font-mono text-[14px] font-semibold">{(rx as any).prescription_number}</span>
              <StatusPill tone={st.t}>{st.l}</StatusPill>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Stethoscope className="h-3.5 w-3.5" /> {doctorLabel(rx.doctor_name)} · {new Date((rx as any).issued_at || rx.created_at).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </header>
            <ul className="divide-y">
              {rx.medicines.map((m) => {
                const is = ITEM[m.dispense_status as keyof typeof ITEM] ?? ITEM.pending;
                const inStock = stock.get(String(m.medicine)) ?? 0;
                const want = Number(qty[m.id] ?? m.quantity) || m.quantity;
                const busy = act.isPending && act.variables?.id === m.id;
                const pending = m.dispense_status === 'pending';
                const cost = pending ? estimateCost(batches.get(String(m.medicine)) ?? [], want) : null;
                return (
                  <li key={m.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14.5px] font-semibold">{m.medicine_name}</span>
                        <StatusPill tone={is.t}>{is.l}</StatusPill>
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted-foreground">
                        {t("{dosage} · {frequency} · {duration_days} days · qty {quantity}", { dosage: m.dosage, frequency: t(m.frequency), duration_days: m.duration_days, quantity: m.quantity }) + (m.special_instructions ? ` · ${m.special_instructions}` : '')}
                      </div>
                    </div>
                    {pending && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('tabular rounded-md px-2 py-1 text-xs font-medium', inStock >= want ? 'bg-success/12 text-success' : inStock > 0 ? 'bg-warning/14 text-warning' : 'bg-destructive/10 text-destructive')}>
                          {t("{inStock} in stock", { inStock })}</span>
                        <span className="tabular rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground" title={t("Cost at batch prices, earliest expiry first")}>
                          {cost === null ? t("No price set") : money(cost)}
                        </span>
                        <input
                          value={qty[m.id] ?? String(m.quantity)}
                          onChange={(e) => setQty({ ...qty, [m.id]: e.target.value.replace(/\D/g, '') })}
                          className="tabular h-9 w-16 rounded-lg border bg-card px-2 text-center text-[13px]"
                          aria-label={t("Quantity of {medicine_name}", { medicine_name: m.medicine_name })}
                        />
                        <button
                          onClick={() => act.mutate({ id: m.id, status: 'dispensed', quantity: want })}
                          disabled={busy || inStock < want}
                          title={inStock < want ? t("Not enough unexpired stock") : undefined}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-button disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{' '}{t("Dispense")}</button>
                        <button onClick={() => act.mutate({ id: m.id, status: 'patient_has' })} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium hover:bg-muted disabled:opacity-50">
                          <PackageCheck className="h-4 w-4" />{' '}{t("Has it")}</button>
                        <button onClick={() => act.mutate({ id: m.id, status: 'unavailable' })} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50">
                          <Ban className="h-4 w-4" />{' '}{t("Unavailable")}</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <BillPanel prescriptionId={rx.id} />
          </article>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">{t("Stock is deducted from the batch closest to expiry.")}{' '}<Link href="/pharmacy/inventory" className="font-medium text-primary hover:underline">{t("Manage inventory")}</Link>
      </p>
    </div>
  );
}
