'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, FlaskConical, Minus, Search } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { docPaths } from '@/lib/documents';
import { PdfActions } from '@/components/ui/pdf-actions';
import { EmptyState, ErrorState, PageHeader, Skeleton, StatusPill } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { cn } from '@/lib/utils';
import type { LabTest } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

const STATUS = {
  high: { get label() { return tr("High"); }, tone: 'danger' as const },
  low: { get label() { return tr("Low"); }, tone: 'warning' as const },
  normal: { get label() { return tr("Normal"); }, tone: 'success' as const },
};

const FILTERS = [
  { key: 'all', get label() { return tr("All"); } },
  { key: 'abnormal', get label() { return tr("Out of range"); } },
  { key: 'normal', get label() { return tr("Normal"); } },
] as const;

/** Where a value sits on a track that spans the normal range plus margin either side. */
function RangeBar({ test }: { test: LabTest }) {
  const span = Math.max(test.normal_max - test.normal_min, 1e-6);
  const lo = test.normal_min - span * 0.5;
  const hi = test.normal_max + span * 0.5;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const inRange = test.status === 'normal';
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-success/25" style={{ left: `${pos(test.normal_min)}%`, right: `${100 - pos(test.normal_max)}%` }} />
        <div
          className={cn('absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow', inRange ? 'bg-success' : test.status === 'high' ? 'bg-destructive' : 'bg-warning')}
          style={{ left: `${pos(test.value)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span className="tabular" style={{ marginLeft: `${Math.max(0, pos(test.normal_min) - 4)}%` }}>{test.normal_min}</span>
        <span className="tabular" style={{ marginRight: `${Math.max(0, 100 - pos(test.normal_max) - 4)}%` }}>{test.normal_max}</span>
      </div>
    </div>
  );
}

function LabReportsPage(): React.JSX.Element {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  const labs = useQuery<LabTest[]>({ queryKey: ['dashboard-lab-monitoring'], queryFn: () => api.dashboard.getLabMonitoring() });

  const list = useMemo(
    () =>
      (labs.data ?? [])
        .filter((t) => (filter === 'all' ? true : filter === 'normal' ? t.status === 'normal' : t.status !== 'normal'))
        .filter((t) => t.test_name.toLowerCase().includes(search.trim().toLowerCase())),
    [labs.data, filter, search]
  );
  const abnormal = (labs.data ?? []).filter((t) => t.status !== 'normal').length;

  const refreshKpis = () => qc.invalidateQueries({ queryKey: ['dashboard-kpis'] });

  return (
    <div>
      <PageHeader
        title={tr("Lab reports")}
        description={tr("Your latest result for each test, compared with the normal range and your previous result.")}
        actions={labs.data?.length ? <PdfActions path={docPaths.labResults()} fileName="Lab_results.pdf" size="md" onDone={refreshKpis} /> : undefined}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {f.label}
              {f.key === 'abnormal' && abnormal > 0 && <span className="tabular ml-1.5 opacity-80">{abnormal}</span>}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search tests")} className={`${fieldClass()} h-10 pl-10`} aria-label={tr("Search tests")} />
        </div>
      </div>

      {labs.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : labs.isError ? (
        <ErrorState onRetry={() => labs.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={labs.data?.length ? tr("No tests match") : tr("No lab results yet")}
          description={labs.data?.length ? tr("Try another filter or search term.") : tr("Results uploaded by labs and doctors will appear here.")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((t) => {
            const st = STATUS[t.status] ?? STATUS.normal;
            const delta = t.previous_value !== null ? t.value - t.previous_value : null;
            return (
              <article key={t.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold">{t.test_name}</h2>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.tested_at).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                </div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="tabular text-[30px] font-semibold leading-none tracking-[-0.03em]">{t.value}</span>
                  <span className="text-[13px] text-muted-foreground">{t.unit}</span>
                  {delta !== null && (
                    <span className={cn('ml-auto inline-flex items-center gap-0.5 text-[12.5px] font-medium', delta === 0 ? 'text-muted-foreground' : 'text-foreground/70')}>
                      {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : delta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      <span className="tabular">{delta > 0 ? '+' : ''}{Number(delta.toFixed(2))}</span>
                      <span className="text-muted-foreground">{tr("vs last")}</span>
                    </span>
                  )}
                </div>
                <RangeBar test={t} />
                <div className="mt-auto flex items-center justify-between border-t pt-3 text-[12.5px]">
                  <span className="text-muted-foreground">{tr("Normal {normal_min}–{normal_max} {unit}", { normal_min: t.normal_min, normal_max: t.normal_max, unit: t.unit })}</span>
                  <PdfActions path={docPaths.labResult(t.id)} fileName={`Lab_${t.test_name}.pdf`} onDone={refreshKpis} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default withAuth(LabReportsPage, ['patient']);
