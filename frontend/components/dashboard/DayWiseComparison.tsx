'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { Panel, SkeletonRows, StatusPill } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import type { DayWiseComparisonResponse, TrendType } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

const TREND: Record<TrendType, { label: string; tone: 'danger' | 'warning' | 'neutral' | 'success'; icon: typeof ArrowUpRight }> = {
  rapid_increase: { get label() { return tr("Rising fast"); }, tone: 'danger', icon: ArrowUpRight },
  gradual_increase: { get label() { return tr("Rising"); }, tone: 'warning', icon: ArrowUpRight },
  stable: { get label() { return tr("Stable"); }, tone: 'neutral', icon: ArrowRight },
  gradual_decrease: { get label() { return tr("Falling"); }, tone: 'success', icon: ArrowDownRight },
  rapid_decrease: { get label() { return tr("Falling fast"); }, tone: 'success', icon: ArrowDownRight },
};

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-7 items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => (
        <div key={i} className={cn('w-2 rounded-sm', i === values.length - 1 ? 'bg-primary' : 'bg-primary/30')} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

/** Seven-day, per-disease case trend with a state filter and per-region drill-down. */
export function DayWiseComparison() {
  const [state, setState] = useState('');
  const [disease, setDisease] = useState<string | null>(null);
  const q = useQuery<DayWiseComparisonResponse>({
    queryKey: ['surv-daywise', state],
    queryFn: () => api.surveillance.getDayWiseComparison(state ? { state } : undefined),
  });
  const d = q.data;
  const dates = useMemo(() => [...(d?.dates ?? [])].reverse(), [d]);
  const regions = useMemo(
    () => (d?.comparisons ?? []).filter((c) => !disease || c.disease_code === disease).sort((a, b) => b.total_cases_7d - a.total_cases_7d).slice(0, 12),
    [d, disease]
  );

  return (
    <Panel
      title={tr("Seven-day trend by disease")}
      description={d ? `${new Date(dates[0]).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })} – ${new Date(d.reference_date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}
      icon={CalendarDays}
      actions={
        <select value={state} onChange={(e) => { setState(e.target.value); setDisease(null); }} className="h-9 rounded-lg border bg-card px-2.5 text-[13px]" aria-label={tr("State")}>
          <option value="">{tr("All states")}</option>
          {d?.available_states.map((s) => <option key={s}>{s}</option>)}
        </select>
      }
    >
      {q.isLoading ? (
        <SkeletonRows rows={5} />
      ) : !d?.disease_summaries.length ? (
        <p className="text-[13.5px] text-muted-foreground">{tr("No cases reported in this period.")}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
          <ul className="divide-y">
            {d.disease_summaries.map((s) => {
              const t = TREND[s.trend] ?? TREND.stable;
              const vals = [...s.day_totals].reverse().map((x) => x.cases);
              return (
                <li key={s.disease_code}>
                  <button onClick={() => setDisease(disease === s.disease_code ? null : s.disease_code)} className={cn('flex w-full items-center gap-4 rounded-lg px-2 py-2.5 text-left hover:bg-muted/60', disease === s.disease_code && 'bg-muted')}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{tr(s.disease_name)}</div>
                      <div className="tabular text-xs text-muted-foreground">{tr("{total_cases_7d} cases · {regions_affected} regions", { total_cases_7d: s.total_cases_7d.toLocaleString(intlLocale()), regions_affected: s.regions_affected })}</div>
                    </div>
                    <Spark values={vals} />
                    <StatusPill tone={t.tone} className="w-[96px] justify-center"><t.icon className="h-3 w-3" />{t.label}</StatusPill>
                  </button>
                </li>
              );
            })}
          </ul>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-muted-foreground">{disease ? tr('Regions · {disease}', { disease: d.disease_summaries.find((s) => s.disease_code === disease)?.disease_name }) : tr('Busiest region–disease pairs')}</div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[520px] text-[12.5px]">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{tr("Region")}</th>
                    {dates.map((dt) => <th key={dt} className="px-1.5 py-2 text-right font-medium">{new Date(dt).toLocaleDateString(intlLocale(), { day: 'numeric' })}</th>)}
                    <th className="px-3 py-2 text-right font-medium">{tr("7 d")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {regions.map((r) => {
                    const byDate = new Map(r.day_data.map((x: any) => [x.date, x.cases]));
                    const t = TREND[r.trend] ?? TREND.stable;
                    return (
                      <tr key={`${r.region_id}-${r.disease_code}`}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{r.region_name.replace(/_/g, ' ')}</div>
                          <div className="text-[11px] text-muted-foreground">{disease ? r.state : r.disease_name}</div>
                        </td>
                        {dates.map((dt) => <td key={dt} className="tabular px-1.5 py-2 text-right">{byDate.get(dt) ?? 0}</td>)}
                        <td className="tabular px-3 py-2 text-right font-semibold"><span className={cn(t.tone === 'danger' && 'text-destructive', t.tone === 'warning' && 'text-warning')}>{r.total_cases_7d}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
