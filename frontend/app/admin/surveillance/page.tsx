'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Building2, CloudRain, Droplets, Globe2, MapPin, Thermometer, Users, Wind } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, PageHeader, Panel, Skeleton, SkeletonRows, StatusPill, severityTone } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { DayWiseComparison } from '@/components/dashboard/DayWiseComparison';
import type { HeatMapData } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

const DynamicMap = dynamic(() => import('@/components/maps/DynamicMap').then((m) => m.DynamicMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[560px] w-full rounded-xl" />,
});

function RegionDetail({ region, asOf }: { region: HeatMapData; asOf?: string }) {
  const from = asOf ? new Date(new Date(asOf).getTime() - 6 * 86_400_000).toISOString().slice(0, 10) : undefined;
  const cases = useQuery<any>({
    queryKey: ['surv-region-cases', region.region_id, from],
    queryFn: () => api.surveillance.getSurveillanceData({ region_id: region.region_id, ...(from ? { date_from: from } : {}) }),
  });
  const env = useQuery<any>({ queryKey: ['surv-region-env', region.region_id], queryFn: () => api.surveillance.getEnvironmentalData({ region_id: region.region_id }) });

  const byDisease = useMemo(() => {
    const m = new Map<string, { name: string; cases: number }>();
    for (const r of cases.data?.results ?? []) {
      const cur = m.get(r.disease_code) ?? { name: r.disease_name, cases: 0 };
      cur.cases += r.case_count;
      m.set(r.disease_code, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.cases - a.cases);
  }, [cases.data]);
  const details = cases.data?.results?.[0]?.region_details;
  const e = env.data?.results?.[0];
  const max = byDisease[0]?.cases || 1;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[18px] font-semibold tracking-tight">{region.region_name.replace(/_/g, ' ')}</h2>
          <StatusPill tone={severityTone(region.risk_level)}>{t(region.risk_level)}</StatusPill>
        </div>
        {details && <div className="text-[13px] text-muted-foreground">{details.district}, {details.state}</div>}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{t("Cases (7 d)")}</dt><dd className="tabular mt-0.5 text-[18px] font-semibold">{region.case_count.toLocaleString(intlLocale())}</dd></div>
        <div className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{t("Per 100k")}</dt><dd className="tabular mt-0.5 text-[18px] font-semibold">{region.cases_per_100k.toFixed(1)}</dd></div>
        {details && (
          <>
            <div className="flex items-center gap-2 rounded-xl border p-3"><Users className="h-4 w-4 text-muted-foreground" /><span className="tabular">{details.population.toLocaleString(intlLocale())}</span></div>
            <div className="flex items-center gap-2 rounded-xl border p-3"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="tabular">{t("{hospital_count} hospitals", { hospital_count: details.hospital_count })}</span></div>
          </>
        )}
      </dl>
      <div>
        <div className="kicker mb-2">{t("Cases by disease")}</div>
        {cases.isLoading ? (
          <SkeletonRows rows={3} />
        ) : byDisease.length ? (
          <ul className="space-y-2">
            {byDisease.slice(0, 8).map((d) => (
              <li key={d.name} className="text-[13px]">
                <div className="flex justify-between"><span>{d.name}</span><span className="tabular font-medium">{d.cases}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(d.cases / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">{t("No cases recorded.")}</p>
        )}
      </div>
      {e && (
        <div>
          <div className="kicker mb-2">{t("Environment · {value}", { value: new Date(e.date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' }) })}</div>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-muted-foreground" />{t("{temperature}°C", { temperature: e.temperature })}</div>
            <div className="flex items-center gap-2"><Droplets className="h-4 w-4 text-muted-foreground" />{t("{humidity}% humidity", { humidity: e.humidity })}</div>
            <div className="flex items-center gap-2"><CloudRain className="h-4 w-4 text-muted-foreground" />{t("{rainfall} mm rain", { rainfall: e.rainfall })}</div>
            <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-muted-foreground" />{t("AQI {aqi}", { aqi: e.aqi })}</div>
          </dl>
        </div>
      )}
    </div>
  );
}

function SurveillancePage() {
  const [disease, setDisease] = useState('');
  const [selected, setSelected] = useState<HeatMapData | null>(null);
  const stats = useQuery<any[]>({ queryKey: ['surv-disease-stats'], queryFn: () => api.surveillance.getDiseaseStats() });
  const heatRaw = useQuery<any>({ queryKey: ['surv-heat-raw', disease], queryFn: () => api.client.get('/surveillance/heat-map-data/', { params: disease ? { disease_code: disease } : {} }) });
  const heat: HeatMapData[] = heatRaw.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Surveillance map")}
        description={heatRaw.data?.date ? t("Seven days of reported cases to {value}. Select a district for detail.", { value: new Date(heatRaw.data.date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) }) : t("Seven days of reported cases by district.")}
        actions={
          <select value={disease} onChange={(e) => { setDisease(e.target.value); setSelected(null); }} className={`${fieldClass()} h-10 w-60`} aria-label={t("Disease")}>
            <option value="">{t("All diseases")}</option>
            {(stats.data ?? []).map((s) => <option key={s.disease_code} value={s.disease_code}>{t(s.disease_name)}</option>)}
          </select>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px] [&>*]:min-w-0">
        <Panel bodyClassName="p-3 md:p-3">
          <DynamicMap data={heat} height={560} onSelect={setSelected} selectedId={selected?.region_id} center={selected ? [selected.latitude, selected.longitude] : undefined} zoom={selected ? 7 : undefined} />
        </Panel>
        <Panel title={selected ? undefined : t("District detail")} icon={selected ? undefined : MapPin}>
          {selected ? (
            <>
              <RegionDetail region={selected} asOf={heatRaw.data?.date} />
              <button onClick={() => setSelected(null)} className="mt-5 text-[13px] font-medium text-primary">{t("Back to national view")}</button>
            </>
          ) : heatRaw.isLoading ? (
            <SkeletonRows rows={4} />
          ) : (
            <EmptyState compact icon={Globe2} title={t("Select a district")} description={t("Click a circle on the map to see its cases by disease, population and environment.")} />
          )}
        </Panel>
      </div>
      <DayWiseComparison />
    </div>
  );
}

export default withAuth(SurveillancePage, ['admin', 'authority']);
