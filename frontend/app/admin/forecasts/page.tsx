'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, PageHeader, Panel, Skeleton, SkeletonRows, StatusPill } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { C, ChartTooltip, Legend, axisProps, gridProps } from '@/components/charts/chartTheme';
import { cn } from '@/lib/utils';
import { t, intlLocale } from '@/lib/i18n';

function ForecastsPage() {
  const [horizon, setHorizon] = useState(7);
  const [disease, setDisease] = useState('');
  const stats = useQuery<any[]>({ queryKey: ['surv-disease-stats'], queryFn: () => api.surveillance.getDiseaseStats() });
  const chart = useQuery<any>({ queryKey: ['surv-forecast-chart', horizon, disease], queryFn: () => api.surveillance.getForecastChartData({ horizon, ...(disease ? { disease_code: disease } : {}) }) });
  const rows = useQuery<any>({ queryKey: ['surv-forecasts', horizon, disease], queryFn: () => api.surveillance.getForecasts({ horizon, ...(disease ? { disease_code: disease } : {}) }) });

  // Peak predicted value per region–disease across the horizon.
  const peaks = useMemo(() => {
    const m = new Map<string, any>();
    for (const f of rows.data?.results ?? []) {
      const key = `${f.region}-${f.disease_code}`;
      const cur = m.get(key);
      if (!cur || f.predicted_cases > cur.predicted_cases) m.set(key, f);
    }
    return Array.from(m.values()).sort((a, b) => b.predicted_cases - a.predicted_cases).slice(0, 15);
  }, [rows.data]);

  const data = (chart.data?.data ?? []).map((d: any) => ({ ...d, band: [d.lower_bound, d.upper_bound] }));
  const total = (chart.data?.data ?? []).reduce((n: number, d: any) => n + (d.total_predicted || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Forecasts")}
        description={chart.data?.forecast_date ? t("Ensemble forecasts generated {value}", { value: new Date(chart.data.forecast_date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) }) : t("Ensemble case forecasts per district")}
        actions={
          <>
            <select value={disease} onChange={(e) => setDisease(e.target.value)} className={`${fieldClass()} h-10 w-56`} aria-label={t("Disease")}>
              <option value="">{t("All diseases")}</option>
              {(stats.data ?? []).map((s) => <option key={s.disease_code} value={s.disease_code}>{t(s.disease_name)}</option>)}
            </select>
            <div className="inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
              {[7, 14, 30].map((h) => (
                <button key={h} onClick={() => setHorizon(h)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium', horizon === h ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t("{h} days", { h })}</button>
              ))}
            </div>
          </>
        }
      />

      <Panel
        title={t("{value} · next {horizon} days", { value: chart.data?.disease_name ?? 'All diseases', horizon })}
        description={total ? t("{value} cases predicted across {value2} regions", { value: Math.round(total).toLocaleString(intlLocale()), value2: chart.data?.data?.[0]?.regions ?? 0 }) : undefined}
        icon={TrendingUp}
        actions={<Legend items={[{ label: t("Mean per region"), color: C.primary }, { label: t("Interval"), color: 'hsl(var(--chart-1) / 0.25)' }]} />}
      >
        {chart.isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : data.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} width={40} tickFormatter={(v: number) => String(Math.round(v))} />
              <Tooltip content={<ChartTooltip formatter={(v) => (Array.isArray(v) ? `${Math.round(v[0])}–${Math.round(v[1])}` : String(Math.round(Number(v))))} />} />
              <Area dataKey="band" name={t("Interval")} stroke="none" fill={C.primary} fillOpacity={0.14} />
              <Line dataKey="forecast" name={t("Forecast")} stroke={C.primary} strokeWidth={2.2} dot={{ r: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState compact icon={TrendingUp} title={t("No forecasts for this selection")} description={t("Run the ML pipeline from the command centre to generate them.")} />
        )}
      </Panel>

      <Panel title={t("Highest predicted load")} description={t("Peak daily prediction per district in this horizon")} icon={TrendingUp}>
        {rows.isLoading ? (
          <SkeletonRows rows={6} />
        ) : peaks.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">{t("District")}</th><th className="pb-2 font-medium">{t("Disease")}</th><th className="pb-2 font-medium">{t("Peak day")}</th><th className="pb-2 text-right font-medium">{t("Predicted")}</th><th className="pb-2 text-right font-medium">{t("Range")}</th><th className="pb-2 text-right font-medium">{t("Confidence")}</th></tr></thead>
              <tbody className="divide-y">
                {peaks.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2 font-medium">{f.region_details?.name?.replace(/_/g, ' ')} <span className="font-normal text-muted-foreground">· {f.region_details?.state}</span></td>
                    <td className="py-2">{t(f.disease_name)}</td>
                    <td className="py-2 text-muted-foreground">{new Date(f.prediction_date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })}</td>
                    <td className="tabular py-2 text-right font-semibold">{Math.round(f.predicted_cases)}</td>
                    <td className="tabular py-2 text-right text-muted-foreground">{Math.round(f.lower_bound)}–{Math.round(f.upper_bound)}</td>
                    <td className="py-2 text-right"><StatusPill tone={f.confidence >= 0.8 ? 'success' : f.confidence >= 0.6 ? 'warning' : 'neutral'}>{Math.round(f.confidence * 100)}%</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">{t("No forecast rows.")}</p>
        )}
      </Panel>
    </div>
  );
}

export default withAuth(ForecastsPage, ['admin', 'authority']);
