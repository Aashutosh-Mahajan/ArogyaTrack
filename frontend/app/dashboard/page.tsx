'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { TranslationKey } from '@/lib/translations';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { RecentRecord, RecentRecordAttachment } from '@/types';

/* ─── Data ─── */
const bpData = [
  { day: 'Mon', systolic: 128, diastolic: 82 },
  { day: 'Tue', systolic: 132, diastolic: 85 },
  { day: 'Wed', systolic: 126, diastolic: 80 },
  { day: 'Thu', systolic: 134, diastolic: 84 },
  { day: 'Fri', systolic: 130, diastolic: 83 },
  { day: 'Sat', systolic: 127, diastolic: 81 },
  { day: 'Sun', systolic: 124, diastolic: 79 },
];
const sugarData = [
  { day: 'Mon', value: 132 },
  { day: 'Tue', value: 128 },
  { day: 'Wed', value: 126 },
  { day: 'Thu', value: 130 },
  { day: 'Fri', value: 122 },
  { day: 'Sat', value: 118 },
  { day: 'Sun', value: 115 },
];

const statCards: { icon: string; labelKey: TranslationKey; value: number | string; trend: string; dir: string; accent: string }[] = [
  { icon: '📁', labelKey: 'kpi_medical_records', value: 12, trend: '+9%', dir: 'up', accent: '#1F6F6A' },
  { icon: '💊', labelKey: 'kpi_active_prescriptions', value: 2, trend: '+8%', dir: 'up', accent: '#7c3aed' },
  { icon: '🧪', labelKey: 'kpi_pending_labs', value: 12, trend: '+1%', dir: 'up', accent: '#d97706' },
  { icon: '❤️', labelKey: 'kpi_adherence_rate', value: '84%', trend: '-12%', dir: 'down', accent: '#ef4444' },
  { icon: '⚠️', labelKey: 'kpi_health_alerts', value: 0, trend: '—', dir: 'neutral', accent: '#1F6F6A' },
  { icon: '⬇️', labelKey: 'kpi_downloads', value: 0, trend: '—', dir: 'neutral', accent: '#185E59' },
];

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
function HealthScoreRing() {
  const score = useCounter(100, 1400);
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

/* ─── Adherence Donut ─── */
function AdherenceDonut() {
  const r = 31;
  const circ = 2 * Math.PI * r; // ≈194.78
  const offset = circ * 0.16;

  return (
    <div style={{ position: 'relative', width: 82, height: 82 }}>
      <svg width={82} height={82} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={41} cy={41} r={r} fill="none" stroke="#D9E5E3" strokeWidth={8} />
        <circle
          cx={41} cy={41} r={r} fill="none"
          stroke="#1F6F6A" strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#2F3A3A' }}>84%</span>
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
  const [activeTab, setActiveTab] = useState<'bp' | 'sugar'>('bp');
  const [selectedRecord, setSelectedRecord] = useState<RecentRecord | null>(null);

  const { data: records } = useQuery<RecentRecord[]>({
    queryKey: ['dashboard-recent-records'],
    queryFn: () => api.dashboard.getRecentRecords({ limit: 5 }),
    staleTime: 10_000,
  });

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
            National Health ID: 48e53f17-b68
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', color: '#fff',
            fontSize: 36, lineHeight: 1.15, marginBottom: 12, letterSpacing: '-0.02em',
          }}>
            {t('welcome_back')},<br />Aditya
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
          <HealthScoreRing />

          {/* Stats column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Risk Level */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', marginBottom: 5, fontWeight: 600 }}>RISK LEVEL</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.5)' }} />
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{t('low')}</span>
              </div>
            </div>
            {/* Adherence */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', marginBottom: 5, fontWeight: 600 }}>ADHERENCE</div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>84%</span>
              <div style={{ width: 72, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, marginTop: 6 }}>
                <div style={{ width: '84%', height: '100%', background: 'linear-gradient(90deg, #1F6F6A, #4ade80)', borderRadius: 99, boxShadow: '0 0 6px rgba(74,222,128,0.3)' }} />
              </div>
            </div>
            {/* Conditions */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', marginBottom: 5, fontWeight: 600 }}>CONDITIONS</div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>3 Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2 — STAT CARDS ═══ */}
      <div className="f2 stat-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card">
            <div className="accent-bar" style={{ background: `linear-gradient(90deg, ${card.accent}, ${card.accent}66)` }} />
            <div style={{ fontSize: 18, marginBottom: 10 }}>{card.icon}</div>
            <div className="number">{card.value}</div>
            <div className="label">{t(card.labelKey)}</div>
            <div className={`trend trend-${card.dir}`}>
              {card.trend} <span style={{ color: '#6B7C7C', fontWeight: 400 }}>vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ SECTION 3 — CHARTS ROW ═══ */}
      <div className="f3" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>

        {/* Vitals Trend */}
        <div className="content-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, color: '#2F3A3A', fontSize: 14 }}>
                Vitals Trend
              </div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B7C7C', fontSize: 11, marginTop: 1 }}>
                Last 7 days
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`tab-btn ${activeTab === 'bp' ? 'active' : 'inactive'}`}
                onClick={() => setActiveTab('bp')}
              >
                Blood Pressure
              </button>
              <button
                className={`tab-btn ${activeTab === 'sugar' ? 'active' : 'inactive'}`}
                onClick={() => setActiveTab('sugar')}
              >
                Blood Sugar
              </button>
            </div>
          </div>

          {activeTab === 'bp' ? (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: '#6B7C7C' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 3, background: '#1F6F6A', borderRadius: 2 }} /> Systolic
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 3, background: '#4ade80', borderRadius: 2 }} /> Diastolic
                </span>
              </div>
              <ResponsiveContainer width="100%" height={165}>
                <AreaChart data={bpData}>
                  <defs>
                    <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1F6F6A" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1F6F6A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F2" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6B7C7C' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 150]} tick={{ fontSize: 10, fill: '#6B7C7C' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Area type="monotone" dataKey="systolic" stroke="#1F6F6A" strokeWidth={2.5} fill="url(#bpGrad)" dot={{ fill: '#1F6F6A', r: 3 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{
                  background: '#f0fdf4', color: '#1F6F6A',
                  fontSize: 10, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 999,
                }}>
                  ↓ Improving trend
                </span>
                <span style={{ color: '#6B7C7C', fontSize: 11 }}>mg/dL</span>
              </div>
              <ResponsiveContainer width="100%" height={165}>
                <AreaChart data={sugarData}>
                  <defs>
                    <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1F6F6A" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1F6F6A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F2" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6B7C7C' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[100, 145]} tick={{ fontSize: 10, fill: '#6B7C7C' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Area type="monotone" dataKey="value" stroke="#185E59" strokeWidth={2.5} fill="url(#sgGrad)" dot={{ fill: '#185E59', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Right column — Adherence + Conditions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Adherence Ring Card */}
          <div className="content-card" style={{ flex: 1 }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, color: '#2F3A3A', fontSize: 13, marginBottom: 1 }}>
              Medication Adherence
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#6B7C7C', fontSize: 11, marginBottom: 14 }}>
              This month
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <AdherenceDonut />
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#6B7C7C', marginBottom: 10 }}>
                  Medicines on time
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1F6F6A' }} />
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11.5, fontWeight: 600, color: '#2F3A3A' }}>Taken: 21 days</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D9E5E3' }} />
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11.5, color: '#6B7C7C' }}>Missed: 4 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Conditions Card */}
          <div style={{
            background: 'linear-gradient(135deg, #0D2B29, #1F6F6A 200%)',
            borderRadius: 18, padding: '18px 20px',
            boxShadow: '0 2px 10px rgba(13,43,41,0.15)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', right: -24, top: -24,
              width: 120, height: 120, borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%)',
            }} />
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.12em', marginBottom: 12, fontFamily: 'DM Sans, sans-serif',
            }}>
              ACTIVE CONDITIONS
            </div>
            {[
              { name: 'Type 2 Diabetes', color: '#f59e0b' },
              { name: 'Hypertension', color: '#ef4444' },
              { name: 'Dyslipidemia', color: '#4ade80' },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: c.color, boxShadow: `0 0 6px ${c.color}`,
                }} />
                <span style={{ color: '#fff', fontFamily: 'DM Sans, sans-serif', fontSize: 12.5, fontWeight: 500 }}>
                  {c.name}
                </span>
              </div>
            ))}
          </div>
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
                        <a
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            borderRadius: 10, border: '1px solid #E2E8E7', textDecoration: 'none',
                            color: '#2F3A3A', transition: 'background 0.15s',
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
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
                          </svg>
                        </a>
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
