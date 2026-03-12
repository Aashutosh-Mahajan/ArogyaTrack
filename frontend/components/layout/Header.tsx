'use client';

import React from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { useAuthStore } from '@/store/authStore';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuthStore();

  const userName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : 'User';
  const userInitials = user?.first_name
    ? `${user.first_name[0]}${user.last_name ? user.last_name[0] : ''}`.toUpperCase()
    : 'U';
  const userRole = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'User';

  return (
    <header style={{
      background: '#FFFFFF',
      padding: '0 28px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      borderBottom: '1px solid #E2E8E7',
      flexShrink: 0,
    }}>
      {/* Breadcrumb / Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#6B7C7C', fontWeight: 500 }}>Pages</span>
        <span style={{ color: '#D9E5E3', fontSize: 12 }}>/</span>
        <span style={{ fontSize: 13, color: '#2F3A3A', fontWeight: 600 }}>Dashboard</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{
        width: 280,
        background: '#F5F8F7',
        borderRadius: 10,
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid #E2E8E7',
        transition: 'border-color 0.2s',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search…"
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: 12.5, color: '#2F3A3A', width: '100%',
            fontWeight: 400,
          }}
        />
      </div>

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
          {userInitials}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: '#2F3A3A', lineHeight: 1.2 }}>
            {userName}
          </div>
          <div style={{ fontSize: 10, color: '#94A3A3', fontWeight: 500, lineHeight: 1.2 }}>
            {userRole}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3A3" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </header>
  );
}
