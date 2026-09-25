'use client';

import { useQuery } from '@tanstack/react-query';

export interface PublicStats {
  as_of: string;
  monitored_regions: number;
  states_covered: number;
  surveillance_records: number;
  active_clusters: number;
  active_alerts: number;
  forecasts_generated: number;
  ml_models_total: number;
  ml_models_live: number;
  patients_registered: number;
  doctors_registered: number;
  pharmacists_registered: number;
  cases_last_7_days: number;
  top_diseases: { disease_name: string; total_cases: number }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/** Aggregate platform numbers for public pages (no auth, no toasts on failure). */
export function usePublicStats() {
  return useQuery<PublicStats>({
    queryKey: ['public-stats'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/surveillance/public-stats/`);
      if (!res.ok) throw new Error(`public-stats ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function formatCompact(n?: number | null) {
  if (n === undefined || n === null) return '—';
  return new Intl.NumberFormat('en-IN', { notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
}

export function formatAsOf(date?: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
