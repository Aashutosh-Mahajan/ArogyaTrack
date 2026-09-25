'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, FilePlus2, FlaskConical, HeartPulse } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, StatusPill, severityTone } from '@/components/ui/page';
import { initialsOf } from '@/components/layout/useShell';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

interface HighRisk {
  patient_id: string;
  unique_patient_id: string;
  name: string;
  age: number;
  gender: string;
  district: string;
  condition: string;
  risk_level: string;
  risk_score: number;
  risk_factors: string[];
  last_visit_date: string | null;
  latest_bp: string | null;
  latest_sugar: number | null;
  conditions_count: number;
  abnormal_labs: number;
}

const LEVELS = ['All', 'Critical', 'High', 'Medium'];

function HighRiskPatientsPage() {
  const [level, setLevel] = useState('All');
  const q = useQuery({ queryKey: ['doctor-high-risk'], queryFn: () => api.medical.getHighRiskPatients() as Promise<{ count: number; results: HighRisk[] }> });

  const all = useMemo(() => q.data?.results ?? [], [q.data]);
  const list = useMemo(
    () => all.filter((p) => level === 'All' || p.risk_level.toLowerCase() === level.toLowerCase()).sort((a, b) => b.risk_score - a.risk_score),
    [all, level]
  );
  const count = (l: string) => all.filter((p) => p.risk_level.toLowerCase() === l.toLowerCase()).length;

  return (
    <div>
      <PageHeader title={t("High-risk watchlist")} description={t("Your patients ranked by a risk score built from chronic conditions, recent vitals and abnormal lab results.")} />

      <div className="mb-5 inline-flex flex-wrap rounded-[10px] border bg-card p-1 shadow-sm">
        {LEVELS.map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', level === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {l}
            {l !== 'All' && q.data && <span className="tabular ml-1.5 opacity-80">{count(l)}</span>}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={5} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={AlertTriangle} title={all.length ? t("No patients at this level") : t("No high-risk patients")} description={all.length ? undefined : t("Patients you have access to appear here when they have active conditions, out-of-range vitals or abnormal labs.")} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((p) => (
            <article key={p.patient_id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-sm font-semibold text-destructive">{initialsOf(p.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold">{p.name}</h2>
                    <StatusPill tone={severityTone(p.risk_level)}>{t(p.risk_level)}</StatusPill>
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    <span className="font-mono">{p.unique_patient_id}</span>{' '}{t("· {age} y · {gender}", { age: p.age, gender: t(p.gender) }) + (p.district ? ` · ${p.district}` : '')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-[22px] font-semibold leading-none">{p.risk_score}</div>
                  <div className="text-[11px] text-muted-foreground">{t("risk score")}</div>
                </div>
              </div>

              <div className="mb-5 mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 px-2 py-2">
                  <HeartPulse className="mx-auto h-4 w-4 text-destructive" />
                  <div className="tabular mt-1 text-[13.5px] font-semibold">{p.latest_bp || '—'}</div>
                  <div className="text-[11px] text-muted-foreground">{t("BP")}</div>
                </div>
                <div className="rounded-lg bg-muted/50 px-2 py-2">
                  <FlaskConical className="mx-auto h-4 w-4 text-warning" />
                  <div className="tabular mt-1 text-[13.5px] font-semibold">{p.latest_sugar ? Math.round(p.latest_sugar) : '—'}</div>
                  <div className="text-[11px] text-muted-foreground">{t("Glucose")}</div>
                </div>
                <div className="rounded-lg bg-muted/50 px-2 py-2">
                  <AlertTriangle className="mx-auto h-4 w-4 text-muted-foreground" />
                  <div className="tabular mt-1 text-[13.5px] font-semibold">{p.abnormal_labs}</div>
                  <div className="text-[11px] text-muted-foreground">{t("Abnormal labs")}</div>
                </div>
              </div>

              {p.risk_factors?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.risk_factors.slice(0, 6).map((f) => <span key={f} className="rounded-md bg-destructive/8 px-2 py-0.5 text-xs text-destructive">{f}</span>)}
                </div>
              )}

              <div className="mt-auto flex gap-2 border-t pt-4">
                <Link href={`/doctor/patients/${p.patient_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-medium hover:bg-muted">{t("Open chart")}{' '}<ChevronRight className="h-4 w-4" />
                </Link>
                <Link href={`/doctor/patients/${p.patient_id}/create-consultation`} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button">
                  <FilePlus2 className="h-4 w-4" />{' '}{t("New consultation")}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default withAuth(HighRiskPatientsPage, ['doctor']);
