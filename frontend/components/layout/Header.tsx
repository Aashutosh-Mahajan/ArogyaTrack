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
      background: 'linear-gradient(135deg, #151109 0%, #2b241c 50%, #4a8a6f 100%)',
      padding: '0 28px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      borderBottom: 'none',
      flexShrink: 0,
      borderRadius: 14,
      margin: '12px 28px 0',
      boxShadow: '0 4px 16px rgba(21,17,9,0.3)',
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
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: '#ffffff',
          cursor: 'pointer', fontWeight: 700,
        }}
      >
        <option value="en" style={{ color: '#1c1712' }}>EN</option>
        <option value="hi" style={{ color: '#1c1712' }}>हिंदी</option>
        <option value="mr" style={{ color: '#1c1712' }}>मराठी</option>
      </select>

      {/* Notification bell */}
      <div style={{
        width: 34, height: 34, background: 'rgba(255,255,255,0.1)', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', border: '1px solid rgba(255,255,255,0.15)',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7a756b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)' }} />

      {/* User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg, #1a5c52, #1a5c52)',
          color: '#fff', fontWeight: 700, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          letterSpacing: '0.02em',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#ffffff', lineHeight: 1.2 }}>
            {fullName}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 500, lineHeight: 1.2 }}>
            {role}
          </div>
        </div>
      </div>
    </header>
  );
}
