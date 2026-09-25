'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ClipboardList, Loader2, QrCode, Stethoscope, X } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { docPaths } from '@/lib/documents';
import { PdfActions } from '@/components/ui/pdf-actions';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, StatusPill } from '@/components/ui/page';
import { doctorLabel } from '@/components/dashboard/RecordDetailModal';
import { cn } from '@/lib/utils';
import type { Prescription } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

const RX_STATUS: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  pending: { get label() { return tr("Not yet dispensed"); }, tone: 'info' },
  partially_dispensed: { get label() { return tr("Partly dispensed"); }, tone: 'warning' },
  fully_dispensed: { get label() { return tr("Dispensed"); }, tone: 'success' },
};
const ITEM_STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' | 'info' }> = {
  pending: { get label() { return tr("Pending"); }, tone: 'neutral' },
  dispensed: { get label() { return tr("Dispensed"); }, tone: 'success' },
  unavailable: { get label() { return tr("Unavailable"); }, tone: 'danger' },
  patient_has: { get label() { return tr("Already had"); }, tone: 'info' },
};
const FILTERS = [
  { key: 'all', get label() { return tr("All"); } },
  { key: 'active', get label() { return tr("Active"); } },
  { key: 'fully_dispensed', get label() { return tr("Dispensed"); } },
] as const;

const RX_LANGUAGES = [
  { code: 'en', get label() { return tr("English"); } },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'bn', label: 'বাংলা' },
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

/* QR for the pharmacy counter. The image endpoint is authenticated, so fetch it as a blob. */
function QrDialog({ rx, onClose }: { rx: Prescription; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoke: string | null = null;
    api.client.client
      .get(`/prescriptions/${rx.id}/qr-image/`, { responseType: 'blob' })
      .then((res) => {
        revoke = URL.createObjectURL(res.data);
        setUrl(revoke);
      })
      .catch(() => setFailed(true));
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [rx.id]);

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 text-center shadow-pop data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <Dialog.Close className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Close")}><X className="h-4 w-4" /></Dialog.Close>
          <Dialog.Title className="text-[17px] font-semibold">{(rx as any).prescription_number}</Dialog.Title>
          <Dialog.Description className="mt-1 text-[13.5px] text-muted-foreground">{tr("Show this code at the pharmacy counter.")}</Dialog.Description>
          <div className="mx-auto mt-5 flex h-60 w-60 items-center justify-center rounded-2xl border bg-white p-3">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={tr("Prescription QR code")} className="h-full w-full" />
            ) : failed ? (
              <span className="text-[13px] text-slate-500">{tr("QR code unavailable for this prescription.")}</span>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PrescriptionsPage(): React.JSX.Element {
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [qrFor, setQrFor] = useState<Prescription | null>(null);
  const [pdfLang, setPdfLang] = useState<string>(RX_LANGUAGES.some((l) => l.code === language) ? language : 'en');

  const q = useQuery({ queryKey: ['prescriptions-all'], queryFn: () => api.prescriptions.getAll({ limit: 100 }) });
  const all = useMemo(() => (q.data?.results ?? []) as Prescription[], [q.data]);
  const list = useMemo(
    () => all.filter((p) => (filter === 'all' ? true : filter === 'active' ? p.status !== 'fully_dispensed' : p.status === filter)),
    [all, filter]
  );

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div>
      <PageHeader title={t("My Prescriptions")} description={t("View all your prescriptions and medication details")} />

      <div className="mb-5 inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={4} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={ClipboardList} title={all.length ? tr("Nothing in this view") : tr("No prescriptions yet")} description={all.length ? tr("Try another filter.") : tr("Prescriptions your doctors issue will appear here with a QR code for the pharmacy.")} />
      ) : (
        <div className="space-y-3">
          {list.map((rx) => {
            const st = RX_STATUS[rx.status] ?? { label: rx.status, tone: 'neutral' as const };
            const meds = rx.medicines ?? [];
            const dispensed = meds.filter((m) => m.dispense_status === 'dispensed').length;
            const isOpen = open.has(rx.id);
            return (
              <article key={rx.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <button onClick={() => toggle(rx.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/40" aria-expanded={isOpen}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[14px] font-semibold">{(rx as any).prescription_number}</span>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {doctorLabel(rx.doctor_name)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{fmt((rx as any).issued_at || rx.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular">{tr("{dispensed}/{length} dispensed", { dispensed, length: meds.length })}</span>
                    </span>
                  </span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="border-t px-5 pb-5 pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-[13.5px]">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="pb-2 font-medium">{tr("Medicine")}</th>
                            <th className="pb-2 font-medium">{tr("Dosage")}</th>
                            <th className="pb-2 font-medium">{tr("Frequency")}</th>
                            <th className="pb-2 font-medium">{tr("Duration")}</th>
                            <th className="pb-2 text-right font-medium">{tr("Status")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {meds.map((m) => {
                            const is = ITEM_STATUS[m.dispense_status] ?? { label: m.dispense_status, tone: 'neutral' as const };
                            return (
                              <tr key={m.id}>
                                <td className="py-2.5 pr-3">
                                  <div className="font-medium">{m.medicine_name}</div>
                                  {m.special_instructions && <div className="text-xs text-muted-foreground">{m.special_instructions}</div>}
                                </td>
                                <td className="py-2.5 pr-3">{m.dosage}</td>
                                <td className="py-2.5 pr-3">{m.frequency}</td>
                                <td className="tabular py-2.5 pr-3">{tr("{duration_days} days", { duration_days: m.duration_days })}</td>
                                <td className="py-2.5 text-right"><StatusPill tone={is.tone}>{is.label}</StatusPill></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setQrFor(rx)} className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button">
                        <QrCode className="h-4 w-4" />{' '}{tr("Show pharmacy QR")}</button>
                      <div className="inline-flex items-center gap-1.5">
                        <select value={pdfLang} onChange={(e) => setPdfLang(e.target.value)} aria-label={tr("Prescription language")} className="h-9 rounded-[10px] border bg-card px-2.5 text-[13px] shadow-sm">
                          {RX_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                        <PdfActions path={docPaths.prescription(rx.id, pdfLang)} fileName={`Prescription_${(rx as any).prescription_number}_${pdfLang}.pdf`} size="md" />
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {qrFor && <QrDialog rx={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  );
}

export default withAuth(PrescriptionsPage, ['patient']);
