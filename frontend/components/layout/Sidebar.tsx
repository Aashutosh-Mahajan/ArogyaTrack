'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import type { DashboardAlert } from '@/types';
import {
  FiHome,
  FiUser,
  FiActivity,
  FiFileText,
  FiShoppingBag,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiX,
  FiMapPin,
  FiAlertTriangle,
  FiCamera,
  FiUsers,
  FiTrendingUp,
  FiBell,
  FiShield,
  FiDownload,
  FiThermometer,
  FiBox,
  FiClipboard,
} from 'react-icons/fi';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { t } = useLanguage();

  // Fetch unread alert count for badge (patients only)
  const { data: alerts } = useQuery<DashboardAlert[]>({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.dashboard.getAlerts(),
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
    enabled: user?.role === 'patient',
  });
  const unreadAlertCount = alerts?.filter((a) => !a.is_read).length ?? 0;

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const patientLinks = [
    { href: '/dashboard', label: t('sidebar_dashboard'), icon: FiHome },
    { href: '/dashboard/patient-card', label: t('sidebar_patient_card'), icon: FiUser },
    { href: '/dashboard/profile', label: t('sidebar_profile'), icon: FiUser },
    { href: '/dashboard/medical-records', label: t('sidebar_medical_records'), icon: FiActivity },
    { href: '/dashboard/conditions', label: t('sidebar_conditions'), icon: FiThermometer },
    { href: '/dashboard/prescriptions', label: t('sidebar_prescriptions'), icon: FiFileText },
    { href: '/dashboard/medicines', label: t('sidebar_medicines'), icon: FiShoppingBag },
    { href: '/dashboard/adherence', label: t('sidebar_adherence'), icon: FiHeart },
    { href: '/dashboard/alerts', label: t('sidebar_alerts'), icon: FiBell, badge: unreadAlertCount },
    { href: '/dashboard/security', label: t('sidebar_security'), icon: FiShield },
  ];

  const doctorLinks = [
    { href: '/doctor/dashboard', label: 'Dashboard', icon: FiHome },
    { href: '/doctor/scan-qr', label: 'Scan Patient QR', icon: FiCamera },
    { href: '/doctor/patients', label: 'My Patients', icon: FiUsers },
    { href: '/doctor/add-record', label: 'Add / Update Record', icon: FiFileText },
    { href: '/doctor/high-risk', label: 'High-Risk Patients', icon: FiAlertTriangle },
    { href: '/doctor/security', label: 'Security', icon: FiShield },
  ];

  const adminLinks = [
    { href: '/admin', label: 'Dashboard', icon: FiHome },
    { href: '/admin/surveillance', label: 'Surveillance', icon: FiMapPin },
    { href: '/admin/analytics', label: 'Analytics', icon: FiTrendingUp },
    { href: '/admin/alerts', label: 'Alerts', icon: FiAlertTriangle },
    { href: '/admin/clusters', label: 'Clusters', icon: FiMapPin },
    { href: '/admin/forecasts', label: 'Forecasts', icon: FiActivity },
  ];

  const pharmacistLinks = [
    { href: '/pharmacy', label: t('sidebar_dashboard'), icon: FiHome },
    { href: '/pharmacy/scan', label: 'Scan Prescription', icon: FiCamera },
    { href: '/pharmacy/inventory', label: 'Manage Inventory', icon: FiBox },
    { href: '/pharmacy/history', label: 'Dispensing History', icon: FiClipboard },
  ];

  const links =
    user?.role === 'doctor' ? doctorLinks :
      user?.role === 'admin' || user?.role === 'authority' ? adminLinks :
        user?.role === 'pharmacist' ? pharmacistLinks :
          patientLinks;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-72 bg-teal-900 text-white shadow-2xl transition-transform duration-300 ease-out lg:translate-x-0 rounded-r-3xl border-r border-teal-800/50",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md border border-white/10">
                <FiActivity className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white">{t('health_system')}</h2>
                <p className="text-[10px] text-teal-300 uppercase tracking-widest leading-none">Govt. of India</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-teal-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 mb-2">
            <div className="p-4 rounded-2xl bg-teal-800/50 border border-teal-700/50 flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg text-white font-bold text-sm">
                {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-white">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-teal-300 capitalize font-medium">
                  {user?.role} Access
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-2">
            <div className="h-px bg-gradient-to-r from-transparent via-teal-700 to-transparent"></div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              const badge = 'badge' in link ? (link as any).badge : 0;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 group relative",
                    isActive
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/20"
                      : "text-teal-100 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-colors", isActive ? "text-white" : "text-teal-400 group-hover:text-white")} />
                  <span className="flex-1">{link.label}</span>
                  {badge > 0 && (
                    <span className={cn(
                      "ml-auto inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                      isActive ? "bg-white/20 text-white" : "bg-rose-500 text-white shadow-sm"
                    )}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 mt-auto">
            <button
              onClick={handleLogout}
              className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all duration-200"
            >
              <FiLogOut className="h-5 w-5" />
              <span>{t('sidebar_logout')}</span>
            </button>
            <div className="mt-4 text-center">
              <p className="text-[10px] text-teal-600/50 uppercase tracking-widest">Secure Connection</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
