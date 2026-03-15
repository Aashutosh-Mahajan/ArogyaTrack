'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import type { Medicine } from '@/types';

function MedicinesPage(): React.JSX.Element {
  const [search, setSearch] = useState('');

  const { data: medicines, isLoading } = useQuery<Medicine[]>({
    queryKey: ['medicines', search],
    queryFn: () => api.prescriptions.getMedicines({ search: search || undefined }),
  });

  const list = medicines || [];

  if (isLoading) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(130deg, #0D2B29 0%, #1F6F6A 55%, #185E59 100%)',
          borderRadius: 18, padding: '32px 36px', marginBottom: 28,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>💊 Medicine Catalogue</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Loading medicines…</p>
        </div>
        {/* Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #E8EDED' }}>
              <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ height: 16, background: '#E8EDED', borderRadius: 6, width: '60%' }} />
                <div style={{ height: 12, background: '#E8EDED', borderRadius: 6, width: '40%' }} />
                <div style={{ height: 12, background: '#E8EDED', borderRadius: 6, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ═══ HEADER BANNER ═══ */}
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
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>💊 Medicine Catalogue</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
              {list.length} medicine{list.length !== 1 ? 's' : ''} available
            </p>
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search medicines…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: 280, padding: '10px 14px 10px 40px',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)', color: '#fff',
                fontSize: 14, outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* ═══ EMPTY STATE ═══ */}
      {list.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '60px 24px',
          textAlign: 'center', border: '1px solid #E8EDED',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💊</div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#2F3A3A' }}>No medicines found</p>
          {search && <p style={{ fontSize: 14, color: '#6B7C7C', marginTop: 6 }}>Try a different search term.</p>}
        </div>
      ) : (
        /* ═══ MEDICINE GRID ═══ */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {list.map((med) => (
            <div key={med.id} style={{
              background: '#fff', borderRadius: 16, padding: 0,
              border: '1px solid #E8EDED', overflow: 'hidden',
              transition: 'box-shadow 0.2s, transform 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(31,111,106,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >

              <div style={{ padding: '20px 24px' }}>
                {/* Name + status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: med.is_active ? 'rgba(31,111,106,0.08)' : '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 18 }}>💊</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B2B', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.name}</h3>
                      {med.generic_name && (
                        <p style={{ fontSize: 12, color: '#6B7C7C', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.generic_name}</p>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                    padding: '4px 10px', borderRadius: 20, flexShrink: 0,
                    background: med.is_active ? 'rgba(31,111,106,0.1)' : '#F3F4F6',
                    color: med.is_active ? '#1F6F6A' : '#9CA3AF',
                  }}>
                    {med.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Info rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {med.drug_class && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', minWidth: 70, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Class</span>
                      <span style={{ fontSize: 13, color: '#2F3A3A', fontWeight: 500 }}>{med.drug_class}</span>
                    </div>
                  )}
                  {med.therapeutic_category && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', minWidth: 70, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</span>
                      <span style={{ fontSize: 13, color: '#2F3A3A', fontWeight: 500 }}>{med.therapeutic_category}</span>
                    </div>
                  )}
                </div>

                {/* Allergens */}
                {med.allergens && med.allergens.length > 0 && (
                  <div style={{
                    background: '#FFF7ED', border: '1px solid #FED7AA',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 14 }}>⚠️</span>
                    <span style={{ fontSize: 12, color: '#9A3412', fontWeight: 600 }}>Allergens:</span>
                    <span style={{ fontSize: 12, color: '#C2410C' }}>{med.allergens.join(', ')}</span>
                  </div>
                )}

                {/* Dosages */}
                {med.standard_dosages && Object.keys(med.standard_dosages).length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Standard Dosages</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(med.standard_dosages).map(([key, val]) => (
                        <span key={key} style={{
                          fontSize: 12, fontWeight: 600,
                          padding: '4px 10px', borderRadius: 8,
                          background: 'rgba(31,111,106,0.06)',
                          color: '#1F6F6A', border: '1px solid rgba(31,111,106,0.12)',
                        }}>
                          {key}: {val}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default withAuth(MedicinesPage, ['patient']);
