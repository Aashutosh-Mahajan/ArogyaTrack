'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type {
  DayWiseComparisonResponse,
  DiseaseDaySummary,
  DayWiseRegionComparison,
  TrendType,
} from '@/types';
import { FiTrendingUp, FiTrendingDown, FiMinus, FiChevronDown, FiChevronUp, FiCalendar } from 'react-icons/fi';

const TREND_CONFIG: Record<TrendType, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }> = {
  rapid_increase: { label: 'Rapid Increase', color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200', icon: FiTrendingUp },
  gradual_increase: { label: 'Gradual Increase', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: FiTrendingUp },
  stable: { label: 'Stable', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: FiMinus },
  gradual_decrease: { label: 'Gradual Decrease', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: FiTrendingDown },
  rapid_decrease: { label: 'Rapid Decrease', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: FiTrendingDown },
};

function TrendBadge({ trend }: { trend: TrendType }) {
  const config = TREND_CONFIG[trend] || TREND_CONFIG.stable;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${config.color} ${config.bgColor} ${config.borderColor}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function MiniBarChart({ values, maxVal }: { values: number[]; maxVal: number }) {
  const safeMax = maxVal || 1;
  return (
    <div className="flex items-end gap-[3px] h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className={`w-5 rounded-t-sm transition-all ${
            i === 0 ? 'bg-blue-500' : 'bg-slate-200'
          }`}
          style={{ height: `${Math.max((v / safeMax) * 100, 4)}%` }}
          title={`${v} cases`}
        />
      ))}
    </div>
  );
}

function DayLabel({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <span className="text-[10px] text-slate-400 font-medium">
      {dayNames[d.getDay()]}
    </span>
  );
}

function CaseDelta({ today, yesterday }: { today: number; yesterday: number }) {
  const diff = today - yesterday;
  if (diff === 0) return <span className="text-xs text-slate-400">—</span>;
  const isUp = diff > 0;
  return (
    <span className={`text-xs font-bold ${isUp ? 'text-rose-600' : 'text-emerald-600'}`}>
      {isUp ? '+' : ''}{diff}
    </span>
  );
}

function DiseaseSummaryRow({ summary, dates, onToggle, isExpanded }: {
  summary: DiseaseDaySummary;
  dates: string[];
  onToggle: () => void;
  isExpanded: boolean;
}) {
  const maxCases = Math.max(...summary.day_totals.map(d => d.cases), 1);

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-slate-800 truncate">{summary.disease_name}</p>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{summary.disease_code}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span>{summary.regions_affected} region{summary.regions_affected !== 1 ? 's' : ''}</span>
              <span className="text-slate-300">|</span>
              <span>{summary.total_cases_7d.toLocaleString()} total (7d)</span>
            </div>
          </div>

          {/* Mini bar chart */}
          <div className="hidden sm:flex flex-col items-center gap-0.5">
            <MiniBarChart values={summary.day_totals.map(d => d.cases)} maxVal={maxCases} />
            <div className="flex gap-[3px]">
              {dates.map((d, i) => (
                <div key={d} className="w-5 text-center">
                  <DayLabel dateStr={d} />
                </div>
              ))}
            </div>
          </div>

          {/* Today's cases */}
          <div className="text-right min-w-[80px]">
            <p className="text-lg font-bold text-slate-800">{summary.today_cases.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 uppercase">Today</p>
          </div>

          <TrendBadge trend={summary.trend} />
        </div>

        <div className="ml-3 text-slate-400">
          {isExpanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Day-by-day breakdown header */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-2">
          <div className="grid grid-cols-[1fr_repeat(7,minmax(60px,1fr))_100px] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Region / City</span>
            {dates.map((d, i) => {
              const dt = new Date(d + 'T00:00:00');
              const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              return <span key={d} className="text-center">{label}</span>;
            })}
            <span className="text-center">Trend</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RegionRow({ comparison, dates }: {
  comparison: DayWiseRegionComparison;
  dates: string[];
}) {
  return (
    <div className="grid grid-cols-[1fr_repeat(7,minmax(60px,1fr))_100px] gap-2 items-center px-4 py-2.5 border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
      {/* Region info */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{comparison.region_name}</p>
        <p className="text-[10px] text-slate-400 truncate">
          {comparison.district}, {comparison.state}
        </p>
      </div>

      {/* Day columns */}
      {comparison.day_data.map((dd, idx) => {
        const prevCases = idx < comparison.day_data.length - 1 ? comparison.day_data[idx + 1].cases : dd.cases;
        const diff = dd.cases - prevCases;
        const isToday = idx === 0;
        return (
          <div key={dd.date} className={`text-center ${isToday ? 'bg-blue-50 rounded-lg py-1' : ''}`}>
            <p className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
              {dd.cases}
            </p>
            {idx > 0 && idx < comparison.day_data.length && (
              <CaseDelta today={comparison.day_data[idx - 1].cases} yesterday={dd.cases} />
            )}
          </div>
        );
      })}

      {/* Trend */}
      <div className="flex justify-center">
        <TrendBadge trend={comparison.trend} />
      </div>
    </div>
  );
}

export function DayWiseComparison() {
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [expandedDiseases, setExpandedDiseases] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery<DayWiseComparisonResponse>({
    queryKey: ['daywise-comparison', selectedDisease, selectedState],
    queryFn: () => api.surveillance.getDayWiseComparison({
      disease_code: selectedDisease || undefined,
      state: selectedState || undefined,
    }),
  });

  const toggleDisease = (dc: string) => {
    setExpandedDiseases(prev => {
      const next = new Set(prev);
      if (next.has(dc)) next.delete(dc);
      else next.add(dc);
      return next;
    });
  };

  const getRegionsForDisease = (dc: string): DayWiseRegionComparison[] => {
    return (data?.comparisons || []).filter(c => c.disease_code === dc);
  };

  // Compute trend overview counts
  const trendCounts = (data?.disease_summaries || []).reduce((acc, s) => {
    acc[s.trend] = (acc[s.trend] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
      
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center text-xl text-slate-800">
              <FiCalendar className="mr-2 text-indigo-600" />
              Day-Wise Case Comparison
            </CardTitle>
            <CardDescription className="text-slate-500">
              {data?.reference_date
                ? `Comparing ${data.dates.length} days ending ${new Date(data.reference_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Compare disease cases across regions day by day'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Disease filter */}
            <select
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Diseases</option>
              <option value="A90">Dengue (A90)</option>
              <option value="U07.1">COVID-19 (U07.1)</option>
              <option value="B50.0">Malaria (B50.0)</option>
              <option value="J18.9">Pneumonia (J18.9)</option>
              <option value="J10.1">Influenza (J10.1)</option>
              <option value="A09">Gastroenteritis (A09)</option>
              <option value="B05">Measles (B05)</option>
              <option value="I10">Hypertension (I10)</option>
            </select>
            {/* State filter */}
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All States</option>
              {(data?.available_states || []).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Trend overview mini-badges */}
        {!isLoading && data && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {Object.entries(trendCounts).map(([trend, count]) => {
              const cfg = TREND_CONFIG[trend as TrendType];
              if (!cfg) return null;
              return (
                <span key={trend} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
                  {count} {cfg.label}
                </span>
              );
            })}
            <span className="text-xs text-slate-400 ml-1">
              {data.disease_summaries.length} disease{data.disease_summaries.length !== 1 ? 's' : ''} tracked
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100/50 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-12 text-slate-400">
            Failed to load comparison data. Please try again.
          </div>
        )}

        {!isLoading && !isError && data && data.disease_summaries.length === 0 && (
          <div className="text-center py-12 text-slate-400 flex flex-col items-center">
            <FiCalendar className="h-8 w-8 mb-2 opacity-30" />
            No surveillance data available for comparison
          </div>
        )}

        {!isLoading && !isError && data && data.disease_summaries.length > 0 && (
          <div className="space-y-3">
            {data.disease_summaries.map(summary => {
              const isExpanded = expandedDiseases.has(summary.disease_code);
              const regions = getRegionsForDisease(summary.disease_code);

              return (
                <div key={summary.disease_code}>
                  <DiseaseSummaryRow
                    summary={summary}
                    dates={data.dates}
                    onToggle={() => toggleDisease(summary.disease_code)}
                    isExpanded={isExpanded}
                  />

                  {isExpanded && regions.length > 0 && (
                    <div className="ml-4 mr-1 border-l-2 border-indigo-200 bg-white rounded-b-xl overflow-hidden shadow-inner">
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {regions.map(r => (
                          <RegionRow
                            key={`${r.disease_code}-${r.region_id}`}
                            comparison={r}
                            dates={data.dates}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
