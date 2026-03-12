'use client';

import React from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { useAuthStore } from '@/store/authStore';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuthStore();

  const firstName = user?.first_name || '';
  const lastName = user?.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';
  const initials = [firstName, lastName].filter(Boolean).map(n => n[0]?.toUpperCase()).join('') || 'U';
  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';

  return (
    <header style={{
      background: 'linear-gradient(135deg, #1a6b5a 0%, #22856e 50%, #2a9d8f 100%)',
      padding: '0 28px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      borderBottom: 'none',
      flexShrink: 0,
      borderRadius: 14,
      margin: '12px 28px 0',
      boxShadow: '0 4px 16px rgba(31,111,106,0.25)',
    }}>
      {/* Breadcrumb / Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 24, color: '#ffffff', fontWeight: 800, letterSpacing: '-0.02em' }}>Dashboard</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Language */}
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as any)}
        style={{
          background: '#F5F8F7', border: '1px solid #E2E8E7', borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: '#2F3A3A',
          cursor: 'pointer', fontWeight: 500,
        }}
      >
        <option value="en">EN</option>
        <option value="hi">हिंदी</option>
        <option value="mr">मराठी</option>
      </select>

      {/* Notification bell */}
      <div style={{
        width: 34, height: 34, background: '#F5F8F7', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', border: '1px solid #E2E8E7',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7C7C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span style={{
          position: 'absolute', top: 5, right: 5,
          width: 7, height: 7, background: '#ef4444', borderRadius: '50%',
          border: '1.5px solid white',
        }} />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: '#E2E8E7' }} />

      {/* User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg, #1F6F6A, #185E59)',
          color: '#fff', fontWeight: 700, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          letterSpacing: '0.02em',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0d3b2e', lineHeight: 1.2 }}>
            {fullName}
          </div>
          <div style={{ fontSize: 10, color: '#ffffff', fontWeight: 500, lineHeight: 1.2 }}>
            {role}
          </div>
        </div>
      </div>
    </header>
  );
}
