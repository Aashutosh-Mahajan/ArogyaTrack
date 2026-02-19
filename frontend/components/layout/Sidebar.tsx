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
    { href: '/dashboard/downloads', label: t('sidebar_downloads'), icon: FiDownload },
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

  const links =
    user?.role === 'doctor' ? doctorLinks :
      user?.role === 'admin' || user?.role === 'authority' ? adminLinks :
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
          "fixed left-0 top-0 z-50 h-full w-72 bg-white shadow-soft-lg transition-transform duration-300 ease-out lg:translate-x-0 rounded-r-3xl",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-xl font-bold text-primary-600">{t('health_system')}</h2>
            <button
              onClick={onClose}
              className="lg:hidden text-teal-600 hover:text-teal-800 p-2 rounded-xl hover:bg-teal-50 transition-all"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-soft">
                <span className="text-lg font-bold text-white">
                  {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-teal-600 capitalize font-medium">
                  {user?.role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
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
                    "flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-soft"
                      : "text-body hover:bg-teal-50 hover:text-teal-700"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-teal-600")} />
                  <span className="flex-1">{link.label}</span>
                  {badge > 0 && (
                    <span className={cn(
                      "ml-auto inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                      isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"
                    )}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <FiLogOut className="h-5 w-5" />
              <span>{t('sidebar_logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
