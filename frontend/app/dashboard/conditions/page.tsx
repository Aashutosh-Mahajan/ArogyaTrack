'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, HeartPulse, ShieldAlert } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, PageHeader, Panel, SkeletonRows, StatusPill } from '@/components/ui/page';
import type { Allergy, ChronicCondition, DashboardKPIs } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/* Interpretation bands follow common clinical cut-offs (ACC/AHA for BP, ADA for fasting glucose). */
function bpBand(sys?: number | null, dia?: number | null) {
  if (sys == null) return null;
  const d = dia ?? 0;
  if (sys >= 140 || d >= 90) return { label: t("High (stage 2)"), tone: 'danger' as const };
  if (sys >= 130 || d >= 80) return { label: t("High (stage 1)"), tone: 'warning' as const };
  if (sys >= 120) return { label: t("Elevated"), tone: 'warning' as const };
  if (sys < 90 || d < 60) return { label: t("Low"), tone: 'info' as const };
  return { label: t("Normal"), tone: 'success' as const };
}

function sugarBand(v?: number | null) {
  if (v == null) return null;
  if (v >= 126) return { label: t("Diabetic range"), tone: 'danger' as const };
  if (v >= 100) return { label: t("Pre-diabetic range"), tone: 'warning' as const };
  if (v < 70) return { label: t("Low"), tone: 'info' as const };
  return { label: t("Normal"), tone: 'success' as const };
}

const severity = (s: number | string) => {
  const n = typeof s === 'number' ? s : s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
  return n >= 3 ? { label: t("Severe"), tone: 'danger' as const } : n === 2 ? { label: t("Moderate"), tone: 'warning' as const } : { label: t("Mild"), tone: 'neutral' as const };
};

function ConditionsPage(): React.JSX.Element {
  const conditions = useQuery<ChronicCondition[]>({ queryKey: ['patient-chronic-conditions'], queryFn: () => api.medical.getChronicConditions() });
  const allergies = useQuery<Allergy[]>({ queryKey: ['patient-allergies'], queryFn: () => api.medical.getAllergies() });
  const kpis = useQuery<DashboardKPIs>({ queryKey: ['dashboard-kpis'], queryFn: () => api.dashboard.getKPIs() });

  const bp = kpis.data?.recent_bp;
  const sugar = kpis.data?.recent_sugar;
  const bpB = bpBand(bp?.value, bp?.secondary_value);
  const sgB = sugarBand(sugar?.value);
  const active = (conditions.data ?? []).filter((c) => c.is_active);
  const resolved = (conditions.data ?? []).filter((c) => !c.is_active);

  return (
    <div>
      <PageHeader title={t("Conditions")} description={t("Long-term conditions and allergies on your record, with your latest vitals in context.")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title={t("Long-term conditions")} description={t("Recorded by your doctors or reported by you at sign-up")} icon={HeartPulse}>
            {conditions.isLoading ? (
              <SkeletonRows rows={3} />
            ) : !conditions.data?.length ? (
              <EmptyState compact icon={HeartPulse} title={t("No conditions on record")} description={t("Doctors add diagnosed conditions during consultations.")} />
            ) : (
              <div className="space-y-5">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {active.map((c) => (
                    <li key={c.id} className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[15px] font-semibold">{c.disease_name || c.icd_10_code}</div>
                        <StatusPill tone="primary">{t("Active")}</StatusPill>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{t("ICD-10 {icd_10_code}", { icd_10_code: c.icd_10_code })}</span>
                        <span>{t("Recorded {fmt}", { fmt: fmt(c.created_at) })}</span>
                        {c.added_by_name ? <span>{t("by {added_by_name}", { added_by_name: c.added_by_name })}</span> : <span>{t("self-reported")}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                {resolved.length > 0 && (
                  <div>
                    <div className="kicker mb-2">{t("Resolved")}</div>
                    <ul className="flex flex-wrap gap-2">
                      {resolved.map((c) => <li key={c.id} className="rounded-md bg-muted px-2.5 py-1 text-[13px] text-muted-foreground">{c.disease_name || c.icd_10_code}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title={t("Allergies")} description={t("Shown to doctors before they prescribe")} icon={ShieldAlert}>
            {allergies.isLoading ? (
              <SkeletonRows rows={2} />
            ) : !allergies.data?.length ? (
              <EmptyState compact icon={ShieldAlert} title={t("No allergies recorded")} />
            ) : (
              <ul className="divide-y">
                {allergies.data.map((a) => {
                  const sv = severity(a.severity);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium">{a.allergen}</div>
                        <div className="text-xs text-muted-foreground">{a.reaction_type}{a.added_by_name ? t(" · added by {added_by_name}", { added_by_name: a.added_by_name }) : ''}</div>
                      </div>
                      <StatusPill tone={sv.tone}>{sv.label}</StatusPill>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title={t("Latest vitals")} description={t("Most recent readings on your record")} icon={Activity} className="h-fit">
          {kpis.isLoading ? (
            <SkeletonRows rows={2} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("Blood pressure")}</span>
                  <span>{fmt(bp?.recorded_at)}</span>
                </div>
                <div className="tabular mt-2 text-[26px] font-semibold tracking-tight">
                  {bp?.value != null ? `${Math.round(bp.value)}/${Math.round(bp.secondary_value ?? 0)}` : '—'}
                  <span className="ml-1 text-[13px] font-normal text-muted-foreground">{t("mmHg")}</span>
                </div>
                {bpB && <StatusPill tone={bpB.tone} className="mt-2">{bpB.label}</StatusPill>}
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("Blood sugar")}</span>
                  <span>{fmt(sugar?.recorded_at)}</span>
                </div>
                <div className="tabular mt-2 text-[26px] font-semibold tracking-tight">
                  {sugar?.value != null ? Math.round(sugar.value) : '—'}
                  <span className="ml-1 text-[13px] font-normal text-muted-foreground">{t("mg/dL")}</span>
                </div>
                {sgB && <StatusPill tone={sgB.tone} className="mt-2">{sgB.label}</StatusPill>}
              </div>
              <p className="text-xs text-muted-foreground">{t("These bands are general guidance, not a diagnosis. Discuss your readings with your doctor.")}</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default withAuth(ConditionsPage, ['patient']);
