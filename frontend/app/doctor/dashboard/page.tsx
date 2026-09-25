'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  FilePlus2,
  FlaskConical,
  QrCode,
  Siren,
  Stethoscope,
  Users,
} from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { EmptyState, Panel, SkeletonRows, Stat, StatusPill, severityTone } from '@/components/ui/page';
import { initialsOf } from '@/components/layout/useShell';
import type { MyPatient } from '@/types';
import { t, intlLocale, tn } from '@/lib/i18n';

interface Summary {
  total_patients: number;
  high_risk_count: number;
  pending_labs: number;
  recent_updates: number;
}

interface HighRisk {
  patient_id: string;
  unique_patient_id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  risk_level: string;
  risk_score: number;
  risk_factors: string[];
  latest_bp: string | null;
  latest_sugar: number | null;
}

interface ActivityItem {
  type: 'abnormal_lab' | 'critical_visit' | 'follow_up' | 'new_record';
  patient_id?: string;
  title: string;
  description: string;
  timestamp: string;
  severity: string;
}


/** Activity titles arrive in English; translate them by type. */
function activityTitle(a: { type: string; title: string }): string {
  const lab = a.title.match(/^Abnormal (.+) detected$/);
  if (lab) return t('Abnormal {test} detected', { test: lab[1] });
  const known: Record<string, string> = {
    critical_visit: t('Critical visit recorded'),
    follow_up: t('Follow-up required'),
    new_record: t('New record added'),
  };
  return known[a.type] ?? t(a.title);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t("Good morning") : h < 17 ? t("Good afternoon") : t("Good evening");
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return t("{max} min ago", { max: Math.max(1, Math.floor(s / 60)) });
  if (s < 86400) return t("{floor} h ago", { floor: Math.floor(s / 3600) });
  return t("{floor} d ago", { floor: Math.floor(s / 86400) });
}

const ACTIVITY_ICON = { abnormal_lab: FlaskConical, critical_visit: Siren, follow_up: Activity, new_record: FilePlus2 };

function DoctorDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const summary = useQuery<Summary>({ queryKey: ['doctor-dashboard-summary'], queryFn: () => api.medical.getDashboardSummary() as Promise<Summary> });
  const highRisk = useQuery({ queryKey: ['doctor-high-risk'], queryFn: () => api.medical.getHighRiskPatients() as Promise<{ count: number; results: HighRisk[] }> });
  const activity = useQuery({ queryKey: ['doctor-recent-activity'], queryFn: () => api.medical.getRecentActivity() as Promise<{ count: number; results: ActivityItem[] }> });
  const patients = useQuery({ queryKey: ['myPatients'], queryFn: () => api.medical.getMyPatients() as Promise<{ count: number; results: MyPatient[] }> });

  const s = summary.data;
  const lastName = user?.last_name || user?.first_name || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[13px] text-muted-foreground">{new Date().toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em] md:text-[32px]">
            {greeting()}{lastName ? t(", Dr. {lastName}", { lastName }) : ''}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/doctor/patients" className="inline-flex h-10 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13.5px] font-medium shadow-sm hover:bg-muted">
            <Users className="h-4 w-4 text-muted-foreground" />{' '}{t("My patients")}</Link>
          <Link href="/doctor/scan-qr" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13.5px] font-medium text-primary-foreground shadow-button">
            <QrCode className="h-4 w-4" />{' '}{t("Scan health card")}</Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Patients with access")} value={s?.total_patients ?? 0} icon={Users} loading={summary.isLoading} href="/doctor/patients" />
        <Stat label={t("High-risk patients")} value={s?.high_risk_count ?? 0} icon={AlertTriangle} tone="danger" loading={summary.isLoading} href="/doctor/high-risk" />
        <Stat label={t("Abnormal labs to review")} value={s?.pending_labs ?? 0} icon={FlaskConical} tone="warning" loading={summary.isLoading} hint={t("Last 90 days")} />
        <Stat label={t("Updates this week")} value={s?.recent_updates ?? 0} icon={Activity} tone="info" loading={summary.isLoading} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title={t("High-risk watchlist")}
          description={t("Ranked by risk score from conditions, vitals and labs")}
          icon={AlertTriangle}
          actions={<Link href="/doctor/high-risk" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">{t("View all")}{' '}<ArrowRight className="h-3.5 w-3.5" /></Link>}
          bodyClassName="px-3 pb-3 md:px-3"
        >
          {highRisk.isLoading ? (
            <SkeletonRows rows={4} className="p-3" />
          ) : highRisk.data?.results?.length ? (
            <ul>
              {highRisk.data.results.slice(0, 6).map((p) => (
                <li key={p.patient_id}>
                  <Link href={`/doctor/patients/${p.patient_id}`} className="record-item">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-[13px] font-semibold text-destructive">{initialsOf(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-semibold">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{t("{age} y · {toUpperCase}", { age: p.age, toUpperCase: p.gender?.[0]?.toUpperCase() })}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                        {p.condition}
                        {p.latest_bp ? ` · BP ${p.latest_bp}` : ''}
                        {p.latest_sugar ? t(" · Glucose {round}", { round: Math.round(p.latest_sugar) }) : ''}
                      </span>
                    </span>
                    <StatusPill tone={severityTone(p.risk_level)}>{t(p.risk_level)}</StatusPill>
                    <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={AlertTriangle} title={t("No high-risk patients")} description={t("Patients with active conditions or abnormal labs appear here once you have access to them.")} />
          )}
        </Panel>

        <Panel title={t("Recent activity")} description={t("Across your patients")} icon={Activity}>
          {activity.isLoading ? (
            <SkeletonRows rows={4} />
          ) : activity.data?.results?.length ? (
            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
              {activity.data.results.slice(0, 8).map((a, i) => {
                const Icon = ACTIVITY_ICON[a.type] ?? Activity;
                const inner = (
                  <>
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card">
                      <Icon className={a.severity === 'critical' || a.severity === 'high' ? 'h-3.5 w-3.5 text-destructive' : 'h-3.5 w-3.5 text-muted-foreground'} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium">{activityTitle(a)}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{a.description}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{ago(a.timestamp)}</span>
                  </>
                );
                return (
                  <li key={i}>
                    {a.patient_id ? (
                      <Link href={`/doctor/patients/${a.patient_id}`} className="flex items-start gap-3 rounded-lg hover:opacity-80">{inner}</Link>
                    ) : (
                      <div className="flex items-start gap-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState compact icon={Activity} title={t("Nothing new")} description={t("Abnormal labs and new visit records for your patients will show here.")} />
          )}
        </Panel>
      </section>

      <Panel
        title={t("Recently seen patients")}
        icon={Stethoscope}
        actions={<Link href="/doctor/patients" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">{t("All patients")}{' '}<ArrowRight className="h-3.5 w-3.5" /></Link>}
      >
        {patients.isLoading ? (
          <SkeletonRows rows={3} />
        ) : patients.data?.results?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {patients.data.results.slice(0, 6).map((p) => (
              <Link key={p.patient_id} href={`/doctor/patients/${p.patient_id}`} className="group flex items-center gap-3 rounded-xl border p-3.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-[13px] font-semibold text-accent-foreground">{initialsOf(p.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {tn(p.visit_count, '{unique_patient_id} · 1 visit', '{unique_patient_id} · {count} visits', { unique_patient_id: p.unique_patient_id })}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={QrCode}
            title={t("No patients yet")}
            description={t("Scan a patient's QR health card to open their history. Access lasts 24 hours unless you add them to your list.")}
            action={<Link href="/doctor/scan-qr" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button"><QrCode className="h-4 w-4" />{' '}{t("Scan a card")}</Link>}
          />
        )}
      </Panel>
    </div>
  );
}

export default withAuth(DoctorDashboardPage, ['doctor']);
