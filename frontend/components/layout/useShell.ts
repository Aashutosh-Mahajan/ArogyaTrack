'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { PortalKey } from './nav';

/** Live counters shown as nav/header badges. */
export function useShellCounts(portal: PortalKey) {
  const patientAlerts = useQuery({
    queryKey: ['shell', 'patient-alerts'],
    queryFn: () => api.dashboard.getAlerts(),
    enabled: portal === 'patient',
    refetchInterval: 60_000,
    select: (alerts) =>
      (Array.isArray(alerts) ? alerts : []).filter((a) => !a.is_read && !a.is_dismissed).length,
  });

  const surveillanceAlerts = useQuery({
    queryKey: ['shell', 'surveillance-alerts'],
    queryFn: () => api.surveillance.getAlerts({ status: 'active', page_size: 1 }),
    enabled: portal === 'admin',
    refetchInterval: 60_000,
    select: (res: any) => (typeof res?.count === 'number' ? res.count : Array.isArray(res) ? res.length : 0),
  });

  const pendingDoctors = useQuery({
    queryKey: ['shell', 'pending-doctors'],
    queryFn: () => api.admin.pendingDoctors(),
    enabled: portal === 'admin',
    refetchInterval: 120_000,
    select: (rows: unknown[]) => (Array.isArray(rows) ? rows.length : 0),
  });

  return {
    patientAlerts: patientAlerts.data ?? 0,
    surveillanceAlerts: surveillanceAlerts.data ?? 0,
    pendingDoctors: pendingDoctors.data ?? 0,
  };
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* cookie may already be gone — sign out locally regardless */
    }
    clearAuth();
    queryClient.clear();
    router.replace('/login');
  }, [clearAuth, queryClient, router]);
}

export function displayName(user: { first_name?: string; last_name?: string; email?: string } | null) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return name || user?.email?.split('@')[0] || 'User';
}

export function initialsOf(name: string) {
  return (
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'U'
  );
}
