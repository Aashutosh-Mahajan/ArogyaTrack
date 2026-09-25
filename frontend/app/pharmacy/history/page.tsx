'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, History, Search } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, StatusPill } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { cn } from '@/lib/utils';
import { money } from '@/lib/billing';
import { t, intlLocale } from '@/lib/i18n';

interface Row {
  id: string;
  medicine_name: string;
  dosage: string;
  patient_name: string;
  patient_uid: string;
  prescription_number: string;
  status: 'dispensed' | 'unavailable' | 'patient_has';
  quantity_dispensed: number;
  notes: string;
  dispensed_at: string;
  amount: string | null;
  invoice_number: string | null;
}

const STATUS = { dispensed: { get l() { return t("Dispensed"); }, t: 'success' as const }, unavailable: { get l() { return t("Unavailable"); }, t: 'danger' as const }, patient_has: { get l() { return t("Patient had it"); }, t: 'info' as const } };
const FILTERS = ['all', 'dispensed', 'unavailable', 'patient_has'] as const;

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function HistoryPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const q = useQuery<Row[]>({ queryKey: ['pharmacy-history'], queryFn: () => api.pharmacy.getDispensingRecords() as Promise<Row[]> });

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!s || r.medicine_name.toLowerCase().includes(s) || (r.patient_name || '').toLowerCase().includes(s) || r.prescription_number.toLowerCase().includes(s))
    );
  }, [q.data, filter, search]);

  const exportCsv = () => {
    const head = ['Date', 'Prescription', 'Patient', 'Patient ID', 'Medicine', 'Dose', 'Status', 'Quantity', 'Amount (INR)', 'Invoice', 'Notes'];
    const rows = list.map((r) => [new Date(r.dispensed_at).toISOString(), r.prescription_number, r.patient_name, r.patient_uid, r.medicine_name, r.dosage, STATUS[r.status]?.l ?? r.status, r.quantity_dispensed, r.amount ?? '', r.invoice_number ?? '', r.notes]);
    const blob = new Blob([[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = t("dispensing_{value}.csv", { value: new Date().toISOString().slice(0, 10) });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader
        title={t("Dispensing history")}
        description={t("Every item handed over, marked unavailable, or already with the patient, at your pharmacy.")}
        actions={
          <button onClick={exportCsv} disabled={!list.length} className="inline-flex h-10 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13.5px] font-medium shadow-sm hover:bg-muted disabled:opacity-50">
            <Download className="h-4 w-4" />{' '}{t("Export CSV")}</button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-[10px] border bg-card p-1 shadow-sm">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {f === 'all' ? t("All") : STATUS[f].l}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Medicine, patient or Rx number")} className={`${fieldClass()} h-10 pl-10`} aria-label={t("Search history")} />
        </div>
      </div>
      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={6} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !list.length ? (
        <EmptyState icon={History} title={q.data?.length ? t("Nothing matches") : t("No dispensing yet")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{t("When")}</th>
                <th className="px-5 py-3 font-medium">{t("Medicine")}</th>
                <th className="px-5 py-3 font-medium">{t("Patient")}</th>
                <th className="px-5 py-3 font-medium">{t("Prescription")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("Qty")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("Amount")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{new Date(r.dispensed_at).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className="px-5 py-3"><div className="font-medium">{r.medicine_name}</div><div className="text-xs text-muted-foreground">{r.dosage}</div></td>
                  <td className="px-5 py-3"><div>{r.patient_name}</div><div className="font-mono text-xs text-muted-foreground">{r.patient_uid}</div></td>
                  <td className="px-5 py-3 font-mono text-[13px]">{r.prescription_number}</td>
                  <td className="tabular px-5 py-3 text-right">{r.status === 'dispensed' ? r.quantity_dispensed : '—'}</td>
                  <td className="tabular px-5 py-3 text-right">
                    {r.status === 'dispensed' ? money(r.amount) : '—'}
                    {r.status === 'dispensed' && <div className="font-mono text-[11px] text-muted-foreground">{r.invoice_number ?? t("Not billed")}</div>}
                  </td>
                  <td className="px-5 py-3 text-right"><StatusPill tone={STATUS[r.status]?.t ?? 'neutral'}>{STATUS[r.status]?.l ?? r.status}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default withAuth(HistoryPage, ['pharmacist']);
