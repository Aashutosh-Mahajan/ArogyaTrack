'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Activity, AlertTriangle, BellOff, CheckCheck, FlaskConical, Globe2, Pill, X } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, SkeletonRows, StatusPill } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import type { DashboardAlert } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

const TYPE_META: Record<DashboardAlert['alert_type'], { label: string; icon: typeof Activity }> = {
  abnormal_labs: { get label() { return t("Lab result"); }, icon: FlaskConical },
  low_adherence: { get label() { return t("Medication"); }, icon: Pill },
  high_risk: { get label() { return t("Health risk"); }, icon: Activity },
  outbreak: { get label() { return t("Outbreak nearby"); }, icon: Globe2 },
};

const SEVERITY: Record<DashboardAlert['severity'], { label: string; tone: 'neutral' | 'warning' | 'danger' | 'info'; bar: string }> = {
  low: { get label() { return t("Low"); }, tone: 'info', bar: 'bg-info' },
  medium: { get label() { return t("Medium"); }, tone: 'warning', bar: 'bg-warning' },
  high: { get label() { return t("High"); }, tone: 'danger', bar: 'bg-destructive' },
  critical: { get label() { return t("Critical"); }, tone: 'danger', bar: 'bg-destructive' },
};

const FILTERS = [
  { key: 'all', get label() { return t("All"); } },
  { key: 'unread', get label() { return t("Unread"); } },
  { key: 'outbreak', get label() { return t("Outbreaks"); } },
  { key: 'personal', get label() { return t("My health"); } },
] as const;

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t("just now");
  if (s < 3600) return t("{floor} min ago", { floor: Math.floor(s / 60) });
  if (s < 86400) return t("{floor} h ago", { floor: Math.floor(s / 3600) });
  if (s < 7 * 86400) return t("{floor} d ago", { floor: Math.floor(s / 86400) });
  return new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AlertsPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const alerts = useQuery<DashboardAlert[]>({ queryKey: ['dashboard-alerts'], queryFn: () => api.dashboard.getAlerts() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['dashboard-alerts'] });
    qc.invalidateQueries({ queryKey: ['shell', 'patient-alerts'] });
  };

  const markRead = useMutation({ mutationFn: (id: string) => api.dashboard.markAlertRead(id), onSuccess: refresh });
  const dismiss = useMutation({
    mutationFn: (id: string) => api.dashboard.dismissAlert(id),
    onSuccess: () => {
      toast.success(t("Alert dismissed"));
      refresh();
    },
  });
  const markAll = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => api.dashboard.markAlertRead(id))),
    onSuccess: () => {
      toast.success(t("All alerts marked as read"));
      refresh();
    },
  });

  const all = useMemo(() => alerts.data ?? [], [alerts.data]);
  const unread = all.filter((a) => !a.is_read);
  const list = useMemo(
    () =>
      all.filter((a) =>
        filter === 'all' ? true : filter === 'unread' ? !a.is_read : filter === 'outbreak' ? a.alert_type === 'outbreak' : a.alert_type !== 'outbreak'
      ),
    [all, filter]
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {f.label}
              {f.key === 'unread' && unread.length > 0 && <span className="tabular ml-1.5 opacity-80">{unread.length}</span>}
            </button>
          ))}
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markAll.mutate(unread.map((a) => a.id))}
            disabled={markAll.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13px] font-medium shadow-sm hover:bg-muted disabled:opacity-60"
          >
            <CheckCheck className="h-4 w-4" />{' '}{t("Mark all as read")}</button>
        )}
      </div>

      {alerts.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={4} /></div>
      ) : alerts.isError ? (
        <ErrorState onRetry={() => alerts.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={BellOff} title={all.length ? t("Nothing in this view") : t("No alerts")} description={all.length ? t("Try another filter.") : t("We will notify you about abnormal results, missed medication and outbreaks near you.")} />
      ) : (
        <ul className="space-y-3">
          {list.map((a) => {
            const meta = TYPE_META[a.alert_type] ?? { label: a.alert_type, icon: AlertTriangle };
            const sev = SEVERITY[a.severity] ?? SEVERITY.low;
            const Icon = meta.icon;
            return (
              <li
                key={a.id}
                className={cn('relative flex gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-colors', !a.is_read && 'cursor-pointer border-primary/25 bg-primary/[0.025]')}
                onClick={() => !a.is_read && markRead.mutate(a.id)}
              >
                <span className={cn('absolute inset-y-0 left-0 w-1', sev.bar)} aria-hidden="true" />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold">{a.title}</h3>
                    {!a.is_read && <span className="h-2 w-2 rounded-full bg-primary" aria-label={t("Unread")} />}
                  </div>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{a.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusPill tone={sev.tone}>{sev.label}</StatusPill>
                    <span className="rounded-md bg-muted px-2 py-0.5">{meta.label}</span>
                    <span>{timeAgo(a.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss.mutate(a.id);
                  }}
                  disabled={dismiss.isPending && dismiss.variables === a.id}
                  className="self-start rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t("Dismiss {title}", { title: a.title })}
                  title={t("Dismiss")}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
