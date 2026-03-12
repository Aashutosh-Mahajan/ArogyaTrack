'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import type { TranslationKey } from '@/lib/translations';

/* ─── SVG Icons (20px stroke) ─── */
const icons: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  ),
  card: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" />
    </svg>
  ),
  profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  ),
  records: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
  ),
  conditions: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l3-9 4 18 3-9h5" />
    </svg>
  ),
  prescriptions: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6v4H9z" /><rect x="4" y="4" width="16" height="18" rx="2" /><path d="M9 14h6" /><path d="M12 11v6" />
    </svg>
  ),
  medicines: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" />
    </svg>
  ),
  adherence: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
    </svg>
  ),
  alerts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  downloads: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
    </svg>
  ),
  logout: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
    </svg>
  ),
  patients: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  qr: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3" /><path d="M18 14h3v3" /><path d="M14 18h3v3" /><path d="M18 18h3v3" />
    </svg>
  ),
  risk: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  ),
  add: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15h6" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" />
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  surveillance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
    </svg>
  ),
  cluster: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="19" r="2" /><path d="M14.5 9.5 17 7" /><path d="M9.5 9.5 7 7" /><path d="M14.5 14.5 17 17" /><path d="M9.5 14.5 7 17" />
    </svg>
  ),
  forecast: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  scan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" />
    </svg>
  ),
  dispense: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" />
    </svg>
  ),
  history: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
    </svg>
  ),
  inventory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  ),
};

/* ─── Nav Item Type ─── */
interface NavItem {
  icon: string;
  label: string | TranslationKey;
  isTranslationKey?: boolean;
  href: string;
  badge?: number;
}

/* ─── Role-Based Navigation Configs ─── */
const patientNav: NavItem[] = [
  { icon: 'dashboard', label: 'sidebar_dashboard', isTranslationKey: true, href: '/dashboard' },
  { icon: 'card', label: 'sidebar_patient_card', isTranslationKey: true, href: '/dashboard/patient-card' },
  { icon: 'profile', label: 'sidebar_profile', isTranslationKey: true, href: '/dashboard/profile' },
  { icon: 'records', label: 'sidebar_medical_records', isTranslationKey: true, href: '/dashboard/medical-records' },
  { icon: 'medicines', label: 'sidebar_medicines', isTranslationKey: true, href: '/dashboard/medicines' },
  { icon: 'adherence', label: 'sidebar_adherence', isTranslationKey: true, href: '/dashboard/adherence' },
  { icon: 'alerts', label: 'sidebar_alerts', isTranslationKey: true, href: '/dashboard/alerts', badge: 3 },
  { icon: 'shield', label: 'sidebar_security', isTranslationKey: true, href: '/dashboard/security' },
];

const doctorNav: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', href: '/doctor/dashboard' },
  { icon: 'patients', label: 'My Patients', href: '/doctor/patients' },
  { icon: 'qr', label: 'Scan QR', href: '/doctor/scan-qr' },
  { icon: 'risk', label: 'High-Risk', href: '/doctor/high-risk' },
  { icon: 'add', label: 'Add Record', href: '/doctor/add-record' },
  { icon: 'shield', label: 'Security', href: '/doctor/security' },
];

const adminNav: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', href: '/admin' },
  { icon: 'alerts', label: 'Alerts', href: '/admin/alerts' },
  { icon: 'analytics', label: 'Analytics', href: '/admin/analytics' },
  { icon: 'surveillance', label: 'Surveillance', href: '/admin/surveillance' },
  { icon: 'cluster', label: 'Clusters', href: '/admin/clusters' },
  { icon: 'forecast', label: 'Forecasts', href: '/admin/forecasts' },
];

const pharmacyNav: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', href: '/pharmacy' },
  { icon: 'scan', label: 'Scan', href: '/pharmacy/scan' },
  { icon: 'dispense', label: 'Dispense', href: '/pharmacy/dispense/patient' },
  { icon: 'history', label: 'History', href: '/pharmacy/history' },
  { icon: 'inventory', label: 'Inventory', href: '/pharmacy/inventory' },
];

/* ─── Detect role label ─── */
function getRoleInfo(pathname: string): { nav: NavItem[]; roleLabel: string } {
  if (pathname.startsWith('/doctor')) return { nav: doctorNav, roleLabel: 'Doctor Access' };
  if (pathname.startsWith('/admin')) return { nav: adminNav, roleLabel: 'Admin Access' };
  if (pathname.startsWith('/pharmacy')) return { nav: pharmacyNav, roleLabel: 'Pharmacist Access' };
  return { nav: patientNav, roleLabel: 'Patient Access' };
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuthStore();

  const { nav, roleLabel } = getRoleInfo(pathname || '');

  const userName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : 'User';
  const userInitials = user?.first_name
    ? `${user.first_name[0]}${user.last_name ? user.last_name[0] : ''}`.toUpperCase()
    : 'U';

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/admin' || href === '/pharmacy') {
      return pathname === href;
    }
    if (href === '/doctor/dashboard') {
      return pathname === '/doctor/dashboard' || pathname === '/doctor';
    }
    return pathname?.startsWith(href) || false;
  };

  const handleLogout = async () => {
    try { await api.auth.logout(); } catch { /* ignore */ }
    localStorage.removeItem('auth-storage');
    router.push('/login');
  };

  const getLabel = (item: NavItem) => {
    if (item.isTranslationKey) return t(item.label as TranslationKey);
    return item.label;
  };

  return (
    <aside style={{
      width: 290,
      minWidth: 290,
      height: '100vh',
      background: '#081c19',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 50,
      overflow: 'hidden',
    }}>
      {/* ── Ambient glows ── */}
      <div style={{
        position: 'absolute', width: 300, height: 300,
        top: -100, left: -80, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(31,111,106,0.15) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200,
        bottom: -60, right: -60, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 70%)',
      }} />

      {/* ── Logo ── */}
      <Link href="/" style={{ padding: '28px 26px 22px', display: 'flex', alignItems: 'center', gap: 13, position: 'relative', textDecoration: 'none' }}>
        <div style={{
          width: 57, height: 57, borderRadius: 18,
          background: 'linear-gradient(135deg, #22856e 0%, #1a6b5a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(31,111,106,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}>
          <svg width="29" height="29" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h3l3-9 4 18 3-9h5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div style={{
            color: '#fff', fontSize: 23, fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1.1,
            fontFamily: 'Syne, Plus Jakarta Sans, sans-serif',
          }}>
            {t('health_system')}
          </div>
          <div style={{ color: '#4ade80', fontSize: 12, letterSpacing: '0.16em', fontWeight: 700, marginTop: 4, opacity: 0.7 }}>
            GOVT. OF INDIA
          </div>
        </div>
      </Link>

      {/* ── Separator ── */}
      <div style={{ margin: '0 22px', height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Section Label ── */}
      <div style={{ padding: '10px 28px 8px', position: 'relative' }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.18em' }}>
          NAVIGATION
        </span>
      </div>

      {/* ── Nav Items ── */}
      <nav style={{ flex: 1, padding: '0 14px', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '11px 16px', marginBottom: 3, borderRadius: 12,
                cursor: 'pointer', transition: 'all 0.2s ease', textDecoration: 'none',
                fontSize: 15, fontWeight: active ? 600 : 450,
                color: active ? '#ffffff' : 'rgba(255,255,255,0.9)',
                background: active
                  ? 'linear-gradient(135deg, rgba(31,111,106,0.55) 0%, rgba(34,133,110,0.35) 100%)'
                  : 'transparent',
                boxShadow: active
                  ? '0 4px 16px rgba(31,111,106,0.2), inset 0 1px 0 rgba(255,255,255,0.06)'
                  : 'none',
                borderLeft: '3px solid transparent',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                }
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 22, flexShrink: 0, opacity: active ? 1 : 0.8, transition: 'opacity 0.2s',
              }}>
                {icons[item.icon]}
              </span>
              <span style={{ flex: 1, lineHeight: 1 }}>{getLabel(item)}</span>
              {item.badge && (
                <span style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff', borderRadius: 999, minWidth: 22, height: 22,
                  fontSize: 10.5, fontWeight: 700, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Separator ── */}
      <div style={{ margin: '0 22px', height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Logout ── */}
      <div style={{ padding: '12px 14px 24px', position: 'relative' }}>
        <div
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
            color: '#ffffff', fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
            borderLeft: '3px solid transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span style={{ display: 'flex', width: 22, justifyContent: 'center', opacity: 1 }}>{icons.logout}</span>
          <span>{t('sidebar_logout')}</span>
        </div>
      </div>
    </aside>
  );
}
