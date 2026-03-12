'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { TranslationKey } from '@/lib/translations';
import {
  ComposedChart, AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { RecentRecord, RecentRecordAttachment, HealthTrendsResponse, DashboardKPIs, DashboardSummary, ChronicCondition } from '@/types';
import Link from 'next/link';

/* ─── helpers ─── */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function buildStatCards(kpi?: DashboardKPIs) {
  const bpTrend = kpi?.monthly_trends?.medical_records;
  const rxTrend = kpi?.monthly_trends?.prescriptions;
  const dlTrend = kpi?.monthly_trends?.downloads;

  const fmtTrend = (t?: { change: number; direction: string }) => {
    if (!t || t.change === 0) return { trend: '—', dir: 'neutral' };
    const sign = t.direction === 'up' ? '+' : '-';
    return { trend: `${sign}${Math.abs(t.change)}`, dir: t.direction };
  };

  const bpVal = kpi?.recent_bp?.value != null
    ? `${Math.round(kpi.recent_bp.value)}/${Math.round(kpi.recent_bp.secondary_value ?? 0)}`
    : '—/—';
  const sugarVal = kpi?.recent_sugar?.value != null
    ? `${Math.round(kpi.recent_sugar.value)}`
    : '—';

  const bpDate = kpi?.recent_bp?.recorded_at
    ? new Date(kpi.recent_bp.recorded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';
  const sugarDate = kpi?.recent_sugar?.recorded_at
    ? new Date(kpi.recent_sugar.recorded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  return [
    { labelKey: 'kpi_medical_records' as TranslationKey, value: kpi?.total_medical_records ?? 0, ...fmtTrend(bpTrend), accent: '#1F6F6A', customLabel: 'Medical Records' },
    { labelKey: 'kpi_active_prescriptions' as TranslationKey, value: kpi?.active_prescriptions ?? 0, ...fmtTrend(rxTrend), accent: '#7c3aed', href: '/dashboard/prescriptions', customLabel: 'Active Prescriptions' },
    { labelKey: 'kpi_medical_records' as TranslationKey, value: bpVal, trend: bpDate, dir: 'neutral' as string, accent: '#ef4444', customLabel: 'Recent BP (mmHg)' },
    { labelKey: 'kpi_medical_records' as TranslationKey, value: <>{sugarVal} <sub style={{ fontSize: '0.55em', color: '#9CA3AF' }}>mg/dL</sub></>, trend: sugarDate, dir: 'neutral' as string, accent: '#f59e0b', customLabel: 'Blood Sugar' },
    { labelKey: 'kpi_pending_labs' as TranslationKey, value: kpi?.total_medical_records ?? 0, ...fmtTrend(bpTrend), accent: '#d97706', href: '/dashboard/lab-reports', customLabel: 'Pending Lab Reports' },
    { labelKey: 'kpi_downloads' as TranslationKey, value: kpi?.total_downloads ?? 0, ...fmtTrend(dlTrend), accent: '#185E59', href: '/dashboard/downloads', customLabel: 'Report Downloads' },
  ];
}

/* ─── Animated counter hook ─── */
function useCounter(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

/* ─── Health Score Ring ─── */
function HealthScoreRing({ score: targetScore }: { score: number }) {
  const score = useCounter(targetScore, 1400);
  const r = 46;
  const circ = 2 * Math.PI * r; // ≈289.03
  const offset = circ - (score / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 128, height: 128 }}>
      <svg width={128} height={128} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1F6F6A" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        <circle cx={64} cy={64} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={9} />
        <circle
          cx={64} cy={64} r={r} fill="none"
          stroke="url(#ringGrad)" strokeWidth={9}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'Syne, sans-serif' }}>
          {score}
        </span>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', marginTop: 3 }}>
          HEALTH SCORE
        </span>
      </div>
    </div>
  );
}

/* ─── Detail Section Helper ─── */
function DetailSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#2F3A3A', letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      <div style={{ paddingLeft: 28 }}>{children}</div>
    </div>
  );
}

/* ─── MAIN DASHBOARD ─── */
function PatientDashboard(): React.JSX.Element {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'bp' | 'sugar'>('bp');
  const [selectedRecord, setSelectedRecord] = useState<RecentRecord | null>(null);
  const [downloadingAttId, setDownloadingAttId] = useState<number | null>(null);

  const firstName = user?.first_name || 'User';

  const handleViewReport = async (attId: number, fileName: string) => {
    setDownloadingAttId(attId);
    try {
      const blob = await api.medical.downloadReport(attId, 'inline');
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch {
      // silent fail
    } finally {
      setDownloadingAttId(null);
    }
  };

  // Fetch dashboard summary (patient name, risk, adherence, health score)
  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.dashboard.getSummary(),
    staleTime: 30_000,
  });

  const { data: kpiData } = useQuery<DashboardKPIs>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.dashboard.getKPIs(),
    staleTime: 30_000,
  });

  const statCards = buildStatCards(kpiData);

  const { data: trendsData } = useQuery<HealthTrendsResponse>({
    queryKey: ['dashboard-health-trends'],
    queryFn: () => api.dashboard.getHealthTrends({ months: 24 }),
    staleTime: 60_000,
  });

  const { data: records } = useQuery<RecentRecord[]>({
    queryKey: ['dashboard-recent-records'],
    queryFn: () => api.dashboard.getRecentRecords({ limit: 12 }),
    staleTime: 10_000,
  });

  // Fetch chronic conditions
  const { data: conditions } = useQuery<ChronicCondition[]>({
    queryKey: ['patient-chronic-conditions'],
    queryFn: () => api.medical.getChronicConditions(),
    staleTime: 60_000,
  });

  // Derive values from API data
  const healthScore = summary?.calculated_risk_score != null
    ? Math.max(0, Math.min(100, 100 - summary.calculated_risk_score))
    : 100;
  const riskLevel = summary?.calculated_risk_level || 'Low';
  const adherencePercentage = summary?.adherence_percentage ?? 0;
  const activeConditions = conditions?.filter(c => c.is_active) || [];

  const riskColor = riskLevel === 'High' ? '#ef4444' : riskLevel === 'Medium' ? '#f59e0b' : '#4ade80';

  const bpSeries = trendsData?.trends.find(t => t.metric === 'blood_pressure');
  const sugarSeries = trendsData?.trends.find(t => t.metric === 'sugar');

  // Only show readings that fall on doctor visit dates (last 6 visits)
  const visitDates = new Set(
    (records ?? [])
      .map(r => r.visit_date?.split('T')[0])
      .filter(Boolean)
      .sort()
      .slice(-6)
  );

  const bpData = (bpSeries?.data ?? [])
    .filter(p => visitDates.has(p.date))
    .map(p => ({ date: fmtDate(p.date), systolic: p.value, diastolic: p.secondary_value ?? 0 }));
  const sugarData = (sugarSeries?.data ?? [])
    .filter(p => visitDates.has(p.date))
    .map(p => ({ date: fmtDate(p.date), value: p.value }));

  return (
    <>
      {/* ═══ SECTION 1 — HERO BANNER ═══ */}
      <section className="f1" style={{
        background: 'linear-gradient(130deg, #0D2B29 0%, #1F6F6A 55%, #185E59 100%)',
        borderRadius: 22, padding: '36px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden', minHeight: 220,
        gap: 40,
      }}>
        {/* Decorations */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 80, opacity: 0.07, pointerEvents: 'none' }}
          viewBox="0 0 800 80" preserveAspectRatio="none">
          <path d="M0,50 L70,50 L85,15 L100,72 L115,15 L130,50 L280,50 L295,28 L310,68 L325,28 L340,50 L500,50 L515,18 L530,75 L545,18 L560,50 L800,50"
            stroke="#4ade80" strokeWidth="2" fill="none" />
        </svg>
        <div style={{
          position: 'absolute', right: 180, top: -100,
          width: 350, height: 350, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)',
        }} />

        {/* Left content */}
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.25)',
            borderRadius: 999, padding: '4px 14px',
            fontSize: 11, color: '#4ade80', fontWeight: 600, letterSpacing: '0.03em',
            marginBottom: 16,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#4ade80',
              animation: 'pulse-dot 2.2s infinite', display: 'inline-block',
              boxShadow: '0 0 8px rgba(74,222,128,0.5)',
            }} />
            {summary?.health_id ? `National Health ID: ${summary.health_id}` : 'Health Surveillance Active'}
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', color: '#fff',
            fontSize: 36, lineHeight: 1.15, marginBottom: 12, letterSpacing: '-0.02em',
          }}>
            {t('welcome_back')},<br />{summary?.patient_name || firstName}
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: 13.5, lineHeight: 1.7,
            maxWidth: 360,
          }}>
            Health surveillance active in{' '}
            <strong style={{ color: '#4ade80' }}>real-time</strong>.
            {' '}System status:{' '}
            <strong style={{ color: '#4ade80' }}>Nominal</strong>
          </p>
        </div>

        {/* Right content */}
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          gap: 44, flexShrink: 0,
        }}>
          <HealthScoreRing score={healthScore} />

          {/* Stats column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Risk Level */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', marginBottom: 5, fontWeight: 600 }}>RISK LEVEL</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor, boxShadow: `0 0 8px ${riskColor}80` }} />
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{riskLevel}</span>
              </div>
            </div>
            {/* Adherence */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', marginBottom: 5, fontWeight: 600 }}>ADHERENCE</div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{adherencePercentage}%</span>
              <div style={{ width: 72, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, marginTop: 6 }}>
                <div style={{ width: `${Math.min(adherencePercentage, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #1F6F6A, #4ade80)', borderRadius: 99, boxShadow: '0 0 6px rgba(74,222,128,0.3)' }} />
              </div>
            </div>
            {/* Conditions */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', marginBottom: 5, fontWeight: 600 }}>CONDITIONS</div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{activeConditions.length} Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2 — STAT CARDS ═══ */}
      <div className="f2 stat-grid">
        {statCards.map((card, i) => {
          const inner = (
            <>
              <div className="label" style={{ color: card.accent }}>{'customLabel' in card && card.customLabel ? card.customLabel : t(card.labelKey)}</div>
              <div className="number">{card.value}</div>
              {'href' in card && card.href && (
                <span className="card-link-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17l9.2-9.2M17 17V7H7" />
                  </svg>
                </span>
              )}
            </>
          );
          return ('href' in card && card.href) ? (
            <Link key={i} href={card.href} className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
              {inner}
            </Link>
          ) : (
            <div key={i} className="stat-card">
              {inner}
            </div>
          );
        })}
      </div>

      {/* ═══ SECTION 3 — CHARTS ═══ */}
      <div className="f3" style={{ display: 'flex', gap: 20 }}>

        {/* Blood Pressure */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '24px 28px',
          boxShadow: '0 2px 10px rgba(47,58,58,0.06)',
          flex: 1, minWidth: 0,
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Syne, DM Sans, sans-serif', fontWeight: 800, color: '#2F3A3A', fontSize: 20 }}>
              Blood Pressure
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B7C7C', fontSize: 12, marginTop: 3, fontWeight: 500 }}>
              Last 6 months
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#6B7C7C' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 4, background: '#1F6F6A', borderRadius: 2 }} /> Systolic
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 4, background: '#4ade80', borderRadius: 2 }} /> Diastolic
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={bpData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1F6F6A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1F6F6A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F2" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7C7C', fontWeight: 500 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis domain={[60, 170]} tick={{ fontSize: 12, fill: '#6B7C7C', fontWeight: 500 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E8EDED', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }} />
              <Area type="monotone" dataKey="systolic" stroke="#1F6F6A" strokeWidth={2} fill="url(#bpGrad)" dot={{ fill: '#1F6F6A', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
              <Line type="monotone" dataKey="diastolic" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Blood Sugar */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '24px 28px',
          boxShadow: '0 2px 10px rgba(47,58,58,0.06)',
          flex: 1, minWidth: 0,
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Syne, DM Sans, sans-serif', fontWeight: 800, color: '#2F3A3A', fontSize: 20 }}>
              Blood Sugar
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B7C7C', fontSize: 12, marginTop: 3, fontWeight: 500 }}>
              Last 6 months
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{
              background: 'rgba(31,111,106,0.08)', color: '#1F6F6A',
              fontSize: 12, fontWeight: 700,
              padding: '4px 12px', borderRadius: 999,
            }}>
              ↓ Improving trend
            </span>
            <span style={{ color: '#6B7C7C', fontSize: 13, fontWeight: 600 }}>mg/dL</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sugarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1F6F6A" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#1F6F6A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F2" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7C7C', fontWeight: 500 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#6B7C7C', fontWeight: 500 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E8EDED', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }} />
              <Area type="monotone" dataKey="value" stroke="#185E59" strokeWidth={2} fill="url(#sgGrad)" dot={{ fill: '#185E59', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ SECTION 4 — RECENT MEDICAL RECORDS ═══ */}
      <section className="f4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h3l3-9 4 18 3-9h5" stroke="#1F6F6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, color: '#2F3A3A', fontSize: 15 }}>
                {t('recent_records_title')}
              </span>
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B7C7C', fontSize: 11, marginTop: 3 }}>
              {t('empty_records_desc')}
            </div>
          </div>
          <a href="/dashboard/medical-records" style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
            color: '#1F6F6A', textDecoration: 'none',
          }}>
            {t('view_all')} →
          </a>
        </div>

        <div className="content-card" style={{ padding: 0 }}>
          {records && records.length > 0 ? (
            records.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="record-item"
                style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => setSelectedRecord(record)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(31,111,106,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="record-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12h3l3-9 4 18 3-9h5" stroke="#1F6F6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="record-title">{record.diagnosis_summary}</div>
                  <div className="record-meta">
                    <span>Dr. {record.doctor_name}</span>
                    <span style={{ color: '#D9E5E3' }}>•</span>
                    <span>{new Date(record.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  {record.tests_performed && (
                    <div className="record-tags">
                      <span className="tag">{record.tests_performed.split('\n')[0].slice(0, 30)}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`badge ${record.status === 'completed' ? 'badge-completed' : record.status === 'critical' ? 'badge-alert' : 'badge-followup'}`}>
                    {record.status === 'completed' ? 'Completed' : record.status === 'critical' ? 'Critical' : 'Follow-up'}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6B7C7C', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              No medical records found yet.
            </div>
          )}
        </div>

        {/* ── Record Detail Modal ── */}
        {selectedRecord && (
          <div
            onClick={() => setSelectedRecord(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640,
                maxHeight: '85vh', overflowY: 'auto', position: 'relative',
                boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '24px 28px 16px', borderBottom: '1px solid #E2E8E7',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                position: 'sticky', top: 0, background: '#fff', borderRadius: '20px 20px 0 0', zIndex: 1,
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1F6F6A', letterSpacing: '0.14em', marginBottom: 6 }}>MEDICAL RECORD</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2F3A3A', margin: 0, lineHeight: 1.3 }}>
                    {selectedRecord.diagnosis_summary}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: '#6B7C7C' }}>
                    <span>Dr. {selectedRecord.doctor_name}</span>
                    <span>•</span>
                    <span>{selectedRecord.department}</span>
                    <span>•</span>
                    <span>{new Date(selectedRecord.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8E7',
                    background: '#fff', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7C7C" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 28px 28px' }}>
                {/* Status Badge */}
                <div style={{ marginBottom: 20 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600,
                    background: selectedRecord.status === 'completed' ? '#ecfdf5' : selectedRecord.status === 'critical' ? '#fef2f2' : '#fffbeb',
                    color: selectedRecord.status === 'completed' ? '#059669' : selectedRecord.status === 'critical' ? '#dc2626' : '#d97706',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: selectedRecord.status === 'completed' ? '#059669' : selectedRecord.status === 'critical' ? '#dc2626' : '#d97706',
                    }} />
                    {selectedRecord.status === 'completed' ? 'Completed' : selectedRecord.status === 'critical' ? 'Critical' : 'Follow-up Required'}
                  </span>
                </div>

                {/* Diagnosis */}
                <DetailSection icon="🩺" title="Diagnosis">
                  <p style={{ fontSize: 14, color: '#2F3A3A', lineHeight: 1.6, margin: 0 }}>
                    {selectedRecord.diagnosis_summary}
                  </p>
                </DetailSection>

                {/* Doctor Notes */}
                {selectedRecord.doctor_notes && (
                  <DetailSection icon="📝" title="Doctor's Notes">
                    <p style={{ fontSize: 13, color: '#4a5a5a', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {selectedRecord.doctor_notes}
                    </p>
                  </DetailSection>
                )}

                {/* Tests Performed */}
                {selectedRecord.tests_performed && (
                  <DetailSection icon="🔬" title="Tests Performed">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedRecord.tests_performed.split('\n').filter(Boolean).map((test: string, i: number) => (
                        <span key={i} style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                          background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                        }}>
                          {test.trim()}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Prescription */}
                {selectedRecord.prescription_text && (
                  <DetailSection icon="💊" title="Prescription">
                    <p style={{ fontSize: 13, color: '#4a5a5a', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {selectedRecord.prescription_text}
                    </p>
                    {selectedRecord.prescriptions_count > 0 && (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#1F6F6A', fontWeight: 600 }}>
                        {selectedRecord.prescriptions_count} prescription(s) linked
                      </div>
                    )}
                  </DetailSection>
                )}

                {/* Attachments */}
                {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                  <DetailSection icon="📎" title="Attachments">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedRecord.attachments.map((att: RecentRecordAttachment) => (
                        <button
                          key={att.id}
                          onClick={() => handleViewReport(att.id, att.file_name)}
                          disabled={downloadingAttId === att.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            borderRadius: 10, border: '1px solid #E2E8E7', textDecoration: 'none',
                            color: '#2F3A3A', transition: 'background 0.15s', background: 'transparent',
                            cursor: downloadingAttId === att.id ? 'wait' : 'pointer', width: '100%', textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafb'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F6F6A" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
                          </svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.file_name}
                            </div>
                            <div style={{ fontSize: 11, color: '#6B7C7C', marginTop: 2 }}>
                              {att.file_type} • {new Date(att.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          {downloadingAttId === att.id ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F6F6A" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F6F6A" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </DetailSection>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default withAuth(PatientDashboard, ['patient']);
