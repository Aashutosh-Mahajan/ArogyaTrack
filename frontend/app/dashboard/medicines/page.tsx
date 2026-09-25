'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarClock, Pill, Search } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, Skeleton, SkeletonRows, StatusPill } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { doctorLabel } from '@/components/dashboard/RecordDetailModal';
import { cn } from '@/lib/utils';
import type { Medicine, Prescription, PrescriptionMedicine } from '@/types';
import { t as tr, intlLocale, tn } from '@/lib/i18n';

type Tab = 'mine' | 'reference';

interface Course {
  item: PrescriptionMedicine;
  rx: Prescription;
  start: Date;
  end: Date;
  daysLeft: number;
  progress: number;
}

const DAY = 86_400_000;

/** A course is current while today falls inside issue date + duration. */
function buildCourses(rxs: Prescription[]): { current: Course[]; past: Course[] } {
  const now = Date.now();
  const all: Course[] = [];
  for (const rx of rxs) {
    const start = new Date((rx as any).issued_at || rx.created_at);
    for (const item of rx.medicines ?? []) {
      if (item.dispense_status === 'unavailable') continue;
      const end = new Date(start.getTime() + Math.max(1, item.duration_days) * DAY);
      const total = end.getTime() - start.getTime();
      all.push({
        item,
        rx,
        start,
        end,
        daysLeft: Math.max(0, Math.ceil((end.getTime() - now) / DAY)),
        progress: Math.min(1, Math.max(0, (now - start.getTime()) / total)),
      });
    }
  }
  return {
    current: all.filter((c) => c.end.getTime() > now).sort((a, b) => a.end.getTime() - b.end.getTime()),
    past: all.filter((c) => c.end.getTime() <= now).sort((a, b) => b.end.getTime() - a.end.getTime()),
  };
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const fmt = (d: Date) => d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

function MedicinesPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  const rxQ = useQuery({ queryKey: ['prescriptions-all'], queryFn: () => api.prescriptions.getAll({ limit: 100 }) });
  const catalogue = useQuery<Medicine[]>({
    queryKey: ['medicines', q],
    queryFn: () => api.prescriptions.getMedicines({ search: q || undefined }),
    enabled: tab === 'reference',
  });

  const { current, past } = useMemo(() => buildCourses((rxQ.data?.results ?? []) as Prescription[]), [rxQ.data]);

  return (
    <div>
      <PageHeader title={tr("Medicines")} description={tr("What you are currently taking, and a reference for medicines on the network.")} />

      <div className="mb-6 inline-flex rounded-[10px] border bg-card p-1 shadow-sm" role="tablist">
        {[
          { key: 'mine' as Tab, label: tr("My medicines"), icon: Pill },
          { key: 'reference' as Tab, label: tr("Medicine reference"), icon: BookOpen },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors', tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        rxQ.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
        ) : rxQ.isError ? (
          <ErrorState onRetry={() => rxQ.refetch()} />
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="kicker mb-3">{tr("Current courses · {length}", { length: current.length })}</h2>
              {current.length === 0 ? (
                <EmptyState compact icon={Pill} title={tr("No active medicine courses")} description={tr("Medicines from your prescriptions show here while the course is running.")} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {current.map((c) => (
                    <article key={c.item.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Pill className="h-5 w-5" /></span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-semibold">{c.item.medicine_name}</h3>
                          <div className="truncate text-xs text-muted-foreground">{(c.item as any).medicine_generic}</div>
                        </div>
                        <StatusPill tone={c.daysLeft <= 3 ? 'warning' : 'primary'}>{tn(c.daysLeft, '1 day left', '{count} days left')}</StatusPill>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                        <div><dt className="text-xs text-muted-foreground">{tr("Dose")}</dt><dd className="font-medium">{c.item.dosage}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">{tr("Frequency")}</dt><dd className="font-medium">{c.item.frequency}</dd></div>
                      </dl>
                      {c.item.special_instructions && <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">{c.item.special_instructions}</p>}
                      <div className="mt-auto pt-4">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${c.progress * 100}%` }} />
                        </div>
                        <div className="mt-2 flex justify-between text-[11.5px] text-muted-foreground">
                          <span>{fmt(c.start)}</span>
                          <span>{tr("Ends {fmt}", { fmt: fmt(c.end) })}</span>
                        </div>
                        <div className="mt-2 truncate text-[11.5px] text-muted-foreground">
                          {(c.rx as any).prescription_number} · {doctorLabel(c.rx.doctor_name)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="kicker mb-3">{tr("Completed courses · {length}", { length: past.length })}</h2>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
                  {past.slice(0, 20).map((c) => (
                    <li key={c.item.id} className="flex items-center gap-3 px-5 py-3 text-[13.5px]">
                      <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{c.item.medicine_name}</span>
                      <span className="hidden text-muted-foreground sm:inline">{c.item.dosage} · {c.item.frequency}</span>
                      <span className="text-xs text-muted-foreground">{tr("Ended {fmt}", { fmt: fmt(c.end) })}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-[13px] text-muted-foreground">{tr("Need dose reminders? Track them on the")}{' '}<Link href="/dashboard/adherence" className="font-medium text-primary hover:underline">{tr("adherence page")}</Link>.
            </p>
          </div>
        )
      ) : (
        <div>
          <div className="relative mb-5 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search by brand or generic name")} className={`${fieldClass()} pl-10`} aria-label={tr("Search medicines")} />
          </div>
          {catalogue.isLoading ? (
            <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={5} /></div>
          ) : catalogue.isError ? (
            <ErrorState onRetry={() => catalogue.refetch()} />
          ) : !catalogue.data?.length ? (
            <EmptyState icon={BookOpen} title={tr("No medicines found")} description={tr("Try a different name.")} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">{tr("Medicine")}</th>
                    <th className="px-5 py-3 font-medium">{tr("Class")}</th>
                    <th className="px-5 py-3 font-medium">{tr("Category")}</th>
                    <th className="px-5 py-3 font-medium">{tr("Standard dosing")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {catalogue.data.map((m) => (
                    <tr key={m.id} className="align-top hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.generic_name}</div>
                      </td>
                      <td className="px-5 py-3">{m.drug_class || '—'}</td>
                      <td className="px-5 py-3">{m.therapeutic_category || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {m.standard_dosages && Object.keys(m.standard_dosages).length
                          ? Object.entries(m.standard_dosages).slice(0, 3).map(([k, v]) => <div key={k}><span className="text-foreground/80">{k}:</span> {String(v)}</div>)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default withAuth(MedicinesPage, ['patient']);
