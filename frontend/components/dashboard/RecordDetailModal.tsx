'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, Eye, FileText, Loader2, Stethoscope, X } from 'lucide-react';
import { api } from '@/lib/api';
import { openBlob } from '@/lib/print';
import { docPaths, getPdf } from '@/lib/documents';
import { StatusPill } from '@/components/ui/page';
import type { MedicalRecord, RecentRecord } from '@/types';
import { t as tr, intlLocale, tn } from '@/lib/i18n';

interface RecordDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: RecentRecord;
}

export const recordStatus = {
  completed: { get label() { return tr("Completed"); }, tone: 'success' as const },
  follow_up: { get label() { return tr("Follow-up"); }, tone: 'warning' as const },
  critical: { get label() { return tr("Critical"); }, tone: 'danger' as const },
};

/** The drawer speaks the dashboard's record shape; adapt a visit record to it. Visit records carry no status. */
export function visitToRecent(r: MedicalRecord): RecentRecord {
  const items = (r.prescription || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  return {
    id: r.id,
    visit_date: r.visit_date,
    visit_time: '',
    doctor_name: r.doctor_name,
    department: r.department,
    tests_performed: r.tests_performed,
    diagnosis_summary: r.diagnosis,
    prescription_text: r.prescription,
    doctor_notes: r.doctor_notes || '',
    prescriptions_count: items.length,
    status: undefined as unknown as RecentRecord['status'],
    attachments: (r.report_attachments || []) as unknown as RecentRecord['attachments'],
    created_at: r.created_at,
  };
}

export function doctorLabel(name?: string | null) {
  if (!name) return tr("Doctor");
  return /^dr\.?\s/i.test(name) ? name : tr("Dr. {name}", { name });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="kicker mb-2">{title}</h3>
      <div className="text-[14px] leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

export function RecordDetailModal({ open, onOpenChange, record }: RecordDetailModalProps) {
  // Visit-record listings carry no status; only show one when the API sent it.
  const st = record.status ? recordStatus[record.status] : null;
  const [busyId, setBusyId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const visitDate = new Date(record.visit_date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const rxItems = (record.prescription_text || '')
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/\.+$/, ''))
    .filter(Boolean);

  const logDownload = (file_type: string, file_id: number, file_name: string) =>
    api.dashboard
      .logDownload({ file_type, file_id, file_name })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-downloads'] });
      })
      .catch(() => {});

  const handleAttachment = async (id: number, fileName: string, mode: 'view' | 'download') => {
    setBusyId(id);
    try {
      const blob = await api.medical.downloadReport(id, mode === 'view' ? 'inline' : 'attachment');
      openBlob(blob, fileName, mode);
      if (mode === 'download') {
        toast.success(tr("Report downloaded"));
        logDownload('visit_attachment', id, fileName);
      }
    } catch (error: any) {
      const s = error?.response?.status;
      toast.error(s === 403 ? tr("You do not have access to this file.") : s === 404 ? tr("That file no longer exists.") : tr("Could not open the report."));
    } finally {
      setBusyId(null);
    }
  };

  const [pdfBusy, setPdfBusy] = useState<'view' | 'download' | null>(null);
  const handlePdf = async (mode: 'view' | 'download') => {
    setPdfBusy(mode);
    const ok = await getPdf(docPaths.visitRecord(record.id), `Visit_record_${record.visit_date.slice(0, 10)}.pdf`, mode);
    setPdfBusy(null);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-downloads'] });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l bg-card shadow-ambient-lg duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
          <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0">
              <div className="kicker text-primary">{tr("Visit record")}</div>
              <Dialog.Title className="mt-1.5 text-[19px] font-semibold first-letter:uppercase leading-snug tracking-tight">
                {record.diagnosis_summary || tr("Consultation")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] text-muted-foreground">
                {visitDate}
                {record.visit_time ? ` · ${record.visit_time}` : ''}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tr("Close")}>
              <X className="h-4 w-4" />
            </Dialog.Close>
          </header>

          <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-muted/30 p-3.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Stethoscope className="h-3.5 w-3.5" />{' '}{tr("Doctor")}</div>
                <div className="mt-1 truncate text-[14px] font-semibold">{doctorLabel(record.doctor_name)}</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3.5">
                <div className="text-xs text-muted-foreground">{tr("Department")}</div>
                <div className="mt-1 truncate text-[14px] font-semibold">{record.department || '—'}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {st && <StatusPill tone={st.tone}>{st.label}</StatusPill>}
              <span className="text-xs text-muted-foreground">
                {tn(record.prescriptions_count, '1 prescription item', '{count} prescription items')}
              </span>
            </div>

            {record.tests_performed && (
              <Section title={tr("Tests performed")}>
                <div className="flex flex-wrap gap-1.5">
                  {record.tests_performed.split('\n').filter(Boolean).map((t, i) => (
                    <span key={i} className="tag">{t.trim()}</span>
                  ))}
                </div>
              </Section>
            )}

            {rxItems.length > 0 && (
              <Section title={tr("Prescription")}>
                <ul className="divide-y rounded-xl border">
                  {rxItems.map((item, i) => (
                    <li key={i} className="px-3.5 py-2.5 text-[13.5px]">{item}</li>
                  ))}
                </ul>
              </Section>
            )}

            {record.doctor_notes && (
              <Section title={tr("Doctor notes")}>
                <p className="whitespace-pre-wrap text-[13.5px] text-foreground/85">{record.doctor_notes}</p>
              </Section>
            )}

            <Section title={tr("Reports{value}", { value: record.attachments.length ? ` (${record.attachments.length})` : '' })}>
              {record.attachments.length ? (
                <ul className="space-y-2">
                  {record.attachments.map((att) => (
                    <li key={att.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">{att.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {att.uploaded_by_name ? `${att.uploaded_by_name} · ` : ''}
                          {new Date(att.uploaded_at).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      {busyId === att.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => handleAttachment(att.id, att.file_name, 'view')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tr("View {file_name}", { file_name: att.file_name })}>
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleAttachment(att.id, att.file_name, 'download')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tr("Download {file_name}", { file_name: att.file_name })}>
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-muted-foreground">{tr("No reports were uploaded for this visit.")}</p>
              )}
            </Section>
          </div>

          <footer className="grid grid-cols-[auto_1fr] gap-2 border-t px-6 py-4">
            <button
              onClick={() => handlePdf('view')}
              disabled={!!pdfBusy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border px-4 text-[14px] font-medium hover:bg-muted disabled:opacity-60"
            >
              {pdfBusy === 'view' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{' '}{tr("View")}</button>
            <button
              onClick={() => handlePdf('download')}
              disabled={!!pdfBusy}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-button active:scale-[0.99] disabled:opacity-60"
            >
              {pdfBusy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{' '}{tr("Download PDF")}</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
