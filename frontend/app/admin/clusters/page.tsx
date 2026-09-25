'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, MapPin, Network, Users } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Stat, StatusPill, severityTone } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import type { Cluster } from '@/types';
import { t as tr, intlLocale } from '@/lib/i18n';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

function ClustersPage() {
  const [active, setActive] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery<any>({ queryKey: ['surv-clusters', active], queryFn: () => api.surveillance.getClusters(active ? { is_active: true } : {}) });
  const list: Cluster[] = useMemo(() => [...(q.data?.results ?? [])].sort((a, b) => b.total_cases - a.total_cases), [q.data]);
  const totalCases = list.reduce((n, c) => n + c.total_cases, 0);
  const diseases = new Set(list.map((c) => c.disease_code)).size;

  return (
    <div>
      <PageHeader
        title={tr("Clusters")}
        description={tr("Groups of nearby districts reporting the same disease, found by DBSCAN spatial clustering.")}
        actions={
          <div className="inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
            {[{ k: true, l: tr("Active") }, { k: false, l: tr("All") }].map((t) => (
              <button key={String(t.k)} onClick={() => setActive(t.k)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium', active === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t.l}</button>
            ))}
          </div>
        }
      />
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={tr("Clusters")} value={list.length} icon={Network} loading={q.isLoading} />
        <Stat label={tr("Cases inside clusters")} value={totalCases.toLocaleString(intlLocale())} icon={Users} tone="warning" loading={q.isLoading} />
        <Stat label={tr("Diseases clustering")} value={diseases} icon={MapPin} tone="info" loading={q.isLoading} />
      </section>
      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={5} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !list.length ? (
        <EmptyState icon={Network} title={tr("No clusters detected")} />
      ) : (
        <ul className="space-y-3">
          {list.map((c) => {
            const isOpen = open === c.id;
            const regions = [...(c.regions_data ?? [])].sort((a: any, b: any) => b.case_count - a.case_count);
            const maxR = (regions[0] as any)?.case_count || 1;
            return (
              <li key={c.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <button onClick={() => setOpen(isOpen ? null : c.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30" aria-expanded={isOpen}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Network className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{tr(c.disease_name)} <span className="font-mono text-xs font-normal text-muted-foreground">{c.disease_code}</span></span>
                    <span className="block text-[12.5px] text-muted-foreground">{tr("{length} districts · detected {fmt} · centred {centroid_lat}, {centroid_lon}", { length: regions.length, fmt: fmt(c.detection_date), centroid_lat: c.centroid_lat.toFixed(2), centroid_lon: c.centroid_lon.toFixed(2) })}</span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-[16px] font-semibold">{c.total_cases.toLocaleString(intlLocale())}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{tr("{value}/100k", { value: ((c.total_cases / Math.max(1, c.total_population)) * 100000).toFixed(1) })}</span>
                  </span>
                  <StatusPill tone={severityTone(c.severity)} className="w-[76px] justify-center capitalize">{c.severity}</StatusPill>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="grid gap-2 border-t px-5 py-4 sm:grid-cols-2">
                    {regions.map((r: any) => (
                      <div key={r.region} className="text-[13px]">
                        <div className="flex justify-between gap-2"><span className="truncate">{r.region_details?.name?.replace(/_/g, ' ')} <span className="text-muted-foreground">· {r.region_details?.state}</span></span><span className="tabular font-medium">{r.case_count}</span></div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.case_count / maxR) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default withAuth(ClustersPage, ['admin', 'authority']);
