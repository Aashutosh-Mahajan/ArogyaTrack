'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlarmClock, CalendarCheck, Check, Clock, History, Loader2, Pill } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton, SkeletonRows, StatusPill } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import type { AdherenceTracker, Prescription } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

interface Dose {
  id: string;
  medicine_name?: string;
  scheduled_time: string;
  is_taken: boolean;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const fmtWhen = (d: string) => new Date(d).toLocaleString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function band(p: number) {
  if (p >= 85) return { label: tr("On track"), tone: 'success' as const, stroke: 'hsl(var(--success))' };
  if (p >= 70) return { label: tr("Slipping"), tone: 'warning' as const, stroke: 'hsl(var(--warning))' };
  return { label: tr("Needs attention"), tone: 'danger' as const, stroke: 'hsl(var(--destructive))' };
}

function Ring({ pct }: { pct: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const b = band(pct);
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={b.stroke} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (Math.min(pct, 100) / 100) * c} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[28px] font-semibold leading-none tracking-tight">{Math.round(pct)}%</span>
        <span className="mt-1 text-[11px] text-muted-foreground">{tr("adherence")}</span>
      </div>
    </div>
  );
}

function AdherencePage(): React.JSX.Element {
  const qc = useQueryClient();
  const trackers = useQuery({ queryKey: ['adherence-trackers'], queryFn: () => api.adherence.getTrackers({ limit: 50 }) });
  const upcoming = useQuery<Dose[]>({ queryKey: ['adherence-upcoming'], queryFn: () => api.adherence.getUpcomingDoses() as any });
  const missed = useQuery<Dose[]>({ queryKey: ['adherence-missed'], queryFn: () => api.adherence.getMissedDoses() as any });
  const rx = useQuery({ queryKey: ['prescriptions-all'], queryFn: () => api.prescriptions.getAll({ limit: 100 }) });

  const record = useMutation({
    mutationFn: (dose: Dose) => api.adherence.markDoseTaken({ dose_schedule_id: dose.id, taken_at: new Date().toISOString() }),
    onSuccess: (_d, dose) => {
      toast.success(dose.medicine_name ? tr('{medicine} recorded', { medicine: dose.medicine_name }) : tr('Dose recorded'));
      ['adherence-trackers', 'adherence-upcoming', 'adherence-missed', 'dashboard-summary'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });

  const list = ((trackers.data as any)?.results ?? []) as (AdherenceTracker & { prescription_id?: string })[];
  const rxById = useMemo(() => new Map(((rx.data?.results ?? []) as Prescription[]).map((p) => [p.id, p])), [rx.data]);
  const active = list.filter((t) => t.is_active);
  const expected = active.reduce((n, t) => n + t.expected_doses, 0);
  const taken = active.reduce((n, t) => n + t.actual_doses, 0);
  const overall = expected ? (taken / expected) * 100 : 0;
  const recentMissed = (missed.data ?? []).filter((d) => Date.now() - new Date(d.scheduled_time).getTime() < 7 * 86_400_000);

  return (
    <div>
      <PageHeader title={tr("Medication adherence")} description={tr("Record doses as you take them. Your doctor sees your adherence when reviewing your treatment.")} />

      {trackers.isError ? (
        <ErrorState onRetry={() => trackers.refetch()} />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div className="flex items-center gap-6 rounded-2xl border bg-card p-6 shadow-sm">
              {trackers.isLoading ? <Skeleton className="h-32 w-32 rounded-full" /> : <Ring pct={overall} />}
              <div>
                <div className="kicker">{tr("Across active prescriptions")}</div>
                {active.length ? (
                  <>
                    <div className="tabular mt-2 text-[15px]"><span className="font-semibold">{taken}</span>{' '}{tr("of {expected} doses taken", { expected })}</div>
                    <StatusPill tone={band(overall).tone} className="mt-3">{band(overall).label}</StatusPill>
                  </>
                ) : (
                  <p className="mt-2 max-w-[220px] text-[13.5px] text-muted-foreground">{tr("Tracking starts when a pharmacy dispenses your prescription.")}</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><AlarmClock className="h-4 w-4 text-primary" />{' '}{tr("Due in the next 24 h")}</div>
              <div className="tabular mt-3 text-[32px] font-semibold tracking-tight">{upcoming.data?.length ?? '—'}</div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><History className="h-4 w-4 text-destructive" />{' '}{tr("Missed in the last 7 days")}</div>
              <div className="tabular mt-3 text-[32px] font-semibold tracking-tight">{missed.data ? recentMissed.length : '—'}</div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title={tr("Upcoming doses")} description={tr("Tap when you have taken a dose")} icon={Clock}>
              {upcoming.isLoading ? (
                <SkeletonRows rows={3} />
              ) : upcoming.data?.length ? (
                <ul className="space-y-2">
                  {upcoming.data.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Pill className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">{d.medicine_name}</div>
                        <div className="text-xs text-muted-foreground">{fmtWhen(d.scheduled_time)}</div>
                      </div>
                      <button
                        onClick={() => record.mutate(d)}
                        disabled={record.isPending && record.variables?.id === d.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60"
                      >
                        {record.isPending && record.variables?.id === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{' '}{tr("Taken")}</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={CalendarCheck} title={tr("Nothing due right now")} description={tr("Doses scheduled in the next 24 hours appear here.")} />
              )}
            </Panel>

            <Panel title={tr("Missed doses")} description={tr("Took one late? You can still record it.")} icon={History}>
              {missed.isLoading ? (
                <SkeletonRows rows={3} />
              ) : recentMissed.length ? (
                <ul className="space-y-2">
                  {recentMissed.slice(0, 8).map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.03] p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><Pill className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">{d.medicine_name}</div>
                        <div className="text-xs text-muted-foreground">{tr("Was due {fmtWhen}", { fmtWhen: fmtWhen(d.scheduled_time) })}</div>
                      </div>
                      <button
                        onClick={() => record.mutate(d)}
                        disabled={record.isPending && record.variables?.id === d.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-[12.5px] font-medium hover:bg-muted disabled:opacity-60"
                      >{tr("Record late")}</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={Check} title={tr("No missed doses this week")} description={tr("Keep it up.")} />
              )}
            </Panel>
          </section>

          <Panel title={tr("Treatment courses")} description={tr("One tracker per dispensed prescription")} icon={CalendarCheck}>
            {trackers.isLoading ? (
              <SkeletonRows rows={3} />
            ) : list.length === 0 ? (
              <EmptyState compact icon={CalendarCheck} title={tr("No tracked courses yet")} description={tr("After a pharmacy dispenses a prescription, its dose schedule shows up here.")} action={<Link href="/dashboard/prescriptions" className="text-[13.5px] font-semibold text-primary">{tr("View prescriptions")}</Link>} />
            ) : (
              <ul className="divide-y">
                {list.map((t) => {
                  const pct = t.adherence_percentage ?? (t.expected_doses ? (t.actual_doses / t.expected_doses) * 100 : 0);
                  const b = band(pct);
                  const p = t.prescription_id ? rxById.get(t.prescription_id) : undefined;
                  return (
                    <li key={t.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[13.5px] font-semibold">{(p as any)?.prescription_number ?? tr("Prescription")}</span>
                          <StatusPill tone={t.is_active ? 'primary' : 'neutral'}>{t.is_active ? tr("Active") : tr("Finished")}</StatusPill>
                        </div>
                        <div className="mt-1 truncate text-[13px] text-muted-foreground">
                          {p?.medicines?.map((m) => m.medicine_name).join(', ') || '—'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{fmtDate(t.start_date)} – {fmtDate(t.end_date)}</div>
                      </div>
                      <div className="w-full sm:w-64">
                        <div className="flex justify-between text-xs">
                          <span className="tabular text-muted-foreground">{tr("{actual_doses}/{expected_doses} doses", { actual_doses: t.actual_doses, expected_doses: t.expected_doses })}</span>
                          <span className={cn('tabular font-semibold', b.tone === 'success' ? 'text-success' : b.tone === 'warning' ? 'text-warning' : 'text-destructive')}>{Math.round(pct)}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: b.stroke }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

export default withAuth(AdherencePage, ['patient']);
