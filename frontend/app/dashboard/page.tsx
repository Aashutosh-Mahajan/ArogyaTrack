'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Download,
  Droplets,
  FileText,
  FlaskConical,
  HeartPulse,
  Pill,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { EmptyState, Panel, Skeleton, SkeletonRows, Stat, StatusPill } from '@/components/ui/page';
import { C, ChartTooltip, Legend, axisProps, gridProps } from '@/components/charts/chartTheme';
import { RecordDetailModal, doctorLabel, recordStatus } from '@/components/dashboard/RecordDetailModal';
import { cn } from '@/lib/utils';
import type {
  Allergy,
  ChronicCondition,
  DashboardKPIs,
  DashboardSummary,
  HealthTrendsResponse,
  LabTest,
  RecentRecord,
} from '@/types';
import { t as tr, intlLocale, tn } from '@/lib/i18n';

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
const fmtLong = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? tr("Good morning") : h < 17 ? tr("Good afternoon") : tr("Good evening");
}

function scoreInfo(score: number) {
  if (score >= 80) return { label: tr("Excellent"), tone: 'text-success', stroke: 'hsl(var(--success))' };
  if (score >= 60) return { label: tr("Good"), tone: 'text-primary', stroke: 'hsl(var(--primary))' };
  if (score >= 40) return { label: tr("Fair"), tone: 'text-warning', stroke: 'hsl(var(--warning))' };
  return { label: tr("Needs attention"), tone: 'text-destructive', stroke: 'hsl(var(--destructive))' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const info = scoreInfo(score);
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={info.stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[34px] font-semibold leading-none tracking-[-0.04em]">{score}</span>
        <span className={cn('mt-1 text-[11.5px] font-medium', info.tone)}>{info.label}</span>
      </div>
    </div>
  );
}

function trendOf(values: number[]) {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const pct = first ? ((last - first) / first) * 100 : 0;
  if (Math.abs(pct) < 2) return { dir: 'flat' as const, pct };
  return { dir: pct > 0 ? ('up' as const) : ('down' as const), pct };
}

function PatientDashboard(): React.JSX.Element {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<RecentRecord | null>(null);

  const summary = useQuery<DashboardSummary>({ queryKey: ['dashboard-summary'], queryFn: () => api.dashboard.getSummary() });
  const kpis = useQuery<DashboardKPIs>({ queryKey: ['dashboard-kpis'], queryFn: () => api.dashboard.getKPIs() });
  const trends = useQuery<HealthTrendsResponse>({
    queryKey: ['dashboard-health-trends', 24],
    queryFn: () => api.dashboard.getHealthTrends({ months: 24 }),
  });
  const records = useQuery<RecentRecord[]>({
    queryKey: ['dashboard-recent-records'],
    queryFn: () => api.dashboard.getRecentRecords({ limit: 6 }),
  });
  const labs = useQuery<LabTest[]>({ queryKey: ['dashboard-lab-monitoring'], queryFn: () => api.dashboard.getLabMonitoring() });
  const conditions = useQuery<ChronicCondition[]>({ queryKey: ['patient-chronic-conditions'], queryFn: () => api.medical.getChronicConditions() });
  const allergies = useQuery<Allergy[]>({ queryKey: ['patient-allergies'], queryFn: () => api.medical.getAllergies() });
  const upcoming = useQuery<any[]>({ queryKey: ['adherence-upcoming'], queryFn: () => api.adherence.getUpcomingDoses() as any });

  const s = summary.data;
  const k = kpis.data;
  const score = s ? Math.max(0, Math.min(100, Math.round(100 - 10 * (s.calculated_risk_score ?? 0)))) : 0;
  const activeConditions = (conditions.data ?? []).filter((c) => c.is_active);
  const abnormalLabs = (labs.data ?? []).filter((l) => l.status !== 'normal');
  const firstName = (s?.patient_name || user?.first_name || '').split(' ')[0];

  const bp = useMemo(
    () =>
      (trends.data?.trends.find((x) => x.metric === 'blood_pressure')?.data ?? []).slice(-12).map((p) => ({
        date: fmtShort(p.date),
        Systolic: p.value,
        Diastolic: p.secondary_value ?? undefined,
      })),
    [trends.data]
  );
  const sugar = useMemo(
    () => (trends.data?.trends.find((x) => x.metric === 'sugar')?.data ?? []).slice(-12).map((p) => ({ date: fmtShort(p.date), Glucose: p.value })),
    [trends.data]
  );
  const sugarTrend = trendOf(sugar.map((d) => d.Glucose));

  const bpValue = k?.recent_bp?.value != null ? `${Math.round(k.recent_bp.value)}/${Math.round(k.recent_bp.secondary_value ?? 0)}` : '—';
  const sugarValue = k?.recent_sugar?.value != null ? Math.round(k.recent_sugar.value) : '—';
  const riskTone = s?.calculated_risk_level === 'High' ? 'danger' : s?.calculated_risk_level === 'Medium' ? 'warning' : 'success';

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[13px] text-muted-foreground">
            {new Date().toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em] md:text-[32px]">
            {summary.isLoading ? <Skeleton className="h-9 w-64" /> : <>{greeting()}{firstName ? `, ${firstName}` : ''}</>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/patient-card" className="inline-flex h-10 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13.5px] font-medium shadow-sm hover:bg-muted">
            <CreditCard className="h-4 w-4 text-muted-foreground" />{' '}{tr("Health card")}</Link>
          <Link href="/dashboard/medical-records" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13.5px] font-medium text-primary-foreground shadow-button">
            <FileText className="h-4 w-4" />{' '}{tr("Records")}</Link>
        </div>
      </div>

      {/* ── Health summary ── */}
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            {summary.isLoading ? <Skeleton className="h-[132px] w-[132px] rounded-full" /> : <ScoreRing score={score} />}
            <div className="min-w-0 flex-1">
              <div className="kicker">{tr("Health score")}</div>
              <p className="mt-1.5 max-w-sm text-[14px] text-muted-foreground">{tr("Calculated from your recent vitals, lab results, conditions and medication adherence.")}</p>
              <dl className="mt-5 grid grid-cols-3 gap-4 border-t pt-4">
                <div>
                  <dt className="text-xs text-muted-foreground">{tr("Risk level")}</dt>
                  <dd className="mt-1">
                    {s ? <StatusPill tone={riskTone}>{tr(s.calculated_risk_level)}</StatusPill> : <Skeleton className="h-5 w-14" />}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{tr("Adherence")}</dt>
                  <dd className="tabular mt-1 text-[17px] font-semibold">{s ? `${Math.round(s.adherence_percentage)}%` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{tr("Conditions")}</dt>
                  <dd className="tabular mt-1 text-[17px] font-semibold">{conditions.data ? activeConditions.length : '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="text-xs text-muted-foreground">{tr("Patient ID")}</div>
            <div className="mt-1.5 truncate font-mono text-[14px] font-semibold">{s?.health_id || "—"}</div>
            <Link href="/dashboard/patient-card" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary">{tr("Show QR card")}{' '}<ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Droplets className="h-3.5 w-3.5 text-destructive" />{' '}{tr("Blood group")}</div>
            <div className="mt-1.5 text-[22px] font-semibold tracking-tight">{s?.blood_group || '—'}</div>
          </div>
          <Link href="/dashboard/alerts" className="group col-span-2 flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', (s?.total_alerts ?? 0) > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/12 text-success')}>
              <Bell className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">
                {s ? ((s.total_alerts ?? 0) > 0 ? tn(s.total_alerts ?? 0, '1 outbreak alert in your region', '{count} outbreak alerts in your region') : tr("No outbreak alerts in your region")) : tr("Checking alerts…")}
              </div>
              <div className="text-[12.5px] text-muted-foreground">{tr("Health alerts and risk notifications")}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={t("Medical Records")} value={k?.total_medical_records ?? 0} icon={FileText} loading={kpis.isLoading} href="/dashboard/medical-records" />
        <Stat label={t("Active Prescriptions")} value={k?.active_prescriptions ?? 0} icon={ClipboardList} tone="info" loading={kpis.isLoading} href="/dashboard/prescriptions" />
        <Stat label={tr("Latest BP")} value={bpValue} hint={k?.recent_bp?.recorded_at ? tr("mmHg · {fmtShort}", { fmtShort: fmtShort(k.recent_bp.recorded_at) }) : 'mmHg'} icon={HeartPulse} tone="danger" loading={kpis.isLoading} />
        <Stat label={tr("Blood sugar")} value={sugarValue} hint={k?.recent_sugar?.recorded_at ? tr("mg/dL · {fmtShort}", { fmtShort: fmtShort(k.recent_sugar.recorded_at) }) : 'mg/dL'} icon={Activity} tone="warning" loading={kpis.isLoading} />
        <Stat label={tr("Abnormal lab values")} value={labs.data ? abnormalLabs.length : '—'} hint={labs.data ? tr("of {length} tracked tests", { length: labs.data.length }) : undefined} icon={FlaskConical} tone={abnormalLabs.length ? 'warning' : 'success'} loading={labs.isLoading} href="/dashboard/lab-reports" />
        <Stat label={t("Report Downloads")} value={k?.total_downloads ?? 0} icon={Download} tone="neutral" loading={kpis.isLoading} href="/dashboard/downloads" />
      </section>

      {/* ── Trends ── */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title={tr("Blood pressure")} description={tr("Your 12 most recent readings")} icon={HeartPulse} actions={<Legend items={[{ label: tr("Systolic"), color: C.primary }, { label: tr("Diastolic"), color: C.blue }]} />}>
          {trends.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : bp.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={bp} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} domain={['dataMin - 10', 'dataMax + 10']} width={36} allowDecimals={false} tickFormatter={(v: number) => String(Math.round(v))} />
                <Tooltip content={<ChartTooltip unit="mmHg" />} />
                <Area type="monotone" dataKey="Systolic" stroke={C.primary} strokeWidth={2} fill="url(#bpFill)" dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Diastolic" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact icon={HeartPulse} title={tr("No blood pressure readings yet")} description={tr("Readings recorded by your doctor during visits will appear here.")} />
          )}
        </Panel>

        <Panel
          title={tr("Blood sugar")}
          description={tr("Your 12 most recent readings")}
          icon={Activity}
          actions={
            sugarTrend && (
              <StatusPill tone={sugarTrend.dir === 'up' ? 'warning' : sugarTrend.dir === 'down' ? 'success' : 'neutral'}>
                {sugarTrend.dir === 'up' ? <TrendingUp className="h-3 w-3" /> : sugarTrend.dir === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                {sugarTrend.dir === 'flat' ? tr("Stable") : `${Math.abs(sugarTrend.pct).toFixed(0)}% ${sugarTrend.dir === 'up' ? 'higher' : 'lower'}`}
              </StatusPill>
            )
          }
        >
          {trends.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : sugar.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sugar} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sgFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.amber} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} domain={['dataMin - 10', 'dataMax + 10']} width={36} allowDecimals={false} tickFormatter={(v: number) => String(Math.round(v))} />
                <Tooltip content={<ChartTooltip unit="mg/dL" />} />
                <Area type="monotone" dataKey="Glucose" stroke={C.amber} strokeWidth={2} fill="url(#sgFill)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact icon={Activity} title={tr("No glucose readings yet")} description={tr("Glucose values from visits and lab tests will appear here.")} />
          )}
        </Panel>
      </section>

      {/* ── Records + side column ── */}
      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title={t("Recent Medical Records")}
          description={tr("Your latest consultations")}
          icon={FileText}
          actions={
            <Link href="/dashboard/medical-records" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">
              {t("View All")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
          bodyClassName="px-3 pb-3 md:px-3"
        >
          {records.isLoading ? (
            <SkeletonRows rows={4} className="p-3" />
          ) : records.data?.length ? (
            <ul>
              {records.data.map((r) => {
                const st = recordStatus[r.status] ?? recordStatus.completed;
                return (
                  <li key={r.id}>
                    <button onClick={() => setSelected(r)} className="record-item w-full text-left">
                      <span className="record-icon">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="record-title block truncate">{r.diagnosis_summary || tr("Consultation")}</span>
                        <span className="record-meta">
                          <span>{doctorLabel(r.doctor_name)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tr(r.department)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{fmtLong(r.visit_date)}</span>
                        </span>
                      </span>
                      <StatusPill tone={st.tone} className="hidden sm:inline-flex">{st.label}</StatusPill>
                      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={FileText} title={tr("No visit records yet")} description={tr("When a doctor scans your health card and records a consultation, it will show up here.")} action={<Link href="/dashboard/patient-card" className="text-[13.5px] font-semibold text-primary">{tr("Open your health card")}</Link>} />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title={tr("Upcoming doses")} description={tr("Next 24 hours")} icon={Pill} actions={<Link href="/dashboard/adherence" className="text-[13px] font-medium text-primary">{tr("Adherence")}</Link>}>
            {upcoming.isLoading ? (
              <SkeletonRows rows={2} />
            ) : upcoming.data?.length ? (
              <ul className="space-y-2">
                {upcoming.data.slice(0, 4).map((d: any) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Pill className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{d.medicine_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(d.scheduled_time).toLocaleString(intlLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{tr("No doses scheduled in the next 24 hours.")}</p>
            )}
          </Panel>

          <Panel title={tr("Conditions & allergies")} icon={ShieldAlert} actions={<Link href="/dashboard/conditions" className="text-[13px] font-medium text-primary">{tr("Details")}</Link>}>
            {conditions.isLoading || allergies.isLoading ? (
              <SkeletonRows rows={2} />
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">{tr("Active conditions")}</div>
                  {activeConditions.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeConditions.map((c) => (
                        <span key={c.id} className="tag" title={c.icd_10_code}>{c.disease_name || c.icd_10_code}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">{tr("None recorded")}</p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">{tr("Allergies")}</div>
                  {allergies.data?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {allergies.data.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" /> {a.allergen}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">{tr("None recorded")}</p>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </section>

      {selected && <RecordDetailModal open={!!selected} onOpenChange={(o) => !o && setSelected(null)} record={selected} />}
    </div>
  );
}

export default withAuth(PatientDashboard, ['patient']);
