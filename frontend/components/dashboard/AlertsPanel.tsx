'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardAlert } from '@/types';
import {
  FiAlertTriangle,
  FiAlertCircle,
  FiActivity,
  FiHeart,
  FiShield,
  FiCheck,
  FiX,
  FiBell,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { useLanguage } from '@/components/providers/LanguageProvider';

/* ── Severity config ───────────────────────────────────────────── */


/* ── Time-ago helper ───────────────────────────────────────────── */

function TimeAgo({ dateStr }: { dateStr: string }) {
  const { t } = useLanguage();
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);

  // Simple time ago logic using translations
  if (mins < 1) return <>{t('just_now')}</>;
  if (mins < 60) return <>{mins}m {t('ago')}</>;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return <>{hrs}h {t('ago')}</>;
  const days = Math.floor(hrs / 24);
  if (days < 7) return <>{days}d {t('ago')}</>;

  return <>{new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })}</>;
}

/* ── Single alert row ──────────────────────────────────────────── */

function AlertRow({
  alert,
  onMarkRead,
  onDismiss,
}: {
  alert: DashboardAlert;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { t } = useLanguage();

  const SEVERITY_CONFIG = {
    critical: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      border: 'border-rose-200',
      bg: 'bg-rose-50/50',
      icon: 'text-rose-600',
      dot: 'bg-rose-500',
    },
    high: {
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      border: 'border-orange-200',
      bg: 'bg-orange-50/50',
      icon: 'text-orange-600',
      dot: 'bg-orange-500',
    },
    medium: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      border: 'border-amber-200',
      bg: 'bg-amber-50/40',
      icon: 'text-amber-600',
      dot: 'bg-amber-500',
    },
    low: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      border: 'border-blue-200',
      bg: 'bg-blue-50/40',
      icon: 'text-blue-600',
      dot: 'bg-blue-500',
    },
  } as const;

  const ALERT_ICON: Record<string, React.ElementType> = {
    abnormal_labs: FiActivity,
    low_adherence: FiHeart,
    high_risk: FiShield,
  };

  const ALERT_TYPE_LABEL: Record<string, string> = {
    abnormal_labs: t('alert_lab_results'),
    low_adherence: t('alert_adherence'),
    high_risk: t('alert_risk_score'),
  };

  const cfg = SEVERITY_CONFIG[alert.severity];
  // @ts-ignore
  const Icon = ALERT_ICON[alert.alert_type] ?? FiAlertTriangle;

  return (
    <div
      className={`group relative flex items-start gap-4 p-4 rounded-xl border transition-all ${alert.is_read
        ? 'border-slate-100 bg-white hover:border-slate-200'
        : `${cfg.border} ${cfg.bg}`
        }`}
    >
      {/* Unread dot */}
      {!alert.is_read && (
        <span
          className={`absolute top-4 right-4 h-2 w-2 rounded-full ${cfg.dot} animate-pulse`}
        />
      )}

      {/* Icon */}
      <div
        className={`shrink-0 p-2.5 rounded-xl ${alert.is_read ? 'bg-slate-100 text-slate-400' : cfg.badge
          }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h4
            className={`text-sm font-bold ${alert.is_read ? 'text-slate-500' : 'text-slate-800'
              }`}
          >
            {alert.title}
          </h4>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg.badge}`}
          >
            {alert.severity}
          </span>
        </div>

        <p
          className={`text-sm leading-relaxed ${alert.is_read ? 'text-slate-400' : 'text-slate-600'
            }`}
        >
          {alert.message}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <p className="text-xs text-slate-400 font-medium">
            <TimeAgo dateStr={alert.created_at} />
          </p>
          <span className="text-slate-300">•</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            {ALERT_TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!alert.is_read && (
          <button
            onClick={() => onMarkRead(alert.id)}
            title={t('mark_read')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
          >
            <FiCheck className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDismiss(alert.id)}
          title={t('dismiss')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────── */

function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-white"
        >
          <div className="h-10 w-10 bg-slate-200 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 bg-slate-200 rounded" />
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */

export function AlertsPanel() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const {
    data: alerts,
    isLoading,
    isError,
  } = useQuery<DashboardAlert[]>({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.dashboard.getAlerts(),
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (alertId: string) => api.dashboard.markAlertRead(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
    },
    onError: () => toast.error('Failed to mark alert as read'),
  });

  const dismissMutation = useMutation({
    mutationFn: (alertId: string) => api.dashboard.dismissAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      toast.success('Alert dismissed');
    },
    onError: () => toast.error('Failed to dismiss alert'),
  });

  const handleMarkRead = (id: string) => markReadMutation.mutate(id);
  const handleDismiss = (id: string) => dismissMutation.mutate(id);

  const unreadCount = alerts?.filter((a) => !a.is_read).length ?? 0;

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-rose-400 to-orange-400"></div>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-lg">
              <FiBell className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('alerts_title')}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{t('alerts_subtitle')}</p>
            </div>
          </div>

          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-2 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-200 animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <AlertsSkeleton />
        ) : isError ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <FiAlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">{t('failed_load')}</p>
            <p className="text-sm mt-1 text-slate-400">{t('try_again')}</p>
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onMarkRead={handleMarkRead}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="bg-white p-3 rounded-full shadow-sm inline-block mb-3">
              <FiShield className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="font-semibold text-emerald-600">{t('all_clear')}</p>
            <p className="text-sm mt-1 text-slate-400">
              {t('all_clear_desc')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
