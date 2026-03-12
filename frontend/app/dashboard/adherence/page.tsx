'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import type { PaginatedResponse, AdherenceTracker, DoseSchedule } from '@/types';
import toast from 'react-hot-toast';

/* ── helpers ── */
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

type DoseEx = DoseSchedule & { medicine_name?: string };

/* colour helpers */
function pctColor(p: number) {
  if (p >= 85) return '#059669';      // emerald-600
  if (p >= 70) return '#D97706';      // amber-600
  return '#DC2626';                    // red-600
}
function pctBg(p: number) {
  if (p >= 85) return 'rgba(5,150,105,0.08)';
  if (p >= 70) return 'rgba(217,119,6,0.08)';
  return 'rgba(220,38,38,0.08)';
}
function pctLabel(p: number) {
  if (p >= 85) return 'Good';
  if (p >= 70) return 'Fair';
  return 'Low';
}

/* ── Adherence ring (SVG) ── */
function AdherenceRing({ pct, size = 100 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const col = pctColor(pct);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8EDED" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={col} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color: col, lineHeight: 1 }}>
          {Math.round(pct)}%
        </span>
        <span style={{ fontSize: 10, color: '#6B7C7C', marginTop: 2 }}>{pctLabel(pct)}</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
function AdherencePage(): React.JSX.Element {
  const qc = useQueryClient();

  const { data: trackersData, isLoading } = useQuery<PaginatedResponse<AdherenceTracker>>({
    queryKey: ['adherence-trackers'],
    queryFn: () => api.adherence.getTrackers({ limit: 20 }),
  });
  const { data: upcomingDoses } = useQuery<DoseEx[]>({
    queryKey: ['upcoming-doses'],
    queryFn: () => api.adherence.getUpcomingDoses(),
  });
  const { data: missedDoses } = useQuery<DoseEx[]>({
    queryKey: ['missed-doses'],
    queryFn: () => api.adherence.getMissedDoses(),
  });

  const markTaken = useMutation({
    mutationFn: (data: { dose_schedule_id: string }) => api.adherence.markDoseTaken(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adherence-trackers'] });
      qc.invalidateQueries({ queryKey: ['upcoming-doses'] });
      qc.invalidateQueries({ queryKey: ['missed-doses'] });
      toast.success('Dose marked as taken');
    },
    onError: () => toast.error('Failed to record dose'),
  });

  const trackers = trackersData?.results || [];
  const upcoming = upcomingDoses || [];
  const missed = missedDoses || [];

  /* ── loading skeleton ── */
  if (isLoading) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{
          background: 'linear-gradient(130deg, #0D2B29 0%, #1F6F6A 55%, #185E59 100%)',
          borderRadius: 18, padding: '32px 36px', marginBottom: 28,
        }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 }}>💊 Medication Adherence</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Loading…</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1px solid #E8EDED' }}>
              <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ height: 14, background: '#E8EDED', borderRadius: 6, width: '40%' }} />
                <div style={{ height: 10, background: '#E8EDED', borderRadius: 6, width: '60%' }} />
                <div style={{ height: 10, background: '#E8EDED', borderRadius: 6, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── active tracker for summary stats ── */
  const active = trackers.find(t => t.is_active);
  const overallPct = active
    ? (active.adherence_percentage ?? (active.expected_doses > 0 ? Math.round((active.actual_doses / active.expected_doses) * 100 * 10) / 10 : 0))
    : 0;
  const totalTaken = active?.actual_doses ?? 0;
  const totalMissed = active ? (active.expected_doses - active.actual_doses) : 0;
  const totalExpected = active?.expected_doses ?? 0;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ═══ HERO BANNER ═══ */}
      <div style={{
        background: 'linear-gradient(130deg, #0D2B29 0%, #1F6F6A 55%, #185E59 100%)',
        borderRadius: 18, padding: '32px 36px', marginBottom: 28,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 60, opacity: 0.07, pointerEvents: 'none' }}
          viewBox="0 0 800 60" preserveAspectRatio="none">
          <path d="M0,30 L100,30 L115,10 L130,50 L145,10 L160,30 L400,30 L415,12 L430,48 L445,12 L460,30 L800,30"
            stroke="#4ade80" strokeWidth="2" fill="none" />
        </svg>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>💊 Medication Adherence</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
              Track your medication schedule and compliance
            </p>
          </div>
          {active && (
            <AdherenceRing pct={overallPct} size={96} />
          )}
        </div>
      </div>

      {/* ═══ SUMMARY CARDS ═══ */}
      {active && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Doses Taken', value: totalTaken, icon: '✅', color: '#059669' },
            { label: 'Doses Missed', value: totalMissed, icon: '❌', color: '#DC2626' },
            { label: 'Total Due', value: totalExpected, icon: '📋', color: '#1F6F6A' },
            { label: 'Adherence', value: `${Math.round(overallPct)}%`, icon: '📊', color: pctColor(overallPct) },
          ].map((c, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 14, padding: '18px 20px',
              border: '1px solid #E8EDED',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: `${c.color}11`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>{c.icon}</div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: c.color, margin: 0, lineHeight: 1 }}>{c.value}</p>
                <p style={{ fontSize: 11, color: '#6B7C7C', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ UPCOMING & MISSED DOSES ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Upcoming Doses */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8EDED', overflow: 'hidden' }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg, #1F6F6A, #4ade80)' }} />
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(31,111,106,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⏰</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B2B', margin: 0 }}>Upcoming Doses</h2>
              {upcoming.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(31,111,106,0.08)', color: '#1F6F6A', padding: '2px 8px', borderRadius: 10 }}>{upcoming.length}</span>
              )}
            </div>

            {upcoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <span style={{ fontSize: 32 }}>✅</span>
                <p style={{ fontSize: 14, color: '#6B7C7C', marginTop: 8 }}>No upcoming doses in the next 24 hours</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                {upcoming.slice(0, 10).map((dose) => (
                  <div key={dose.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(31,111,106,0.04)', border: '1px solid rgba(31,111,106,0.08)',
                  }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B2B', margin: 0 }}>
                        {dose.medicine_name || (typeof dose.medicine === 'object' ? (dose.medicine as any)?.name : '—')}
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7C7C', margin: '2px 0 0' }}>{fmtTime(dose.scheduled_time)}</p>
                    </div>
                    <button
                      onClick={() => markTaken.mutate({ dose_schedule_id: dose.id })}
                      disabled={markTaken.isPending}
                      style={{
                        padding: '6px 16px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg, #1F6F6A, #28857F)',
                        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        opacity: markTaken.isPending ? 0.6 : 1,
                      }}
                    >
                      ✓ Take
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Missed Doses */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8EDED', overflow: 'hidden' }}>
          <div style={{ height: 4, background: '#DC2626' }} />
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(220,38,38,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚠️</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B2B', margin: 0 }}>Missed Doses</h2>
              {missed.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(220,38,38,0.06)', color: '#DC2626', padding: '2px 8px', borderRadius: 10 }}>{missed.length}</span>
              )}
            </div>

            {missed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <span style={{ fontSize: 32 }}>🎉</span>
                <p style={{ fontSize: 14, color: '#059669', fontWeight: 600, marginTop: 8 }}>No missed doses — great job!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                {missed.slice(0, 10).map((dose) => (
                  <div key={dose.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.08)',
                  }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B2B', margin: 0 }}>
                        {dose.medicine_name || (typeof dose.medicine === 'object' ? (dose.medicine as any)?.name : '—')}
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7C7C', margin: '2px 0 0' }}>
                        {fmtDate(dose.scheduled_time)} at {fmtTime(dose.scheduled_time)}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      padding: '4px 12px', borderRadius: 20,
                      background: 'rgba(220,38,38,0.08)', color: '#DC2626',
                      letterSpacing: '0.04em',
                    }}>Missed</span>
                  </div>
                ))}
                {missed.length > 10 && (
                  <p style={{ fontSize: 12, color: '#6B7C7C', textAlign: 'center', margin: '4px 0 0' }}>
                    +{missed.length - 10} more missed doses
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ ADHERENCE TRACKERS ═══ */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A2B2B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📈</span> Adherence Trackers
        </h2>

        {trackers.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '48px 24px',
            textAlign: 'center', border: '1px solid #E8EDED',
          }}>
            <span style={{ fontSize: 48 }}>💊</span>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#2F3A3A', marginTop: 12 }}>No adherence trackers</p>
            <p style={{ fontSize: 14, color: '#6B7C7C', marginTop: 4 }}>Trackers are created automatically when your prescriptions are dispensed.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {trackers.map((t) => {
              const pct = t.adherence_percentage ?? (t.expected_doses > 0 ? Math.round((t.actual_doses / t.expected_doses) * 100 * 10) / 10 : 0);
              const col = pctColor(pct);
              const taken = t.actual_doses;
              const missed_count = t.expected_doses - t.actual_doses;
              const expected = t.expected_doses;

              return (
                <div key={t.id} style={{
                  background: '#fff', borderRadius: 16, overflow: 'hidden',
                  border: '1px solid #E8EDED',
                  transition: 'box-shadow 0.2s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(31,111,106,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Accent bar */}
                  <div style={{ height: 4, background: t.is_active ? 'linear-gradient(90deg, #1F6F6A, #4ade80)' : '#CBD5D5' }} />

                  <div style={{ padding: '20px 24px' }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 12,
                          background: t.is_active ? 'rgba(31,111,106,0.08)' : '#F3F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        }}>
                          {t.is_active ? '💚' : '📋'}
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B2B', margin: 0 }}>
                            {t.is_active ? 'Active Tracker' : 'Past Tracker'}
                          </p>
                          <p style={{ fontSize: 12, color: '#6B7C7C', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📅 {fmtDate(t.start_date)} – {fmtDate(t.end_date)}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 28, fontWeight: 800, color: col, margin: 0, lineHeight: 1 }}>
                            {Math.round(pct * 10) / 10}%
                          </p>
                          <span style={{
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            padding: '3px 10px', borderRadius: 20,
                            background: pctBg(pct), color: col,
                            letterSpacing: '0.04em',
                          }}>{pctLabel(pct)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ position: 'relative', height: 10, borderRadius: 8, background: '#E8EDED', marginBottom: 14, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 8,
                        width: `${Math.min(pct, 100)}%`,
                        background: `linear-gradient(90deg, ${col}, ${col}cc)`,
                        transition: 'width 1s ease',
                      }} />
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 13, color: '#2F3A3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color: '#059669', fontSize: 14 }}>✓</span>
                        <strong>{taken}</strong> taken
                      </span>
                      <span style={{ fontSize: 13, color: '#2F3A3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color: '#DC2626', fontSize: 14 }}>✗</span>
                        <strong>{missed_count}</strong> missed
                      </span>
                      <span style={{ fontSize: 13, color: '#2F3A3A', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color: '#1F6F6A', fontSize: 14 }}>↗</span>
                        <strong>{expected}</strong> expected
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(AdherencePage, ['patient']);
