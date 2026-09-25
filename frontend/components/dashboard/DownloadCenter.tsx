'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Archive, ClipboardList, CreditCard, Download, FileText, FlaskConical, Loader2, Paperclip, ReceiptText, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { openBlob } from '@/lib/print';
import { EmptyState, ErrorState, SkeletonRows, Stat } from '@/components/ui/page';
import { PdfActions } from '@/components/ui/pdf-actions';
import { fieldClass } from '@/components/auth/FormKit';
import { cn } from '@/lib/utils';
import type { DashboardKPIs, DownloadItem } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

const TYPES: Record<DownloadItem['type'], { label: string; icon: typeof FileText; tint: string }> = {
  health_card: { get label() { return tr("Health card"); }, icon: CreditCard, tint: 'bg-primary/10 text-primary' },
  medical_record: { get label() { return tr("Visit record"); }, icon: FileText, tint: 'bg-primary/10 text-primary' },
  prescription: { get label() { return tr("Prescription"); }, icon: ClipboardList, tint: 'bg-success/12 text-success' },
  invoice: { get label() { return tr("Invoice"); }, icon: ReceiptText, tint: 'bg-info/12 text-info' },
  lab_summary: { get label() { return tr("Lab results"); }, icon: FlaskConical, tint: 'bg-warning/14 text-warning' },
  lab_report: { get label() { return tr("Lab report file"); }, icon: FlaskConical, tint: 'bg-warning/14 text-warning' },
  visit_attachment: { get label() { return tr("Uploaded report"); }, icon: Paperclip, tint: 'bg-muted text-muted-foreground' },
};

const FILTERS = [
  { key: 'all', get label() { return tr("All"); }, types: null },
  { key: 'visits', get label() { return tr("Visit records"); }, types: ['medical_record'] },
  { key: 'rx', get label() { return tr("Prescriptions"); }, types: ['prescription'] },
  { key: 'bills', get label() { return tr("Invoices"); }, types: ['invoice'] },
  { key: 'labs', get label() { return tr("Lab results"); }, types: ['lab_summary', 'lab_report'] },
  { key: 'files', get label() { return tr("Uploaded files"); }, types: ['visit_attachment'] },
] as const;

/** Display title in the current language (the API sends English titles). */
function titleFor(item: DownloadItem): string {
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const rx = item.title.match(/RX-[0-9A-F]+/)?.[0];
  const inv = item.title.match(/INV-[\w-]+/)?.[0];
  switch (item.type) {
    case 'health_card':
      return tr('Health card (printable, front and back)');
    case 'prescription':
      return rx ? tr('Prescription {number} – {date}', { number: rx, date: date(item.created_at) }) : item.title;
    case 'invoice':
      return inv ? tr('Invoice {number}', { number: inv }) : item.title;
    case 'lab_summary':
      return tr('All lab results');
    case 'medical_record':
      return `${item.record_data?.diagnosis_summary || tr('Visit record')} – ${date(item.record_data?.visit_date || item.created_at)}`;
    default:
      return item.title;
  }
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');

export function DownloadCenter() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  const items = useQuery<DownloadItem[]>({ queryKey: ['dashboard-downloads'], queryFn: () => api.dashboard.getDownloads() });
  const kpis = useQuery<DashboardKPIs>({ queryKey: ['dashboard-kpis'], queryFn: () => api.dashboard.getKPIs() });
  const refreshKpis = () => qc.invalidateQueries({ queryKey: ['dashboard-kpis'] });

  const all = useMemo(() => items.data ?? [], [items.data]);
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    const types = FILTERS.find((f) => f.key === filter)?.types as readonly string[] | null;
    return all.filter((i) => (!types || types.includes(i.type)) && (!s || titleFor(i).toLowerCase().includes(s) || i.visit_info?.toLowerCase().includes(s)));
  }, [all, filter, search]);
  const pdfCount = all.filter((i) => i.pdf_url).length;
  const fileCount = all.length - pdfCount;

  const downloadFile = async (item: DownloadItem) => {
    const key = `${item.type}-${item.id}`;
    setBusy(key);
    try {
      const blob = await api.dashboard.downloadFile(item.id as number, item.type as 'visit_attachment' | 'lab_report');
      openBlob(blob, safeName(item.title), 'download');
      refreshKpis();
    } catch {
      toast.error(tr("That file could not be downloaded."));
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      const blob = await api.dashboard.downloadAll();
      openBlob(blob, `ArogyaTrack_records_${new Date().toISOString().slice(0, 10)}.zip`, 'download');
      toast.success(tr("Your records archive is downloading"));
      refreshKpis();
    } catch {
      toast.error(tr("Could not build the archive. Please try again."));
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr("PDF documents")} value={pdfCount} icon={FileText} loading={items.isLoading} />
        <Stat label={tr("Uploaded files")} value={fileCount} icon={Paperclip} tone="info" loading={items.isLoading} />
        <Stat label={tr("Downloads so far")} value={kpis.data?.total_downloads ?? 0} icon={Download} tone="neutral" loading={kpis.isLoading} />
        <button
          onClick={downloadAll}
          disabled={zipping || all.length === 0}
          className="group flex flex-col justify-between rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          <span className="flex items-center justify-between text-[13px] font-medium text-primary">{tr("Download everything")}{zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
          </span>
          <span className="mt-3 text-[12.5px] text-muted-foreground">{tr("Every document as PDF, plus uploaded files, in one ZIP")}</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-[10px] border bg-card p-1 shadow-sm">
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
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search documents")} className={`${fieldClass()} h-10 pl-10`} aria-label={tr("Search documents")} />
        </div>
      </div>

      {items.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={5} /></div>
      ) : items.isError ? (
        <ErrorState onRetry={() => items.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Download} title={all.length ? tr("No documents match") : tr("Nothing to download yet")} description={all.length ? tr("Try another filter or search.") : tr("Visit records, prescriptions, invoices and lab results appear here as PDFs.")} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {list.map((item) => {
            const t = TYPES[item.type] ?? TYPES.visit_attachment;
            const key = `${item.type}-${item.id}`;
            const Icon = t.icon;
            return (
              <li key={key} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', t.tint)}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium first-letter:uppercase">{titleFor(item)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.label}{item.visit_info ? ` · ${item.visit_info}` : ''}
                    {item.type !== 'health_card' && ` · ${new Date(item.created_at).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </div>
                </div>
                {item.pdf_url ? (
                  <PdfActions path={item.pdf_url} fileName={`${safeName(item.title)}.pdf`} onDone={refreshKpis} className="shrink-0" />
                ) : (
                  <button
                    onClick={() => downloadFile(item)}
                    disabled={busy === key}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium hover:bg-muted disabled:opacity-60"
                  >
                    {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{tr("Original file")}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
