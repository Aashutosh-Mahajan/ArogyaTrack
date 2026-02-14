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
} from 'react-icons/fi';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

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
    { href: '/dashboard', label: 'Dashboard', icon: FiHome },
    { href: '/dashboard/patient-card', label: 'Patient Card', icon: FiUser },
    { href: '/dashboard/profile', label: 'My Profile', icon: FiUser },
    { href: '/dashboard/medical-records', label: 'Medical Records', icon: FiActivity },
    { href: '/dashboard/prescriptions', label: 'Prescriptions', icon: FiFileText },
    { href: '/dashboard/medicines', label: 'Medicines', icon: FiShoppingBag },
    { href: '/dashboard/adherence', label: 'Adherence', icon: FiHeart },
    { href: '/dashboard/alerts', label: 'Alerts', icon: FiBell, badge: unreadAlertCount },
    { href: '/dashboard/downloads', label: 'Downloads', icon: FiDownload },
    { href: '/dashboard/security', label: 'Security', icon: FiShield },
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
          "fixed left-0 top-0 z-50 h-full w-64 bg-white shadow-xl transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-xl font-bold text-primary-600">Health System</h2>
            <button
              onClick={onClose}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>

          {/* User Info */}
          <div className="border-b p-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary-600">
                  {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
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
                    "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{link.label}</span>
                  {badge > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="border-t p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <FiLogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
