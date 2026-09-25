'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BarChart3, Brain, Gauge, MapPin, Waypoints } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { PageHeader, Panel, Skeleton, SkeletonRows, StatusPill, severityTone } from '@/components/ui/page';
import { C, ChartTooltip, axisProps, gridProps } from '@/components/charts/chartTheme';
import { cn } from '@/lib/utils';
import { t, intlLocale } from '@/lib/i18n';

const RISK_LABEL: Record<number, string> = { get 0() { return t("Low"); }, get 1() { return t("Medium"); }, get 2() { return t("High"); }, get 3() { return t("Critical"); } };
const RISK_FILL: Record<number, string> = { 0: C.primary, 1: C.amber, get 2() { return t("hsl(24 90% 50%)"); }, 3: C.red };
const WINDOWS = [7, 14, 30];

function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const stats = useQuery<any>({ queryKey: ['surv-disease-stats-raw', days], queryFn: () => api.client.get('/surveillance/disease-statistics/', { params: { days } }) });
  const regional = useQuery<any>({ queryKey: ['surv-regional', days], queryFn: () => api.surveillance.getRegionalComparison({ days }) });
  const risk = useQuery<any>({ queryKey: ['surv-risk-scores'], queryFn: () => api.surveillance.getRiskScores() });
  const anomalies = useQuery<any>({ queryKey: ['surv-anomalies'], queryFn: () => api.surveillance.getAnomalies({ is_resolved: false }) });
  const models = useQuery<any[]>({ queryKey: ['surv-models'], queryFn: () => api.surveillance.getMLModels() });

  const statList = stats.data?.statistics ?? [];
  const topRegions = (regional.data?.comparison ?? []).slice(0, 12);
  const riskDist = useMemo(() => {
    const latest = risk.data?.results ?? [];
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    latest.forEach((r: any) => { const l = Math.min(3, Math.max(0, Number(r.risk_level) || 0)); counts[l] += 1; });
    return [0, 1, 2, 3].map((l) => ({ level: RISK_LABEL[l], n: counts[l], l }));
  }, [risk.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Analytics")}
        description={stats.data?.as_of ? t("Window ending {value}", { value: new Date(stats.data.as_of).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) }) : undefined}
        actions={
          <div className="inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
            {WINDOWS.map((w) => (
              <button key={w} onClick={() => setDays(w)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium', days === w ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{t("{w} days", { w })}</button>
            ))}
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title={t("Cases by disease")} icon={BarChart3}>
          {stats.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, statList.length * 30)}>
              <BarChart data={statList} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} tickFormatter={(v: number) => v.toLocaleString(intlLocale())} />
                <YAxis type="category" dataKey="disease_name" {...axisProps} width={150} />
                <Tooltip content={<ChartTooltip formatter={(v) => Number(v).toLocaleString(intlLocale())} />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="total_cases" name={t("Cases")} fill={C.primary} radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title={t("Growth versus previous window")} icon={Activity}>
          {stats.isLoading ? (
            <SkeletonRows rows={6} />
          ) : (
            <table className="w-full text-[13.5px]">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">{t("Disease")}</th><th className="pb-2 text-right font-medium">{t("Regions")}</th><th className="pb-2 text-right font-medium">{t("Severity")}</th><th className="pb-2 text-right font-medium">{t("Change")}</th></tr></thead>
              <tbody className="divide-y">
                {statList.map((s: any) => (
                  <tr key={s.disease_code}>
                    <td className="py-2 pr-2 font-medium">{t(s.disease_name)}</td>
                    <td className="tabular py-2 text-right text-muted-foreground">{s.affected_regions}</td>
                    <td className="tabular py-2 text-right text-muted-foreground">{s.average_severity.toFixed(1)}</td>
                    <td className={cn('tabular py-2 text-right font-semibold', s.growth_rate > 5 ? 'text-destructive' : s.growth_rate < -5 ? 'text-success' : 'text-muted-foreground')}>{s.growth_rate > 0 ? '+' : ''}{s.growth_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title={t("Highest incidence regions")} description={t("Cases per 100,000 population")} icon={MapPin}>
          {regional.isLoading ? (
            <SkeletonRows rows={6} />
          ) : (
            <table className="w-full text-[13.5px]">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">{t("Region")}</th><th className="pb-2 text-right font-medium">{t("Cases")}</th><th className="pb-2 text-right font-medium">{t("Per 100k")}</th><th className="pb-2 text-right font-medium">{t("Diseases")}</th><th className="pb-2 text-right font-medium">{t("Risk")}</th></tr></thead>
              <tbody className="divide-y">
                {topRegions.map((r: any) => (
                  <tr key={r.region_name}>
                    <td className="py-2 font-medium">{r.region_name.replace(/_/g, ' ')}</td>
                    <td className="tabular py-2 text-right">{r.total_cases.toLocaleString(intlLocale())}</td>
                    <td className="tabular py-2 text-right font-semibold">{r.cases_per_100k.toFixed(1)}</td>
                    <td className="tabular py-2 text-right text-muted-foreground">{r.active_diseases}</td>
                    <td className="py-2 text-right"><StatusPill tone={severityTone(r.risk_level)}>{t(r.risk_level)}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title={t("Risk score distribution")} description={risk.data ? t("Across the {value} most recent of {count} region–disease scores", { value: risk.data.results?.length ?? 0, count: risk.data.count }) : undefined} icon={Gauge}>
          {risk.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={riskDist} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="level" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} width={32} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="n" name={t("Scores")} radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {riskDist.map((d) => <Cell key={d.l} fill={RISK_FILL[d.l]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </section>

      <Panel title={t("Unresolved anomalies")} description={t("Isolation Forest flags where cases far exceed the expected level")} icon={Waypoints}>
        {anomalies.isLoading ? (
          <SkeletonRows rows={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">{t("Detected")}</th><th className="pb-2 font-medium">{t("Region")}</th><th className="pb-2 font-medium">{t("Disease")}</th><th className="pb-2 text-right font-medium">{t("Actual")}</th><th className="pb-2 text-right font-medium">{t("Expected")}</th><th className="pb-2 text-right font-medium">{t("Deviation")}</th><th className="pb-2 text-right font-medium">{t("Score")}</th></tr></thead>
              <tbody className="divide-y">
                {(anomalies.data?.results ?? []).map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-2 text-muted-foreground">{new Date(a.detection_date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })}</td>
                    <td className="py-2 font-medium">{a.region_details?.name}</td>
                    <td className="py-2">{t(a.disease_name)}</td>
                    <td className="tabular py-2 text-right">{a.actual_cases}</td>
                    <td className="tabular py-2 text-right text-muted-foreground">{Math.round(a.expected_cases)}</td>
                    <td className="tabular py-2 text-right font-semibold text-destructive">+{Math.round(a.deviation_percentage)}%</td>
                    <td className="tabular py-2 text-right">{a.anomaly_score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={t("Model registry")} icon={Brain}>
        {models.isLoading ? (
          <SkeletonRows rows={3} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(models.data ?? []).map((m: any) => (
              <article key={m.name} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[14.5px] font-semibold">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.version}{m.n_features ? t(" · {n_features} features", { n_features: m.n_features }) : ''}</div>
                  </div>
                  <StatusPill tone={m.loaded ? 'success' : 'danger'}>{m.loaded ? t("Loaded") : t("Missing")}</StatusPill>
                </div>
                {m.description && <p className="mt-2 text-[13px] text-muted-foreground">{m.description}</p>}
                {m.metrics && Object.keys(m.metrics).length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-3">
                    {Object.entries(m.metrics).slice(0, 6).map(([k, v]) => (
                      <div key={k}><dt className="text-muted-foreground">{k.replace(/_/g, ' ')}</dt><dd className="tabular font-medium">{typeof v === 'number' ? Number(v.toFixed(3)) : String(v)}</dd></div>
                    ))}
                  </dl>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default withAuth(AnalyticsPage, ['admin', 'authority']);
