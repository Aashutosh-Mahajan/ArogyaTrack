'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Brain,
  Check,
  Cpu,
  Globe2,
  Loader2,
  MapPin,
  Network,
  Play,
  TrendingDown,
  TrendingUp,
  Waypoints,
} from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, Panel, Skeleton, SkeletonRows, Stat, StatusPill, severityTone } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { C, ChartTooltip, Legend, axisProps, gridProps } from '@/components/charts/chartTheme';
import { cn } from '@/lib/utils';
import type { HeatMapData } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

const DynamicMap = dynamic(() => import('@/components/maps/DynamicMap').then((m) => m.DynamicMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[460px] w-full rounded-xl" />,
});

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const num = (n?: number) => (n ?? 0).toLocaleString(intlLocale());

function AdminDashboard() {
  const qc = useQueryClient();
  const [disease, setDisease] = useState('');
  const [horizon, setHorizon] = useState(7);
  const [selected, setSelected] = useState<HeatMapData | null>(null);

  const overview = useQuery<any>({ queryKey: ['surv-overview'], queryFn: () => api.surveillance.getDashboard() });
  const stats = useQuery<any[]>({ queryKey: ['surv-disease-stats'], queryFn: () => api.surveillance.getDiseaseStats() });
  const heat = useQuery<HeatMapData[]>({ queryKey: ['surv-heat', disease], queryFn: () => api.surveillance.getHeatMap(disease ? { disease_code: disease } : undefined) });
  const alerts = useQuery<any>({ queryKey: ['surv-alerts', 'active'], queryFn: () => api.surveillance.getAlerts({ status: 'active' }) });
  const anomalies = useQuery<any>({ queryKey: ['surv-anomalies'], queryFn: () => api.surveillance.getAnomalies({ is_resolved: false }) });
  const forecast = useQuery<any>({ queryKey: ['surv-forecast-chart', horizon, disease], queryFn: () => api.surveillance.getForecastChartData({ horizon, ...(disease ? { disease_code: disease } : {}) }) });
  const pipeline = useQuery<any>({ queryKey: ['surv-pipeline'], queryFn: () => api.surveillance.getMLPipelineStatus() });

  const ack = useMutation({
    mutationFn: (id: string) => api.surveillance.acknowledgeAlert(id),
    onSuccess: () => {
      toast.success(t("Alert acknowledged"));
      qc.invalidateQueries({ queryKey: ['surv-alerts'] });
      qc.invalidateQueries({ queryKey: ['shell', 'surveillance-alerts'] });
    },
  });
  const run = useMutation({
    mutationFn: (code: string) => api.surveillance.runMLPipeline(code),
    onSuccess: (r: any) => {
      toast.success(r?.task_id === 'sync' ? t("Pipeline finished. Results refreshed.") : t("Pipeline started. Results appear when it finishes."));
      ['surv-overview', 'surv-heat', 'surv-alerts', 'surv-anomalies', 'surv-forecast-chart', 'surv-pipeline'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });

  const o = overview.data;
  const statList = stats.data ?? [];
  const heatSorted = useMemo(() => [...(heat.data ?? [])].sort((a, b) => b.cases_per_100k - a.cases_per_100k), [heat.data]);
  const diseaseName = statList.find((s) => s.disease_code === disease)?.disease_name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="live-dot" />{' '}{t("Data as of {fmtDate}", { fmtDate: fmtDate(o?.as_of) })}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em] md:text-[32px]">{t("Surveillance command")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={disease} onChange={(e) => setDisease(e.target.value)} className={`${fieldClass()} h-10 w-56`} aria-label={t("Disease filter")}>
            <option value="">{t("All diseases")}</option>
            {statList.map((s) => <option key={s.disease_code} value={s.disease_code}>{t(s.disease_name)}</option>)}
          </select>
          <button
            onClick={() => disease ? run.mutate(disease) : toast.error(t("Choose a disease to run the pipeline for"))}
            disabled={run.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60"
            title={t("Re-run clustering, forecasting, anomaly detection and risk scoring")}
          >
            {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{' '}{t("Run ML pipeline")}</button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={t("Cases reported")} value={num(o?.total_cases_today)} hint={o ? t('on {date}', { date: fmtDate(o.as_of) }) : undefined} icon={Activity} loading={overview.isLoading} />
        <Stat label={t("Active alerts")} value={o?.active_alerts ?? 0} hint={o?.critical_alerts ? t('{count} critical', { count: o.critical_alerts }) : t("none critical")} icon={Bell} tone="danger" loading={overview.isLoading} href="/admin/alerts" />
        <Stat label={t("High-risk regions")} value={o?.high_risk_regions ?? 0} icon={AlertTriangle} tone="warning" loading={overview.isLoading} href="/admin/surveillance" />
        <Stat label={t("Active clusters")} value={o?.active_clusters ?? 0} icon={Network} tone="info" loading={overview.isLoading} href="/admin/clusters" />
        <Stat label={t("Open anomalies")} value={o?.unresolved_anomalies ?? 0} icon={Waypoints} tone="warning" loading={overview.isLoading} />
        <Stat label={t("Regions monitored")} value={o?.monitored_regions ?? 0} icon={MapPin} tone="neutral" loading={overview.isLoading} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title={diseaseName ? t("Disease burden · {disease}", { disease: t(diseaseName) }) : t("Disease burden · all diseases")} description={t("Last 7 days of reported cases by district")} icon={Globe2} bodyClassName="p-3 md:p-3">
          <DynamicMap data={heat.data ?? []} height={460} onSelect={setSelected} selectedId={selected?.region_id} center={selected ? [selected.latitude, selected.longitude] : undefined} zoom={selected ? 7 : undefined} />
        </Panel>
        <Panel
          title={t("Highest incidence")}
          description={t("Cases per 100,000 population")}
          icon={TrendingUp}
          actions={selected && <button onClick={() => setSelected(null)} className="text-[12.5px] font-medium text-primary">{t("Reset map")}</button>}
          bodyClassName="px-3 pb-3 md:px-3"
        >
          {heat.isLoading ? (
            <SkeletonRows rows={6} className="p-3" />
          ) : heatSorted.length ? (
            <ol className="max-h-[430px] overflow-y-auto">
              {heatSorted.slice(0, 15).map((r, i) => {
                const max = heatSorted[0].cases_per_100k || 1;
                return (
                  <li key={r.region_id}>
                    <button onClick={() => setSelected(r)} className={cn('w-full rounded-lg px-3 py-2 text-left hover:bg-muted', selected?.region_id === r.region_id && 'bg-muted')}>
                      <div className="flex items-center gap-3 text-[13.5px]">
                        <span className="tabular w-5 text-xs text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{r.region_name.replace(/_/g, ' ')}</span>
                        <span className="tabular text-muted-foreground">{r.cases_per_100k.toFixed(1)}</span>
                        <StatusPill tone={severityTone(r.risk_level)} className="w-[72px] justify-center">{t(r.risk_level)}</StatusPill>
                      </div>
                      <div className="ml-8 mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/60" style={{ width: `${(r.cases_per_100k / max) * 100}%` }} /></div>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState compact icon={Globe2} title={t("No cases in this window")} />
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title={t("Case forecast")}
          description={forecast.data?.forecast_date ? t("Average per region, generated {fmtDate}", { fmtDate: fmtDate(forecast.data.forecast_date) }) : t("Average per region")}
          icon={TrendingUp}
          actions={
            <div className="inline-flex rounded-lg border p-0.5">
              {[7, 14, 30].map((h) => (
                <button key={h} onClick={() => setHorizon(h)} className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium', horizon === h ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t("{h} d", { h })}</button>
              ))}
            </div>
          }
        >
          {forecast.isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : forecast.data?.data?.length ? (
            <>
              <Legend items={[{ label: t("Forecast"), color: C.primary }, { label: t("95% interval"), color: 'hsl(var(--chart-1) / 0.25)' }]} />
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={forecast.data.data.map((d: any) => ({ ...d, band: [d.lower_bound, d.upper_bound] }))} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={20} />
                  <YAxis {...axisProps} width={40} tickFormatter={(v: number) => String(Math.round(v))} />
                  <Tooltip content={<ChartTooltip formatter={(v) => (Array.isArray(v) ? `${Math.round(v[0])}–${Math.round(v[1])}` : String(Math.round(Number(v))))} />} />
                  <Area dataKey="band" name={t("Interval")} stroke="none" fill={C.primary} fillOpacity={0.14} />
                  <Line dataKey="forecast" name={t("Forecast")} stroke={C.primary} strokeWidth={2.2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          ) : (
            <EmptyState compact icon={TrendingUp} title={t("No forecast for this selection")} description={t("Run the ML pipeline to generate one.")} />
          )}
        </Panel>

        <Panel title={t("Leading diseases")} description={t("Change versus the previous 7 days")} icon={Activity} actions={<Link href="/admin/analytics" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">{t("Analytics")}{' '}<ArrowRight className="h-3.5 w-3.5" /></Link>}>
          {stats.isLoading ? (
            <SkeletonRows rows={5} />
          ) : (
            <ul className="divide-y text-[13.5px]">
              {statList.slice(0, 7).map((s) => (
                <li key={s.disease_code} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <button onClick={() => setDisease(s.disease_code)} className="min-w-0 flex-1 truncate text-left font-medium hover:text-primary">{t(s.disease_name)}</button>
                  <span className="tabular text-muted-foreground">{num(s.total_cases)}</span>
                  <span className={cn('tabular inline-flex w-20 items-center justify-end gap-1 font-medium', s.growth_rate > 5 ? 'text-destructive' : s.growth_rate < -5 ? 'text-success' : 'text-muted-foreground')}>
                    {s.growth_rate > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {s.growth_rate > 0 ? '+' : ''}{s.growth_rate.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title={t("Active alerts")} icon={Bell} className="xl:col-span-2" actions={<Link href="/admin/alerts" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">{t("Manage")}{' '}<ArrowRight className="h-3.5 w-3.5" /></Link>}>
          {alerts.isLoading ? (
            <SkeletonRows rows={4} />
          ) : alerts.data?.results?.length ? (
            <ul className="space-y-2">
              {alerts.data.results.slice(0, 5).map((a: any) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border p-3.5">
                  <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', a.severity === 'critical' || a.severity === 'high' ? 'bg-destructive' : 'bg-warning')} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium">{a.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t(a.disease_name)} · {(a.affected_regions_data || []).map((r: any) => r.name).join(', ')} · {fmtDate(a.generated_at)}</div>
                  </div>
                  <StatusPill tone={severityTone(a.severity)}>{t(a.severity_display)}</StatusPill>
                  <button onClick={() => ack.mutate(a.id)} disabled={ack.isPending && ack.variables === a.id} className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[12.5px] font-medium hover:bg-muted disabled:opacity-60" title={t("Acknowledge")}>
                    <Check className="h-3.5 w-3.5" />{' '}{t("Ack")}</button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Bell} title={t("No active alerts")} />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title={t("Open anomalies")} icon={Waypoints}>
            {anomalies.isLoading ? (
              <SkeletonRows rows={3} />
            ) : anomalies.data?.results?.length ? (
              <ul className="space-y-2 text-[13px]">
                {anomalies.data.results.slice(0, 4).map((a: any) => (
                  <li key={a.id} className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex justify-between gap-2 font-medium"><span className="truncate">{t(a.disease_name)} · {a.region_details?.name}</span><span className="tabular text-destructive">+{Math.round(a.deviation_percentage)}%</span></div>
                    <div className="text-xs text-muted-foreground">{t("{actual_cases} cases vs {round} expected", { actual_cases: a.actual_cases, round: Math.round(a.expected_cases) })}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{t("No unresolved anomalies.")}</p>
            )}
          </Panel>
          <Panel title={t("ML models")} icon={Cpu}>
            {pipeline.isLoading ? (
              <SkeletonRows rows={2} />
            ) : (
              <ul className="space-y-1.5 text-[13px]">
                {Object.entries(pipeline.data?.models ?? {}).map(([name, m]: [string, any]) => (
                  <li key={name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 capitalize"><Brain className="h-3.5 w-3.5 text-muted-foreground" />{name.replace(/_/g, ' ')}</span>
                    <StatusPill tone={m.loaded ? 'success' : 'danger'}>{m.loaded ? t("Loaded") : t("Missing")}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

export default withAuth(AdminDashboard, ['admin', 'authority']);
