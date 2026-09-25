'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, ChevronRight, FileText, Loader2, Paperclip, Search, Stethoscope, X } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { EmptyState, ErrorState, PageHeader, Panel, SkeletonRows, StatusPill } from '@/components/ui/page';
import { RecordDetailModal, doctorLabel, visitToRecent } from '@/components/dashboard/RecordDetailModal';
import { fieldClass } from '@/components/auth/FormKit';
import type { Allergy, ChronicCondition, MedicalRecord, RecentRecord } from '@/types';
import { t as tr, intlLocale, tn } from '@/lib/i18n';

const PAGE = 20;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const severityLabel = (s: number | string) => {
  const n = typeof s === 'number' ? s : s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
  return n >= 3 ? { label: tr("Severe"), tone: 'danger' as const } : n === 2 ? { label: tr("Moderate"), tone: 'warning' as const } : { label: tr("Mild"), tone: 'neutral' as const };
};

function MedicalRecordsPage(): React.JSX.Element {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [selected, setSelected] = useState<RecentRecord | null>(null);
  const q = useDebounced(search.trim());

  const visits = useInfiniteQuery({
    queryKey: ['visit-records', q, year],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.medical.getRecords({ search: q || undefined, year: year || undefined, limit: PAGE, offset: pageParam }) as Promise<{ count: number; results: MedicalRecord[] }>,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.results.length, 0);
      return loaded < last.count ? loaded : undefined;
    },
  });
  const diagnoses = useQuery({ queryKey: ['my-diagnoses'], queryFn: () => api.medical.getMyDiagnoses({ limit: 50 }) });
  const allergies = useQuery<Allergy[]>({ queryKey: ['patient-allergies'], queryFn: () => api.medical.getAllergies() });
  const conditions = useQuery<ChronicCondition[]>({ queryKey: ['patient-chronic-conditions'], queryFn: () => api.medical.getChronicConditions() });

  const records = useMemo(() => visits.data?.pages.flatMap((p) => p.results) ?? [], [visits.data]);
  const total = visits.data?.pages[0]?.count ?? 0;

  const grouped = useMemo(() => {
    const m = new Map<string, MedicalRecord[]>();
    for (const r of records) {
      const y = String(new Date(r.visit_date).getFullYear());
      m.set(y, [...(m.get(y) ?? []), r]);
    }
    return Array.from(m.entries());
  }, [records]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(now - i));
  }, []);

  return (
    <div>
      <PageHeader title={t("Medical Records")} description={t("Complete history of your medical consultations")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr("Search diagnosis, doctor, department or test")}
                className={`${fieldClass()} pl-10 pr-9`}
                aria-label={tr("Search records")}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Clear search")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select value={year} onChange={(e) => setYear(e.target.value)} className={`${fieldClass()} sm:w-40`} aria-label={tr("Filter by year")}>
              <option value="">{tr("All years")}</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="text-[13px] text-muted-foreground">
            {visits.isLoading ? tr("Loading consultations…") : q || year ? tn(total, '1 consultation matches your filters', '{count} consultations match your filters') : tn(total, '1 consultation', '{count} consultations')}
          </div>

          {visits.isLoading ? (
            <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={5} /></div>
          ) : visits.isError ? (
            <ErrorState onRetry={() => visits.refetch()} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={q || year ? tr("No consultations match") : t("No medical records yet")}
              description={q || year ? tr("Try a different search term or year.") : t("Your visit records will appear here")}
            />
          ) : (
            <div className="space-y-6">
              {grouped.map(([y, list]) => (
                <section key={y}>
                  <h2 className="kicker mb-2 px-1">{y}</h2>
                  <ul className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    {list.map((r) => {
                      const d = new Date(r.visit_date);
                      const attachments = r.report_attachments?.length ?? 0;
                      return (
                        <li key={r.id} className="border-b last:border-0">
                          <button onClick={() => setSelected(visitToRecent(r))} className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50 md:px-5">
                            <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border bg-muted/40">
                              <span className="tabular text-[17px] font-semibold leading-none">{d.getDate()}</span>
                              <span className="mt-0.5 text-[10px] font-medium uppercase text-muted-foreground">{d.toLocaleDateString(intlLocale(), { month: 'short' })}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold first-letter:uppercase">{r.diagnosis || tr("Consultation")}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {doctorLabel(r.doctor_name)}</span>
                                {r.department && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px]">{tr(r.department)}</span>}
                                {attachments > 0 && (
                                  <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {attachments}</span>
                                )}
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {visits.hasNextPage && (
                <button
                  onClick={() => visits.fetchNextPage()}
                  disabled={visits.isFetchingNextPage}
                  className="mx-auto flex h-10 items-center gap-2 rounded-[10px] border bg-card px-4 text-[13.5px] font-medium shadow-sm hover:bg-muted disabled:opacity-60"
                >
                  {visits.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{tr("Load older consultations")}</button>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Panel title={t("Allergies")} icon={AlertTriangle}>
            {allergies.isLoading ? (
              <SkeletonRows rows={2} />
            ) : allergies.data?.length ? (
              <ul className="space-y-2">
                {allergies.data.map((a) => {
                  const sv = severityLabel(a.severity);
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium">{a.allergen}</div>
                        <div className="text-xs text-muted-foreground">{a.reaction_type}{a.added_by_name ? ` · ${a.added_by_name}` : ''}</div>
                      </div>
                      <StatusPill tone={sv.tone}>{sv.label}</StatusPill>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{t("No allergies recorded")}</p>
            )}
          </Panel>

          <Panel title={t("Chronic Conditions")} icon={CalendarDays}>
            {conditions.isLoading ? (
              <SkeletonRows rows={2} />
            ) : conditions.data?.length ? (
              <ul className="space-y-2">
                {conditions.data.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium">{c.disease_name || c.icd_10_code}</div>
                      <div className="text-xs text-muted-foreground">{c.added_by_name ? tr("ICD-10 {icd_10_code} · {added_by_name}", { icd_10_code: c.icd_10_code, added_by_name: c.added_by_name }) : tr("ICD-10 {icd_10_code}", { icd_10_code: c.icd_10_code })}</div>
                    </div>
                    <StatusPill tone={c.is_active ? 'primary' : 'neutral'}>{c.is_active ? tr("Active") : tr("Resolved")}</StatusPill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{t("No active chronic conditions recorded.")}</p>
            )}
          </Panel>

          <Panel title={tr("Diagnoses")} description={tr("Coded diagnoses recorded by your doctors")} icon={Stethoscope}>
            {diagnoses.isLoading ? (
              <SkeletonRows rows={2} />
            ) : diagnoses.data?.results?.length ? (
              <ul className="space-y-2">
                {diagnoses.data.results.map((rec: any) => (
                  <li key={rec.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(rec.diagnoses || []).map((dx: any, i: number) => (
                        <span key={i} className="tag" title={`ICD-10 ${dx.icd_10_code}`}>{dx.disease_name || dx.icd_10_code}</span>
                      ))}
                      {!rec.diagnoses?.length && <span className="text-[13px] text-muted-foreground">{tr("No coded diagnosis")}</span>}
                    </div>
                    {rec.symptoms && <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground">{rec.symptoms}</p>}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {rec.doctor?.name ? doctorLabel(rec.doctor.name) : tr("Doctor")} · {new Date(rec.created_at).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{tr("No coded diagnoses yet.")}</p>
            )}
          </Panel>
        </aside>
      </div>

      {selected && <RecordDetailModal open onOpenChange={(o) => !o && setSelected(null)} record={selected} />}
    </div>
  );
}

export default withAuth(MedicalRecordsPage, ['patient']);
