'use client';

import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BadgeCheck, Building2, Check, ExternalLink, FileText, GraduationCap, Loader2, Mail, Phone, UserCheck, X } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, StatusPill } from '@/components/ui/page';
import { initialsOf } from '@/components/layout/useShell';
import { cn } from '@/lib/utils';
import { t as tr, intlLocale, m } from '@/lib/i18n';

// Document labels sent by the API; listed so the catalogs include them.
const DOC_LABELS = [m('Medical licence'), m('Degree certificate')];
void DOC_LABELS;

interface DoctorApplication {
  id: number;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  medical_license: string;
  specialization: string;
  phone: string;
  degree: string;
  degree_other?: string;
  experience_years: number;
  clinic_name: string;
  clinic_address: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by_email: string | null;
  approved_at: string | null;
  documents: { label: string; url: string }[];
  created_at: string;
}

const TABS = [
  { key: 'pending', get label() { return tr("Awaiting review"); } },
  { key: 'approved', get label() { return tr("Approved"); } },
  { key: 'rejected', get label() { return tr("Rejected"); } },
] as const;

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function ApprovalsPage(): React.JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('pending');
  const q = useQuery<DoctorApplication[]>({ queryKey: ['admin-doctors', tab], queryFn: () => api.admin.pendingDoctors(tab) });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) => api.admin.decideDoctor(id, action),
    onSuccess: (_r, v) => {
      toast.success(v.action === 'approve' ? tr("Doctor approved. They can now open patient records.") : tr("Application rejected"));
      qc.invalidateQueries({ queryKey: ['admin-doctors'] });
      qc.invalidateQueries({ queryKey: ['shell', 'pending-doctors'] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow={tr("Administration")}
        title={tr("Doctor approvals")}
        description={tr("Doctors can sign in after verifying their email, but cannot open patient data until you approve their licence here.")}
      />

      <div className="mb-5 inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={4} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={UserCheck} title={tab === 'pending' ? tr("No applications waiting") : tr("No {tab} doctors", { tab })} description={tab === 'pending' ? tr("New doctor registrations appear here once they sign up.") : undefined} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {q.data.map((d) => {
            const name = `${d.first_name} ${d.last_name}`.trim() || d.email;
            const busy = decide.isPending && decide.variables?.id === d.id;
            return (
              <article key={d.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">{initialsOf(name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold">{tr("Dr. {name}", { name })}</h2>
                      <StatusPill tone={d.approval_status === 'approved' ? 'success' : d.approval_status === 'rejected' ? 'danger' : 'warning'}>
                        {d.approval_status === 'pending' ? tr("Pending") : d.approval_status === 'approved' ? tr("Approved") : tr("Rejected")}
                      </StatusPill>
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted-foreground">{tr("{specialization} · applied {fmt}", { specialization: d.specialization, fmt: fmt(d.created_at) })}</div>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                  <div className="col-span-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">{tr("Registration no.")}</span>
                    <span className="ml-auto font-mono font-semibold">{d.medical_license}</span>
                  </div>
                  <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="truncate">{d.email}</span></div>
                  <div className="flex items-center gap-2">
                    {d.email_verified ? <StatusPill tone="success">{tr("Email verified")}</StatusPill> : <StatusPill tone="warning">{tr("Email unverified")}</StatusPill>}
                  </div>
                  <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{d.phone || '—'}</div>
                  <div className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />{tr("{value} · {experience_years} yrs", { value: d.degree === 'Other' ? d.degree_other : d.degree, experience_years: d.experience_years })}</div>
                  <div className="col-span-2 flex items-start gap-2"><Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />{d.clinic_name ? `${d.clinic_name}${d.clinic_address ? `, ${d.clinic_address}` : ''}` : tr("No clinic listed")}</div>
                </dl>

                <div className="mt-4">
                  <div className="kicker mb-2">{tr("Documents")}</div>
                  {d.documents.length ? (
                    <div className="flex flex-wrap gap-2">
                      {d.documents.map((doc) => (
                        <a key={doc.label} href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-muted">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {tr(doc.label)} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">{tr("No documents uploaded.")}</p>
                  )}
                </div>

                {d.approval_status === 'pending' ? (
                  <div className="mt-5 flex gap-2 border-t pt-4">
                    <AlertDialog.Root>
                      <AlertDialog.Trigger asChild>
                        <button disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60">
                          <X className="h-4 w-4" />{' '}{tr("Reject")}</button>
                      </AlertDialog.Trigger>
                      <AlertDialog.Portal>
                        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" />
                        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-pop">
                          <AlertDialog.Title className="text-[17px] font-semibold">{tr("Reject Dr. {name}?", { name })}</AlertDialog.Title>
                          <AlertDialog.Description className="mt-2 text-[14px] text-muted-foreground">{tr("They will keep their account but will not be able to open patient records.")}</AlertDialog.Description>
                          <div className="mt-6 flex justify-end gap-2">
                            <AlertDialog.Cancel className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{tr("Cancel")}</AlertDialog.Cancel>
                            <AlertDialog.Action onClick={() => decide.mutate({ id: d.id, action: 'reject' })} className="h-10 rounded-[10px] bg-destructive px-4 text-[13.5px] font-medium text-destructive-foreground">{tr("Reject")}</AlertDialog.Action>
                          </div>
                        </AlertDialog.Content>
                      </AlertDialog.Portal>
                    </AlertDialog.Root>
                    <button
                      onClick={() => decide.mutate({ id: d.id, action: 'approve' })}
                      disabled={busy}
                      className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-button disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{' '}{tr("Approve licence")}</button>
                  </div>
                ) : (
                  <div className="mt-5 border-t pt-4 text-[12.5px] text-muted-foreground">
                    {d.approved_by_email
                      ? tr(d.approval_status === 'approved' ? 'Approved {date} by {admin}' : 'Rejected {date} by {admin}', { date: fmt(d.approved_at), admin: d.approved_by_email })
                      : tr(d.approval_status === 'approved' ? 'Approved {date}' : 'Rejected {date}', { date: fmt(d.approved_at) })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default withAuth(ApprovalsPage, ['admin']);
