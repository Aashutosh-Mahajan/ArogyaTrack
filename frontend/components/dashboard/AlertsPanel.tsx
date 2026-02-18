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
      badge: 'bg-red-100 text-red-700 ring-red-200',
      border: 'border-red-200',
      bg: 'bg-red-50/50',
      icon: 'text-red-600',
      dot: 'bg-red-500',
    },
    high: {
      badge: 'bg-orange-100 text-orange-700 ring-orange-200',
      border: 'border-orange-200',
      bg: 'bg-orange-50/50',
      icon: 'text-orange-600',
      dot: 'bg-orange-500',
    },
    medium: {
      badge: 'bg-amber-100 text-amber-700 ring-amber-200',
      border: 'border-amber-200',
      bg: 'bg-amber-50/40',
      icon: 'text-amber-600',
      dot: 'bg-amber-500',
    },
    low: {
      badge: 'bg-blue-100 text-blue-700 ring-blue-200',
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
  const Icon = ALERT_ICON[alert.alert_type] ?? FiAlertTriangle;

  return (
    <div
      className={`group relative flex items-start gap-3 p-4 rounded-xl border transition-all ${alert.is_read
          ? 'border-gray-100 bg-white'
          : `${cfg.border} ${cfg.bg}`
        }`}
    >
      {/* Unread dot */}
      {!alert.is_read && (
        <span
          className={`absolute top-3 right-3 h-2.5 w-2.5 rounded-full ${cfg.dot} ring-2 ring-white`}
        />
      )}

      {/* Icon */}
      <div
        className={`shrink-0 p-2 rounded-xl ${alert.is_read ? 'bg-gray-100 text-gray-500' : cfg.badge
          }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4
            className={`text-sm font-semibold ${alert.is_read ? 'text-gray-600' : 'text-gray-900'
              }`}
          >
            {alert.title}
          </h4>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${cfg.badge}`}
          >
            {alert.severity}
          </span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            {ALERT_TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
          </span>
        </div>
        <p
          className={`text-sm mt-1 leading-relaxed ${alert.is_read ? 'text-gray-400' : 'text-gray-600'
            }`}
        >
          {alert.message}
        </p>
        <p className="text-xs text-gray-400 mt-1.5">
          <TimeAgo dateStr={alert.created_at} />
        </p>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!alert.is_read && (
          <button
            onClick={() => onMarkRead(alert.id)}
            title={t('mark_read')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition"
          >
            <FiCheck className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDismiss(alert.id)}
          title={t('dismiss')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
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
          className="animate-pulse flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-white"
        >
          <div className="h-9 w-9 bg-gray-200 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-50">
            <FiBell className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t('alerts_title')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('alerts_subtitle')}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-2 rounded-full bg-red-500 text-white text-xs font-bold">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <AlertsSkeleton />
        ) : isError ? (
          <div className="text-center py-10 text-gray-500">
            <FiAlertCircle className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{t('failed_load')}</p>
            <p className="text-sm mt-1">{t('try_again')}</p>
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
          <div className="text-center py-10 text-gray-500">
            <FiShield className="h-10 w-10 mx-auto mb-3 text-green-300" />
            <p className="font-medium text-green-600">{t('all_clear')}</p>
            <p className="text-sm mt-1">
              {t('all_clear_desc')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
